/**
 * Export-to-listing routes.
 * Generates Amazon flat files and Shopify product CSVs from matched items.
 */

import { Router, Response } from "express";
import { param } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { errorPassthrough } from "../middleware/error-passthrough";
import { verifyToken } from "../middleware/auth";
import { NotFoundError, ForbiddenError } from "../../../shared/errors";
import { AuthenticatedRequest } from "../../../shared/types";
import {
  generateAmazonFlatFile,
  AmazonExportItem,
} from "../../../lib/exports/amazon-flat-file";
import {
  generateShopifyCSV,
  ShopifyExportItem,
} from "../../../lib/exports/shopify-csv";

export function createExportsRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(verifyToken);

  // Shared query to get matched items with pricing for a sheet
  async function getExportItems(sheetId: string, orgId: string) {
    const sheet = await prisma.sheet.findUnique({
      where: { id: sheetId },
      select: { orgId: true, name: true },
    });

    if (!sheet) throw new NotFoundError("Sheet not found");
    if (sheet.orgId !== orgId) throw new ForbiddenError();

    const items = await prisma.sheetItem.findMany({
      where: {
        sheetId,
        status: { in: ["auto_matched", "matched"] },
        matchedProduct: { isNot: null },
      },
      orderBy: { rowNumber: "asc" },
      select: {
        rawSku: true,
        rawDescription: true,
        normalizedDescription: true,
        matchedProduct: {
          select: {
            asin: true,
            upc: true,
            canonicalName: true,
            brand: true,
            category: true,
            imageUrl: true,
            pricingData: {
              select: {
                buyBoxPriceCents: true,
              },
            },
          },
        },
      },
    });

    return { items, sheetName: sheet.name };
  }

  // GET /exports/:sheetId/amazon — download Amazon flat file
  router.get(
    "/:sheetId/amazon",
    param("sheetId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.sheetId as string;
      const { items, sheetName } = await getExportItems(sheetId, req.orgId!);

      const exportItems: AmazonExportItem[] = items
        .filter((i) => i.matchedProduct)
        .map((item, idx) => {
          const mp = item.matchedProduct!;
          return {
            sku: item.rawSku || `SKU-${idx + 1}`,
            asin: mp.asin,
            upc: mp.upc,
            canonicalName: mp.canonicalName || "Unknown",
            brand: mp.brand,
            buyBoxPriceCents: mp.pricingData?.buyBoxPriceCents ?? null,
            category: mp.category,
            description:
              item.normalizedDescription || item.rawDescription,
            imageUrl: mp.imageUrl,
          };
        });

      const content = generateAmazonFlatFile(exportItems);
      const filename = `${sheetName || "export"}_amazon_listing.txt`;

      res.setHeader("Content-Type", "text/tab-separated-values");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(content);
    })
  );

  // GET /exports/:sheetId/shopify — download Shopify product CSV
  router.get(
    "/:sheetId/shopify",
    param("sheetId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.sheetId as string;
      const { items, sheetName } = await getExportItems(sheetId, req.orgId!);

      const exportItems: ShopifyExportItem[] = items
        .filter((i) => i.matchedProduct)
        .map((item) => {
          const mp = item.matchedProduct!;
          return {
            canonicalName: mp.canonicalName || "Unknown",
            brand: mp.brand,
            category: mp.category,
            description:
              item.normalizedDescription || item.rawDescription,
            sku: item.rawSku,
            upc: mp.upc,
            buyBoxPriceCents: mp.pricingData?.buyBoxPriceCents ?? null,
            imageUrl: mp.imageUrl,
          };
        });

      const content = generateShopifyCSV(exportItems);
      const filename = `${sheetName || "export"}_shopify_products.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(content);
    })
  );

  return router;
}
