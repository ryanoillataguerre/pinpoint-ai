import { Router, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { errorPassthrough } from "../middleware/error-passthrough";
import { verifyToken } from "../middleware/auth";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../../shared/errors";
import { AuthenticatedRequest } from "../../../shared/types";
import { enqueuePricing } from "../../../lib/queue";
import { generateEmbedding, buildEmbeddingText } from "../../../lib/embeddings";

export function createMatchesRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(verifyToken);

  // GET /matches/similar/:itemId — find similar previously matched products
  router.get(
    "/similar/:itemId",
    param("itemId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const itemId = req.params.itemId as string;

      const item = await prisma.sheetItem.findUnique({
        where: { id: itemId },
        include: { sheet: { select: { orgId: true } } },
      });

      if (!item) throw new NotFoundError("Item not found");
      if (item.sheet.orgId !== req.orgId) throw new ForbiddenError();

      // Build embedding from normalized data
      const embText = buildEmbeddingText({
        normalizedBrand: item.normalizedBrand,
        normalizedDescription: item.normalizedDescription,
        normalizedCategory: item.normalizedCategory,
      });

      if (!embText) {
        res.json({ data: [] });
        return;
      }

      const embedding = await generateEmbedding(embText);
      const vectorStr = `[${embedding.join(",")}]`;

      // Return richer data including pricing, image, category, UPC, match method
      // Filter to same org to prevent cross-org data leaks
      // Similarity threshold > 0.7 to filter noise
      const similar = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          asin: string | null;
          upc: string | null;
          canonical_name: string | null;
          brand: string | null;
          category: string | null;
          image_url: string | null;
          match_method: string;
          confidence: number;
          similarity: number;
          buy_box_price_cents: number | null;
        }>
      >(
        `SELECT mp.id, mp.asin, mp.upc, mp.canonical_name, mp.brand,
                mp.category, mp.image_url, mp.match_method, mp.confidence,
                1 - (mp.embedding <=> $1::vector) as similarity,
                pd.buy_box_price_cents
         FROM matched_products mp
         INNER JOIN sheet_items si ON si.id = mp.sheet_item_id
         INNER JOIN sheets s ON s.id = si.sheet_id
         LEFT JOIN pricing_data pd ON pd.matched_product_id = mp.id
         WHERE mp.embedding IS NOT NULL
           AND s.org_id = $2::uuid
           AND 1 - (mp.embedding <=> $1::vector) > 0.7
         ORDER BY mp.embedding <=> $1::vector
         LIMIT 5`,
        vectorStr,
        req.orgId
      );

      res.json({ data: similar });
    })
  );

  // POST /matches/:itemId/use-similar — create a match from a similar product
  router.post(
    "/:itemId/use-similar",
    param("itemId").isUUID(),
    body("similarProductId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const itemId = req.params.itemId as string;
      const { similarProductId } = req.body;

      const item = await prisma.sheetItem.findUnique({
        where: { id: itemId },
        include: { sheet: { select: { orgId: true, id: true } } },
      });

      if (!item) throw new NotFoundError("Item not found");
      if (item.sheet.orgId !== req.orgId) throw new ForbiddenError();

      // Find the similar matched product (verify same org)
      const similarProduct = await prisma.matchedProduct.findUnique({
        where: { id: similarProductId },
        include: {
          sheetItem: { include: { sheet: { select: { orgId: true } } } },
        },
      });

      if (!similarProduct || similarProduct.sheetItem.sheet.orgId !== req.orgId) {
        throw new NotFoundError("Similar product not found");
      }

      const matchedProduct = await prisma.$transaction(async (tx) => {
        await tx.matchedProduct.deleteMany({
          where: { sheetItemId: itemId },
        });

        const mp = await tx.matchedProduct.create({
          data: {
            id: uuidv4(),
            sheetItemId: itemId,
            asin: similarProduct.asin,
            upc: similarProduct.upc,
            canonicalName: similarProduct.canonicalName,
            brand: similarProduct.brand,
            category: similarProduct.category,
            imageUrl: similarProduct.imageUrl,
            matchMethod: "similar",
            confidence: 1.0,
            matchedByUserId: req.userId,
          },
        });

        await tx.sheetItem.update({
          where: { id: itemId },
          data: {
            status: "matched",
            matchConfidence: 1.0,
            matchMethod: "similar",
          },
        });

        await tx.matchFeedback.create({
          data: {
            id: uuidv4(),
            sheetItemId: itemId,
            acceptedMatchId: similarProductId,
            action: "accept",
            reviewerId: req.userId!,
          },
        });

        return mp;
      });

      await updateSheetCounts(prisma, item.sheet.id);

      if (matchedProduct.asin) {
        await enqueuePricing({
          matchedProductId: matchedProduct.id,
          asin: matchedProduct.asin,
          sheetId: item.sheet.id,
        });
      }

      res.json({ data: matchedProduct });
    })
  );

  // POST /matches/:itemId/accept — accept a match candidate
  router.post(
    "/:itemId/accept",
    param("itemId").isUUID(),
    body("candidateId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const itemId = req.params.itemId as string;
      const { candidateId } = req.body;

      const item = await prisma.sheetItem.findUnique({
        where: { id: itemId },
        include: { sheet: { select: { orgId: true, id: true } } },
      });

      if (!item) throw new NotFoundError("Item not found");
      if (item.sheet.orgId !== req.orgId) throw new ForbiddenError();

      const candidate = await prisma.matchCandidate.findUnique({
        where: { id: candidateId },
      });

      if (!candidate || candidate.sheetItemId !== itemId) {
        throw new NotFoundError("Candidate not found for this item");
      }

      // Create matched product + feedback in a transaction
      const matchedProduct = await prisma.$transaction(async (tx) => {
        // Remove any existing matched product
        await tx.matchedProduct.deleteMany({
          where: { sheetItemId: itemId },
        });

        const mp = await tx.matchedProduct.create({
          data: {
            id: uuidv4(),
            sheetItemId: itemId,
            asin: candidate.asin,
            upc: candidate.upc,
            canonicalName: candidate.title,
            brand: candidate.brand,
            category: null,
            imageUrl: candidate.imageUrl,
            matchMethod: "manual",
            confidence: candidate.confidenceScore || 1.0,
            matchedByUserId: req.userId,
          },
        });

        await tx.sheetItem.update({
          where: { id: itemId },
          data: {
            status: "matched",
            matchConfidence: candidate.confidenceScore || 1.0,
            matchMethod: "manual",
          },
        });

        // Record feedback
        await tx.matchFeedback.create({
          data: {
            id: uuidv4(),
            sheetItemId: itemId,
            suggestedMatchId: candidateId,
            acceptedMatchId: candidateId,
            action: "accept",
            reviewerId: req.userId!,
          },
        });

        return mp;
      });

      await updateSheetCounts(prisma, item.sheet.id);

      // Enqueue pricing if ASIN exists
      if (matchedProduct.asin) {
        await enqueuePricing({
          matchedProductId: matchedProduct.id,
          asin: matchedProduct.asin,
          sheetId: item.sheet.id,
        });
      }

      res.json({ data: matchedProduct });
    })
  );

  // POST /matches/:itemId/reject — reject all candidates, mark unmatched
  router.post(
    "/:itemId/reject",
    param("itemId").isUUID(),
    body("reason").optional().isString(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const itemId = req.params.itemId as string;

      const item = await prisma.sheetItem.findUnique({
        where: { id: itemId },
        include: { sheet: { select: { orgId: true, id: true } } },
      });

      if (!item) throw new NotFoundError("Item not found");
      if (item.sheet.orgId !== req.orgId) throw new ForbiddenError();

      await prisma.$transaction(async (tx) => {
        await tx.sheetItem.update({
          where: { id: itemId },
          data: { status: "unmatched", matchMethod: "manual" },
        });

        await tx.matchFeedback.create({
          data: {
            id: uuidv4(),
            sheetItemId: itemId,
            action: "reject",
            mismatchReason: req.body.reason || null,
            reviewerId: req.userId!,
          },
        });
      });

      await updateSheetCounts(prisma, item.sheet.id);

      res.json({ data: { status: "unmatched" } });
    })
  );

  // POST /matches/bulk-approve — approve all auto_matched items for a sheet
  router.post(
    "/bulk-approve",
    body("sheetId").isUUID(),
    body("minConfidence").optional().isFloat({ min: 0, max: 1 }),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const { sheetId, minConfidence = 0.9 } = req.body;

      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { orgId: true },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      // Find all auto_matched or review items above confidence threshold
      const items = await prisma.sheetItem.findMany({
        where: {
          sheetId,
          status: { in: ["auto_matched", "review"] },
          matchConfidence: { gte: minConfidence },
        },
        include: {
          matchedProduct: true,
          matchCandidates: {
            where: { llmChoice: true },
            take: 1,
          },
        },
      });

      let approved = 0;

      for (const item of items) {
        // If already has matched product (auto_matched), just update status
        if (item.matchedProduct) {
          await prisma.sheetItem.update({
            where: { id: item.id },
            data: { status: "matched" },
          });
          approved++;
          continue;
        }

        // For review items, create matched product from top candidate
        const topCandidate = item.matchCandidates[0];
        if (!topCandidate) continue;

        await prisma.$transaction(async (tx) => {
          const mp = await tx.matchedProduct.create({
            data: {
              id: uuidv4(),
              sheetItemId: item.id,
              asin: topCandidate.asin,
              upc: topCandidate.upc,
              canonicalName: topCandidate.title,
              brand: topCandidate.brand,
              imageUrl: topCandidate.imageUrl,
              matchMethod: "manual",
              confidence: topCandidate.confidenceScore || 0,
              matchedByUserId: req.userId,
            },
          });

          await tx.sheetItem.update({
            where: { id: item.id },
            data: { status: "matched", matchMethod: "manual" },
          });

          // Enqueue pricing
          if (mp.asin) {
            await enqueuePricing({
              matchedProductId: mp.id,
              asin: mp.asin,
              sheetId,
            });
          }
        });

        approved++;
      }

      await updateSheetCounts(prisma, sheetId);

      res.json({ data: { approved, total: items.length } });
    })
  );

  return router;
}

async function updateSheetCounts(prisma: PrismaClient, sheetId: string) {
  const counts = await prisma.sheetItem.groupBy({
    by: ["status"],
    where: { sheetId },
    _count: true,
  });

  const matched = counts
    .filter((c) => ["auto_matched", "matched"].includes(c.status))
    .reduce((sum, c) => sum + c._count, 0);
  const review = counts.find((c) => c.status === "review")?._count || 0;
  const unmatched = counts.find((c) => c.status === "unmatched")?._count || 0;

  await prisma.sheet.update({
    where: { id: sheetId },
    data: { matchedItems: matched, reviewItems: review, unmatchedItems: unmatched },
  });
}
