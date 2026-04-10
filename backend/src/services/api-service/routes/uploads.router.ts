import { Router, Response } from "express";
import { param, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { enqueueExtraction, enqueueNormalization } from "../../../lib/queue";
import { uploadBuffer } from "../../../lib/storage";
import { errorPassthrough } from "../middleware/error-passthrough";
import { verifyToken } from "../middleware/auth";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../../shared/errors";
import { AuthenticatedRequest } from "../../../shared/types";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

interface CsvRow {
  [key: string]: string | undefined;
}

function detectCsvColumns(headers: string[]) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (patterns: string[]) =>
    lower.findIndex((h) => patterns.some((p) => h.includes(p)));

  return {
    description: find(["description", "product", "item", "name", "style"]),
    brand: find(["brand", "manufacturer"]),
    sku: find(["sku", "item number", "style number", "item #", "style #"]),
    upc: find(["upc", "barcode", "ean", "gtin"]),
    size: find(["size"]),
    price: find(["price", "cost", "wholesale"]),
  };
}

export function createUploadsRouter(prisma: PrismaClient) {
  const router = Router();

  router.use(verifyToken);

  // POST /uploads/:sheetId/csv — upload CSV and parse into sheet items
  router.post(
    "/:sheetId/csv",
    param("sheetId").isUUID(),
    upload.single("file"),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      if (!req.file) {
        throw new BadRequestError("No file provided");
      }

      const sheetId = req.params.sheetId as string;
      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      // Parse CSV
      const content = req.file.buffer.toString("utf-8");
      const records: CsvRow[] = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      if (records.length === 0) {
        throw new BadRequestError("CSV file is empty or has no data rows");
      }

      const headers = Object.keys(records[0]);
      const cols = detectCsvColumns(headers);

      // Create sheet items from CSV rows
      const items = records.map((row, index) => ({
        id: uuidv4(),
        sheetId: sheet.id,
        rowNumber: index + 1,
        rawDescription:
          cols.description >= 0 ? row[headers[cols.description]] || "" : "",
        rawBrand: cols.brand >= 0 ? row[headers[cols.brand]] || null : null,
        rawSku: cols.sku >= 0 ? row[headers[cols.sku]] || null : null,
        rawUpc: cols.upc >= 0 ? row[headers[cols.upc]] || null : null,
        rawSize: cols.size >= 0 ? row[headers[cols.size]] || null : null,
        rawPrice: cols.price >= 0 ? row[headers[cols.price]] || null : null,
        rawData: row as object,
        status: "pending",
      }));

      await prisma.$transaction(async (tx) => {
        await tx.sheetItem.createMany({ data: items });
        await tx.sheet.update({
          where: { id: sheet.id },
          data: {
            status: "extracted",
            totalItems: items.length,
            sourceType: "csv",
          },
        });
      });

      // Enqueue normalization for all items in this sheet
      await enqueueNormalization({
        sheetId: sheet.id,
        itemIds: items.map((i) => i.id),
      });

      res.status(201).json({
        data: {
          sheetId: sheet.id,
          itemsCreated: items.length,
          columnsDetected: {
            description: cols.description >= 0 ? headers[cols.description] : null,
            brand: cols.brand >= 0 ? headers[cols.brand] : null,
            sku: cols.sku >= 0 ? headers[cols.sku] : null,
            upc: cols.upc >= 0 ? headers[cols.upc] : null,
            size: cols.size >= 0 ? headers[cols.size] : null,
            price: cols.price >= 0 ? headers[cols.price] : null,
          },
        },
      });
    })
  );

  // POST /uploads/:sheetId/file — upload image or PDF file
  router.post(
    "/:sheetId/file",
    param("sheetId").isUUID(),
    upload.single("file"),
    errorPassthrough(async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new BadRequestError("Validation failed", errors.array());
      }

      if (!req.file) {
        throw new BadRequestError("No file provided");
      }

      const sheetId = req.params.sheetId as string;
      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
      });

      if (!sheet) throw new NotFoundError("Sheet not found");
      if (sheet.orgId !== req.orgId) throw new ForbiddenError();

      // Determine source type from mimetype
      const mimetype = req.file.mimetype;
      let sourceType: string;
      if (mimetype === "application/pdf") {
        sourceType = "pdf";
      } else if (mimetype.startsWith("image/")) {
        sourceType = "image";
      } else {
        throw new BadRequestError(`Unsupported file type for file upload: ${mimetype}`);
      }

      // Upload to GCS
      const gcsPath = `sheets/${sheetId}/${req.file.originalname}`;
      const storageUrl = await uploadBuffer(
        gcsPath,
        req.file.buffer,
        mimetype
      );

      // Update sheet with storage URL and source type
      const updatedSheet = await prisma.sheet.update({
        where: { id: sheetId },
        data: {
          storageUrl,
          sourceType,
          status: "uploaded",
        },
      });

      // Enqueue extraction job
      await enqueueExtraction({ sheetId: sheet.id });

      res.status(201).json({
        data: {
          sheetId: updatedSheet.id,
          storageUrl,
          sourceType,
          status: updatedSheet.status,
        },
      });
    })
  );

  return router;
}
