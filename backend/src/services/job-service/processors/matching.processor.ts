/**
 * Matching processor — finds product matches for normalized items.
 *
 * Pipeline: UPC exact → Keepa search → UPCitemdb search → LLM ranking
 * Confidence thresholds:
 *   ≥ 0.90 → auto_matched
 *   0.70–0.89 → review
 *   < 0.70 → unmatched
 */

import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  llmCallJSON,
  MODELS,
  MATCH_RANKING_SYSTEM,
  buildMatchRankingPrompt,
  MATCH_RANKING_SCHEMA,
} from "../../../lib/llm";
import type { MatchRankingResult } from "../../../lib/llm";
import { MatchingJobData, enqueuePricing } from "../../../lib/queue";
import { lookupByUpc, searchByQuery } from "../../../lib/external/upcitemdb";
import { searchProducts as keepaSearch } from "../../../lib/external/keepa";

const AUTO_MATCH_THRESHOLD = 0.9;
const REVIEW_THRESHOLD = 0.7;

interface CandidateInput {
  title: string;
  brand: string | null;
  category: string | null;
  asin: string | null;
  upc: string | null;
  imageUrl: string | null;
  source: string;
}

export function createMatchingProcessor(prisma: PrismaClient) {
  return async function processMatching(
    data: MatchingJobData
  ): Promise<void> {
    const { sheetId, itemId } = data;

    const item = await prisma.sheetItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      console.error(`Matching: item ${itemId} not found`);
      return;
    }

    try {
      // ─── Step 1: Fast-path UPC exact match ────────────────
      if (item.rawUpc) {
        const upcResult = await lookupByUpc(item.rawUpc);
        if (upcResult) {
          await createAutoMatch(prisma, item.id, sheetId, {
            title: upcResult.title,
            brand: upcResult.brand,
            category: upcResult.category,
            asin: upcResult.asin,
            upc: upcResult.upc,
            imageUrl: upcResult.imageUrl,
            source: "upcitemdb",
          }, "upc_exact", 1.0);
          return;
        }
      }

      // ─── Step 2: Gather candidates from multiple sources ──
      const searchQuery =
        item.normalizedDescription ||
        item.rawDescription ||
        "";

      if (!searchQuery) {
        await prisma.sheetItem.update({
          where: { id: item.id },
          data: { status: "unmatched" },
        });
        await updateSheetCounts(prisma, sheetId);
        return;
      }

      const candidates: CandidateInput[] = [];

      // Search Keepa (Amazon data)
      try {
        const keepaResults = await keepaSearch(searchQuery);
        for (const r of keepaResults) {
          candidates.push({
            title: r.title,
            brand: r.brand,
            category: r.category,
            asin: r.asin,
            upc: null,
            imageUrl: r.imageUrl,
            source: "keepa",
          });
        }
      } catch (err) {
        console.warn("Keepa search failed:", err);
      }

      // Search UPCitemdb
      try {
        const upcResults = await searchByQuery(searchQuery);
        for (const r of upcResults) {
          candidates.push({
            title: r.title,
            brand: r.brand,
            category: r.category,
            asin: r.asin,
            upc: r.upc,
            imageUrl: r.imageUrl,
            source: "upcitemdb",
          });
        }
      } catch (err) {
        console.warn("UPCitemdb search failed:", err);
      }

      // Deduplicate by ASIN
      const seenAsins = new Set<string>();
      const uniqueCandidates = candidates.filter((c) => {
        if (c.asin && seenAsins.has(c.asin)) return false;
        if (c.asin) seenAsins.add(c.asin);
        return true;
      });

      if (uniqueCandidates.length === 0) {
        await prisma.sheetItem.update({
          where: { id: item.id },
          data: { status: "unmatched" },
        });
        await updateSheetCounts(prisma, sheetId);
        return;
      }

      // ─── Step 3: LLM ranking ──────────────────────────────
      const { parsed: ranking } = await llmCallJSON<MatchRankingResult>({
        model: MODELS.SONNET,
        system: MATCH_RANKING_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildMatchRankingPrompt(
              {
                description:
                  item.normalizedDescription || item.rawDescription || "",
                brand: item.normalizedBrand || item.rawBrand,
                category: item.normalizedCategory,
                size: item.normalizedSize || item.rawSize,
              },
              uniqueCandidates.map((c) => ({
                title: c.title,
                brand: c.brand,
                category: c.category,
                asin: c.asin,
                upc: c.upc,
              }))
            ),
          },
        ],
        jsonSchema: MATCH_RANKING_SCHEMA,
      });

      // ─── Step 4: Store candidates ─────────────────────────
      const candidateRecords = ranking.rankings.map((r, i) => {
        const candidate = uniqueCandidates[r.candidateIndex] || uniqueCandidates[i];
        return {
          id: uuidv4(),
          sheetItemId: item.id,
          asin: candidate?.asin || null,
          upc: candidate?.upc || null,
          title: candidate?.title || null,
          brand: candidate?.brand || null,
          imageUrl: candidate?.imageUrl || null,
          source: candidate?.source || null,
          confidenceScore: r.confidence,
          matchReasoning: { reasoning: r.reasoning } as object,
          llmChoice: r.candidateIndex === ranking.bestMatchIndex,
          rank: i + 1,
        };
      });

      await prisma.matchCandidate.createMany({ data: candidateRecords });

      // ─── Step 5: Route based on confidence ────────────────
      if (
        ranking.bestMatchIndex !== null &&
        ranking.overallConfidence >= AUTO_MATCH_THRESHOLD
      ) {
        const bestCandidate = uniqueCandidates[ranking.bestMatchIndex];
        await createAutoMatch(
          prisma,
          item.id,
          sheetId,
          bestCandidate,
          "auto_match",
          ranking.overallConfidence
        );
      } else if (ranking.overallConfidence >= REVIEW_THRESHOLD) {
        await prisma.sheetItem.update({
          where: { id: item.id },
          data: {
            status: "review",
            matchConfidence: ranking.overallConfidence,
            matchMethod: "llm_ranked",
          },
        });
        await updateSheetCounts(prisma, sheetId);
      } else {
        await prisma.sheetItem.update({
          where: { id: item.id },
          data: {
            status: "unmatched",
            matchConfidence: ranking.overallConfidence,
            matchMethod: "llm_ranked",
          },
        });
        await updateSheetCounts(prisma, sheetId);
      }
    } catch (err) {
      console.error(`Matching failed for item ${itemId}:`, err);
      await prisma.sheetItem.update({
        where: { id: item.id },
        data: { status: "error" },
      });
      throw err;
    }
  };
}

