"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { MatchReviewCard } from "@/components/features/match-review-card";
import { ArrowLeft, CheckCheck } from "lucide-react";
import toast from "react-hot-toast";

interface ReviewItem {
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
  matchCandidates: Array<{
    id: string;
    title: string | null;
    brand: string | null;
    asin: string | null;
    upc: string | null;
    imageUrl: string | null;
    confidenceScore: number | null;
    rank: number;
    llmChoice: boolean;
  }>;
}

export default function ReviewPage() {
  const params = useParams();
  const sheetId = params.id as string;

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [sheetName, setSheetName] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      const [sheetRes, itemsRes] = await Promise.all([
        api.get(`/sheets/${sheetId}`),
        api.get(`/sheets/${sheetId}/items?status=review&limit=100`),
      ]);
      setSheetName(sheetRes.data.data.name);
      setItems(itemsRes.data.data.items);
    } catch {
      toast.error("Failed to load items for review");
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAccept(itemId: string, candidateId: string) {
    try {
      await api.post(`/matches/${itemId}/accept`, { candidateId });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Match accepted");
    } catch {
      toast.error("Failed to accept match");
    }
  }

  async function handleReject(itemId: string) {
    try {
      await api.post(`/matches/${itemId}/reject`, {});
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Marked as unmatched");
    } catch {
      toast.error("Failed to reject match");
    }
  }

  async function handleBulkApprove() {
    setIsBulkApproving(true);
    try {
      const res = await api.post("/matches/bulk-approve", {
        sheetId,
        minConfidence: 0.85,
      });
      const { approved } = res.data.data;
      toast.success(`${approved} matches approved`);
      await fetchItems();
    } catch {
      toast.error("Bulk approve failed");
    } finally {
      setIsBulkApproving(false);
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading items for review...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/sheets/${sheetId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {sheetName || "sheet"}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Review Matches</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? "s" : ""} need review
            </p>
          </div>
          {items.length > 0 && (
            <Button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" />
              {isBulkApproving ? "Approving..." : "Bulk Approve (85%+)"}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-lg font-medium">All caught up!</p>
          <p className="mt-1 text-muted-foreground">
            No items need review right now.
          </p>
          <Link href={`/sheets/${sheetId}`}>
            <Button variant="outline" className="mt-4">
              Back to Sheet
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <MatchReviewCard
              key={item.id}
              item={item}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
