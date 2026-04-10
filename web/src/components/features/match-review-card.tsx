"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Search, Loader2 } from "lucide-react";
import api from "@/lib/api-client";
import toast from "react-hot-toast";

interface Candidate {
  id: string;
  title: string | null;
  brand: string | null;
  asin: string | null;
  upc: string | null;
  imageUrl: string | null;
  confidenceScore: number | null;
  rank: number;
  llmChoice: boolean;
}

interface SimilarProduct {
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
}

interface MatchReviewCardProps {
  item: {
    id: string;
    rowNumber: number;
    rawDescription: string | null;
    rawBrand: string | null;
    rawSku: string | null;
    rawUpc: string | null;
    rawSize: string | null;
    rawPrice: string | null;
    normalizedDescription: string | null;
    normalizedBrand: string | null;
    matchConfidence: number | null;
    matchCandidates: Candidate[];
  };
  onAccept: (itemId: string, candidateId: string) => Promise<void>;
  onReject: (itemId: string) => Promise<void>;
  onUseSimilar?: (itemId: string) => void;
}

export function MatchReviewCard({ item, onAccept, onReject, onUseSimilar }: MatchReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [similarExpanded, setSimilarExpanded] = useState(false);
  const [similarItems, setSimilarItems] = useState<SimilarProduct[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  const topCandidate = item.matchCandidates.find((c) => c.llmChoice) || item.matchCandidates[0];
  const otherCandidates = item.matchCandidates.filter((c) => c.id !== topCandidate?.id);

  async function handleAccept(candidateId: string) {
    setIsActing(true);
    try {
      await onAccept(item.id, candidateId);
    } finally {
      setIsActing(false);
    }
  }

  async function handleReject() {
    setIsActing(true);
    try {
      await onReject(item.id);
    } finally {
      setIsActing(false);
    }
  }

  async function loadSimilarItems() {
    if (similarLoaded) {
      setSimilarExpanded(!similarExpanded);
      return;
    }
    setSimilarLoading(true);
    setSimilarExpanded(true);
    try {
      const res = await api.get(`/matches/similar/${item.id}`);
      setSimilarItems(res.data.data);
      setSimilarLoaded(true);
    } catch {
      toast.error("Failed to load similar items");
    } finally {
      setSimilarLoading(false);
    }
  }

  async function handleUseSimilar(similarProductId: string) {
    setIsActing(true);
    try {
      await api.post(`/matches/${item.id}/use-similar`, { similarProductId });
      toast.success("Match created from similar item");
      onUseSimilar?.(item.id);
    } catch {
      toast.error("Failed to use similar match");
    } finally {
      setIsActing(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 divide-x">
          {/* Source item */}
          <div className="p-4">
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Source Item #{item.rowNumber}
            </p>
            <p className="mb-2 font-medium">
              {item.normalizedDescription || item.rawDescription || "No description"}
            </p>
            <div className="space-y-1 text-sm text-muted-foreground">
              {(item.normalizedBrand || item.rawBrand) && (
                <p>Brand: {item.normalizedBrand || item.rawBrand}</p>
              )}
              {item.rawSku && <p>SKU: {item.rawSku}</p>}
              {item.rawUpc && <p>UPC: {item.rawUpc}</p>}
              {item.rawSize && <p>Size: {item.rawSize}</p>}
              {item.rawPrice && <p>Price: {item.rawPrice}</p>}
            </div>
          </div>

          {/* Top candidate */}
          <div className="p-4">
            {topCandidate ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Best Match
                  </p>
                  <ConfidenceBadge score={topCandidate.confidenceScore} />
                </div>
                <div className="mb-3 flex gap-3">
                  {topCandidate.imageUrl && (
                    <img
                      src={topCandidate.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded border object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 font-medium leading-tight">
                      {topCandidate.title || "Unknown"}
                    </p>
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      {topCandidate.brand && <p>Brand: {topCandidate.brand}</p>}
                      {topCandidate.asin && (
                        <p className="font-mono text-xs">ASIN: {topCandidate.asin}</p>
                      )}
                      {topCandidate.upc && (
                        <p className="font-mono text-xs">UPC: {topCandidate.upc}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(topCandidate.id)}
                    disabled={isActing}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isActing}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    No Match
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <p>No candidates found</p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isActing}
                  className="mt-2"
                >
                  Mark Unmatched
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Other candidates (expandable) */}
        {otherCandidates.length > 0 && (
          <div className="border-t">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-muted/50"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {otherCandidates.length} other candidate{otherCandidates.length > 1 ? "s" : ""}
            </button>

            {expanded && (
              <div className="divide-y border-t">
                {otherCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {candidate.imageUrl && (
                          <img
                            src={candidate.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded border object-contain"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium">{candidate.title || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[candidate.brand, candidate.asin].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <ConfidenceBadge score={candidate.confidenceScore} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAccept(candidate.id)}
                        disabled={isActing}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Similar previously matched items */}
        <div className="border-t">
          <button
            onClick={loadSimilarItems}
            className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:bg-muted/50"
          >
            {similarLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : similarExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            {similarExpanded ? "Hide" : "Find"} similar previously matched items
          </button>

          {similarExpanded && !similarLoading && (
            <div className="border-t">
              {similarItems.length === 0 ? (
                <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                  No similar items found
                </p>
              ) : (
                <div className="divide-y">
                  {similarItems.map((sim) => (
                    <div key={sim.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {sim.image_url && (
                            <img
                              src={sim.image_url}
                              alt=""
                              className="h-10 w-10 rounded border object-contain"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {sim.canonical_name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[
                                sim.brand,
                                sim.asin && `ASIN: ${sim.asin}`,
                                sim.upc && `UPC: ${sim.upc}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {sim.buy_box_price_cents != null && (
                              <p className="text-xs font-medium text-green-700">
                                Buy Box: ${(sim.buy_box_price_cents / 100).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {Math.round(sim.similarity * 100)}% similar
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUseSimilar(sim.id)}
                          disabled={isActing}
                        >
                          Use This
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 90
      ? "bg-green-100 text-green-800"
      : pct >= 70
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}
