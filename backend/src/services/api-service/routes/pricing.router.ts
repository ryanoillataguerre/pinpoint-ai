import { Router, Response } from "express";
import { param, query, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { errorPassthrough } from "../middleware/error-passthrough";
import { verifyToken } from "../middleware/auth";
import {
  NotFoundError,
  ForbiddenError,
} from "../../../shared/errors";
import { AuthenticatedRequest } from "../../../shared/types";

export function createPricingRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(verifyToken);

  // GET /pricing/:sheetId — get pricing data for all matched items in a sheet
  router.get(
    "/:sheetId",
    param("sheetId").isUUID(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.sheetId as string;

      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { orgId: true, name: true },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const [items, total] = await Promise.all([
        prisma.sheetItem.findMany({
          where: {
            sheetId,
            status: { in: ["auto_matched", "matched"] },
            matchedProduct: { isNot: null },
          },
          orderBy: { rowNumber: "asc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            rowNumber: true,
            rawDescription: true,
            rawBrand: true,
            rawPrice: true,
            normalizedDescription: true,
            normalizedBrand: true,
            matchConfidence: true,
            matchedProduct: {
              select: {
                id: true,
                asin: true,
                upc: true,
                canonicalName: true,
                brand: true,
                imageUrl: true,
                pricingData: true,
              },
            },
          },
        }),
        prisma.sheetItem.count({
          where: {
            sheetId,
            status: { in: ["auto_matched", "matched"] },
            matchedProduct: { isNot: null },
          },
        }),
      ]);

      res.json({
        data: {
          sheetName: sheet.name,
          items,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    })
  );

  // GET /pricing/:sheetId/export — CSV export of matched items with pricing
  router.get(
    "/:sheetId/export",
    param("sheetId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.sheetId as string;

      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { orgId: true, name: true },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      const items = await prisma.sheetItem.findMany({
        where: {
          sheetId,
          status: { in: ["auto_matched", "matched"] },
          matchedProduct: { isNot: null },
        },
        orderBy: { rowNumber: "asc" },
        select: {
          rowNumber: true,
          rawDescription: true,
          rawBrand: true,
          rawSku: true,
          rawUpc: true,
          rawPrice: true,
          normalizedDescription: true,
          normalizedBrand: true,
          matchConfidence: true,
          matchMethod: true,
          matchedProduct: {
            select: {
              asin: true,
              upc: true,
              canonicalName: true,
              brand: true,
              pricingData: {
                select: {
                  buyBoxPriceCents: true,
                  avg30DayPriceCents: true,
                  avg90DayPriceCents: true,
                  lowestPriceCents: true,
                  soldLastMonth: true,
                  totalOffers: true,
                  bsrCategory: true,
                  bsrRank: true,
                  profitMargin: true,
                  roi: true,
                },
              },
            },
          },
        },
      });

      // Build CSV
      const headers = [
        "Row",
        "Raw Description",
        "Raw Brand",
        "Raw SKU",
        "Raw UPC",
        "Raw Price",
        "Matched Name",
        "Matched Brand",
        "ASIN",
        "UPC",
        "Confidence",
        "Match Method",
        "Buy Box ($)",
        "30-Day Avg ($)",
        "90-Day Avg ($)",
        "Lowest ($)",
        "Monthly Sales",
        "Total Offers",
        "BSR Category",
        "BSR Rank",
        "Profit Margin",
        "ROI",
      ];

      const rows = items.map((item) => {
        const mp = item.matchedProduct;
        const pd = mp?.pricingData;
        return [
          item.rowNumber,
          csvEscape(item.rawDescription),
          csvEscape(item.rawBrand),
          csvEscape(item.rawSku),
          csvEscape(item.rawUpc),
          csvEscape(item.rawPrice),
          csvEscape(mp?.canonicalName),
          csvEscape(mp?.brand),
          mp?.asin || "",
          mp?.upc || "",
          item.matchConfidence?.toFixed(2) || "",
          item.matchMethod || "",
          centsToDollars(pd?.buyBoxPriceCents),
          centsToDollars(pd?.avg30DayPriceCents),
          centsToDollars(pd?.avg90DayPriceCents),
          centsToDollars(pd?.lowestPriceCents),
          pd?.soldLastMonth ?? "",
          pd?.totalOffers ?? "",
          csvEscape(pd?.bsrCategory),
          pd?.bsrRank ?? "",
          pd?.profitMargin != null ? (pd.profitMargin * 100).toFixed(1) + "%" : "",
          pd?.roi != null ? (pd.roi * 100).toFixed(1) + "%" : "",
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");
      const filename = `${sheet.name.replace(/[^a-zA-Z0-9-_]/g, "_")}_pricing.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    })
  );

  // GET /pricing/:sheetId/summary — aggregate pricing stats
  router.get(
    "/:sheetId/summary",
    param("sheetId").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.sheetId as string;

      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { orgId: true },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      const pricingAgg = await prisma.pricingData.aggregate({
        where: {
          matchedProduct: { sheetItem: { sheetId } },
        },
        _avg: {
          buyBoxPriceCents: true,
          profitMargin: true,
          roi: true,
        },
        _count: true,
      });

      const matchCounts = await prisma.sheetItem.groupBy({
        by: ["status"],
        where: { sheetId },
        _count: true,
      });

      const statusMap: Record<string, number> = {};
      for (const c of matchCounts) {
        statusMap[c.status] = c._count;
      }

      res.json({
        data: {
          totalItems:
            Object.values(statusMap).reduce((a, b) => a + b, 0),
          matched: (statusMap.auto_matched || 0) + (statusMap.matched || 0),
          review: statusMap.review || 0,
          unmatched: statusMap.unmatched || 0,
          pending:
            (statusMap.pending || 0) +
            (statusMap.normalizing || 0) +
            (statusMap.matching || 0),
          error: statusMap.error || 0,
          pricingAvailable: pricingAgg._count,
          avgBuyBoxCents: pricingAgg._avg.buyBoxPriceCents
            ? Math.round(pricingAgg._avg.buyBoxPriceCents)
            : null,
          avgProfitMargin: pricingAgg._avg.profitMargin,
          avgRoi: pricingAgg._avg.roi,
        },
      });
    })
  );

  return router;
}

function csvEscape(val: string | null | undefined): string {
  if (val == null) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
