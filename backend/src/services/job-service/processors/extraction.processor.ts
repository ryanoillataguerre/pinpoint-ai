/**
 * Extraction processor — handles image/PDF uploads.
 * Uses vision LLM to extract line items from unstructured documents.
 * CSV uploads skip this stage (items are extracted during upload).
 */

import { PrismaClient } from "@prisma/client";
import {
  llmVisionCall,
  llmCallJSON,
  MODELS,
  EXTRACTION_SYSTEM,
  buildExtractionPrompt,
  EXTRACTION_SCHEMA,
} from "../../../lib/llm";
import type { ExtractionResult } from "../../../lib/llm";
import { ExtractionJobData, enqueueNormalization } from "../../../lib/queue";
import { v4 as uuidv4 } from "uuid";

export function createExtractionProcessor(prisma: PrismaClient) {
  return async function processExtraction(
    data: ExtractionJobData
  ): Promise<void> {
    const { sheetId } = data;

    const sheet = await prisma.sheet.findUnique({ where: { id: sheetId } });
    if (!sheet) {
      console.error(`Extraction: sheet ${sheetId} not found`);
      return;
    }

    await prisma.sheet.update({
      where: { id: sheetId },
      data: { status: "extracting" },
    });

    try {
      let items: ExtractionResult["items"];

      if (sheet.sourceType === "image" && sheet.storageUrl) {
        // Fetch image and convert to base64
        const imageRes = await fetch(sheet.storageUrl);
        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
        const base64 = imageBuffer.toString("base64");

        // Detect media type from URL or default to jpeg
        const ext = sheet.storageUrl.split(".").pop()?.toLowerCase();
        const mediaType =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg";

        const response = await llmVisionCall(
          base64,
          mediaType as "image/jpeg" | "image/png" | "image/webp",
          buildExtractionPrompt(),
          {
            model: MODELS.SONNET,
            system: EXTRACTION_SYSTEM,
          }
        );

        // Parse structured response
        let jsonStr = response.text.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();
        const parsed = JSON.parse(jsonStr) as ExtractionResult;
        items = parsed.items;
      } else if (sheet.sourceType === "pdf" && sheet.storageUrl) {
        // For PDF, use text extraction + LLM parsing
        // TODO: implement PDF text extraction (e.g., pdf-parse)
        // For now, treat any text metadata as input
        const metadata = sheet.extractionMetadata as Record<string, unknown> | null;
        const textContent = metadata?.textContent as string | undefined;

        if (textContent) {
          const { parsed } = await llmCallJSON<ExtractionResult>({
            model: MODELS.SONNET,
            system: EXTRACTION_SYSTEM,
            messages: [
              {
                role: "user",
                content: `Extract all product items from this document text:\n\n${textContent}`,
              },
            ],
            jsonSchema: EXTRACTION_SCHEMA,
          });
          items = parsed.items;
        } else {
          console.warn(`Extraction: no text content for PDF sheet ${sheetId}`);
          items = [];
        }
      } else {
        // CSV/Excel items are already extracted during upload
        console.log(
          `Extraction: sheet ${sheetId} is ${sheet.sourceType}, skipping extraction`
        );
        return;
      }

      // Create sheet items from extracted data
      const sheetItems = items.map((item, index) => ({
        id: uuidv4(),
        sheetId,
        rowNumber: index + 1,
        rawDescription: item.description || "",
        rawBrand: item.brand || null,
        rawSku: item.sku || null,
        rawUpc: item.upc || null,
        rawSize: item.size || null,
        rawPrice: item.price || null,
        rawData: item as object,
        status: "pending",
      }));

      await prisma.$transaction(async (tx) => {
        await tx.sheetItem.createMany({ data: sheetItems });
        await tx.sheet.update({
          where: { id: sheetId },
          data: {
            status: "extracted",
            totalItems: sheetItems.length,
          },
        });
      });

      // Enqueue normalization
      await enqueueNormalization({
        sheetId,
        itemIds: sheetItems.map((i) => i.id),
      });

      console.log(
        `Extraction complete: ${sheetItems.length} items from sheet ${sheetId}`
      );
    } catch (err) {
      console.error(`Extraction failed for sheet ${sheetId}:`, err);
      await prisma.sheet.update({
        where: { id: sheetId },
        data: { status: "error" },
      });
      throw err;
    }
  };
}
