/**
 * Normalization processor — cleans up raw item data using LLM.
 * Takes messy descriptions and produces structured, searchable attributes.
 * After normalization, enqueues matching jobs for each item.
 */

import { PrismaClient } from "@prisma/client";
import {
  llmCallJSON,
  MODELS,
  NORMALIZATION_SYSTEM,
  buildNormalizationPrompt,
  NORMALIZATION_SCHEMA,
} from "../../../lib/llm";
import type { NormalizedItem } from "../../../lib/llm";
import { NormalizationJobData, enqueueMatchingBatch } from "../../../lib/queue";

export function createNormalizationProcessor(prisma: PrismaClient) {
  return async function processNormalization(
    data: NormalizationJobData
  ): Promise<void> {
    const { sheetId, itemIds } = data;

    await prisma.sheet.update({
      where: { id: sheetId },
      data: { status: "normalizing" },
    });

    const items = await prisma.sheetItem.findMany({
      where: { id: { in: itemIds } },
    });

    const normalizedIds: string[] = [];

    for (const item of items) {
      try {
        await prisma.sheetItem.update({
          where: { id: item.id },
          data: { status: "normalizing" },
        });

        // Skip items without descriptions
        if (!item.rawDescription) {
          await prisma.sheetItem.update({
            where: { id: item.id },
            data: { status: "error" },
          });
          continue;
        }

        const { parsed } = await llmCallJSON<NormalizedItem>({
          model: MODELS.HAIKU,
          system: NORMALIZATION_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildNormalizationPrompt({
                rawDescription: item.rawDescription,
                rawBrand: item.rawBrand,
                rawSku: item.rawSku,
                rawSize: item.rawSize,
              }),
            },
          ],
          jsonSchema: NORMALIZATION_SCHEMA,
        });

        await prisma.sheetItem.update({
          where: { id: item.id },
          data: {
            normalizedDescription: parsed.normalizedDescription,
            normalizedBrand: parsed.brand,
            normalizedCategory: parsed.category,
            normalizedSize: parsed.size,
            status: "matching",
          },
        });

        normalizedIds.push(item.id);
      } catch (err) {
        console.error(`Normalization failed for item ${item.id}:`, err);
        await prisma.sheetItem.update({
          where: { id: item.id },
          data: { status: "error" },
        });
      }
    }

    // Update sheet status and enqueue matching
    if (normalizedIds.length > 0) {
      await prisma.sheet.update({
        where: { id: sheetId },
        data: { status: "matching" },
      });

      await enqueueMatchingBatch(sheetId, normalizedIds);
    }

    console.log(
      `Normalization complete: ${normalizedIds.length}/${items.length} items for sheet ${sheetId}`
    );
  };
}
