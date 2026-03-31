"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, HelpCircle } from "lucide-react";
import toast from "react-hot-toast";

interface SheetItem {
  id: string;
  rowNumber: number;
  rawDescription: string | null;
  rawBrand: string | null;
  rawSku: string | null;
  rawUpc: string | null;
  rawSize: string | null;
  rawPrice: string | null;
  status: string;
  matchConfidence: number | null;
  matchedProduct: {
    asin: string | null;
    upc: string | null;
    canonicalName: string | null;
    brand: string | null;
    confidence: number;
    pricingData: {
      buyBoxPriceCents: number | null;
      avg30DayPriceCents: number | null;
    } | null;
  } | null;
  matchCandidates: Array<{
    id: string;
    title: string | null;
    asin: string | null;
    confidenceScore: number | null;
    rank: number;
  }>;
}

interface Sheet {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  totalItems: number;
  matchedItems: number;
  reviewItems: number;
  unmatchedItems: number;
}

const statusIcon: Record<string, React.ReactNode> = {
  auto_matched: <CheckCircle className="h-4 w-4 text-green-500" />,
  matched: <CheckCircle className="h-4 w-4 text-green-500" />,
  review: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  unmatched: <HelpCircle className="h-4 w-4 text-red-500" />,
};

export default function SheetDetailPage() {
  const params = useParams();
  const sheetId = params.id as string;

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [items, setItems] = useState<SheetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sheetRes, itemsRes] = await Promise.all([
        api.get(`/sheets/${sheetId}`),
        api.get(`/sheets/${sheetId}/items`),
      ]);
      setSheet(sheetRes.data.data);
      setItems(itemsRes.data.data.items);
    } catch {
      toast.error("Failed to load sheet");
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!sheet) {
    return <p className="text-red-500">Sheet not found</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/sheets"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sheets
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{sheet.name}</h1>
            <p className="text-sm text-muted-foreground">
              {sheet.totalItems} items &middot; {sheet.sourceType.toUpperCase()}{" "}
              &middot; {sheet.status}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sheet.totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sheet.matchedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sheet.reviewItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Unmatched</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sheet.unmatchedItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Brand</th>
                  <th className="px-4 py-3 text-left font-medium">UPC</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Match</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.rowNumber}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">
                      {item.rawDescription || "—"}
                    </td>
                    <td className="px-4 py-3">{item.rawBrand || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.rawUpc || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {statusIcon[item.status] || statusIcon.pending}
                        {item.status}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">
                      {item.matchedProduct ? (
                        <span title={item.matchedProduct.asin || undefined}>
                          {item.matchedProduct.canonicalName ||
                            item.matchedProduct.asin ||
                            "—"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.matchedProduct?.pricingData?.buyBoxPriceCents
                        ? `$${(
                            item.matchedProduct.pricingData.buyBoxPriceCents / 100
                          ).toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No items in this sheet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