async function createAutoMatch(
  prisma: PrismaClient,
  itemId: string,
  sheetId: string,
  candidate: CandidateInput,
  method: string,
  confidence: number
) {
  const matchedProduct = await prisma.matchedProduct.create({
    data: {
      id: uuidv4(),
      sheetItemId: itemId,
      asin: candidate.asin,
      upc: candidate.upc,
      canonicalName: candidate.title,
      brand: candidate.brand,
      category: candidate.category,
      imageUrl: candidate.imageUrl,
      matchMethod: method,
      confidence,
    },
  });

  await prisma.sheetItem.update({
    where: { id: itemId },
    data: {
      status: "auto_matched",
      matchConfidence: confidence,
      matchMethod: method,
    },
  });

  await updateSheetCounts(prisma, sheetId);

  // Enqueue pricing if we have an ASIN
  if (candidate.asin) {
    await enqueuePricing({
      matchedProductId: matchedProduct.id,
      asin: candidate.asin,
      sheetId,
    });
  }
}

async function updateSheetCounts(prisma: PrismaClient, sheetId: string) {
  const counts = await prisma.sheetItem.groupBy({
    by: ["status"],
    where: { sheetId },
    _count: true,
  });

  const matched =
    counts
      .filter((c) => ["auto_matched", "matched"].includes(c.status))
      .reduce((sum, c) => sum + c._count, 0);
  const review =
    counts.find((c) => c.status === "review")?._count || 0;
  const unmatched =
    counts.find((c) => c.status === "unmatched")?._count || 0;
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  const allDone =
    matched + review + unmatched === total && total > 0;

  await prisma.sheet.update({
    where: { id: sheetId },
    data: {
      matchedItems: matched,
      reviewItems: review,
      unmatchedItems: unmatched,
      ...(allDone ? { status: "complete" } : {}),
    },
  });
}
