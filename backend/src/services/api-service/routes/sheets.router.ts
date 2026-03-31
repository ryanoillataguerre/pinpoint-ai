import { Router, Response } from "express";
import { body, param, query, validationResult } from "express-validator";
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

export function createSheetsRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(verifyToken);

  // GET /sheets
  router.get(
    "/",
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const [sheets, total] = await Promise.all([
        prisma.sheet.findMany({
          where: { orgId: req.orgId },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            name: true,
            sourceType: true,
            status: true,
            totalItems: true,
            matchedItems: true,
            reviewItems: true,
            unmatchedItems: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.sheet.count({ where: { orgId: req.orgId } }),
      ]);

      res.json({
        data: {
          sheets,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    })
  );

  // GET /sheets/:id
  router.get(
    "/:id",
    param("id").isUUID(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.id as string;
      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      res.json({ data: sheet });
    })
  );

  // GET /sheets/:id/items
  router.get(
    "/:id/items",
    param("id").isUUID(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isString(),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const sheetId = req.params.id as string;
      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { orgId: true },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      const status = req.query.status as string | undefined;

      const where = {
        sheetId,
        ...(status && { status }),
      };

      const [items, total] = await Promise.all([
        prisma.sheetItem.findMany({
          where,
          orderBy: { rowNumber: "asc" },
          skip: offset,
          take: limit,
          include: {
            matchCandidates: {
              orderBy: { rank: "asc" },
              take: 5,
            },
            matchedProduct: {
              include: { pricingData: true },
            },
          },
        }),
        prisma.sheetItem.count({ where }),
      ]);

      res.json({
        data: {
          items,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    })
  );

  // POST /sheets — create from CSV upload
  router.post(
    "/",
    body("name").trim().notEmpty(),
    body("sourceType").isIn(["csv", "excel", "image", "pdf"]),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      const { name, sourceType } = req.body;

      const sheet = await prisma.sheet.create({
        data: {
          id: uuidv4(),
          orgId: req.orgId!,
          uploadedByUserId: req.userId!,
          name,
          sourceType,
          status: "created",
          totalItems: 0,
          matchedItems: 0,
          reviewItems: 0,
          unmatchedItems: 0,
        },
      });

      res.status(201).json({ data: sheet });
    })
  );

  return router;
}
