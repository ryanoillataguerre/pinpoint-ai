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
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  HelpCircle,
  Eye,
  DollarSign,
  Download,
  RefreshCw,
} from "lucide-react";
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
  normalizedDescription: string | null;
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
  createdAt: string;
}

const statusIcon: Record<string, React.ReactNode> = {
  auto_matched: <CheckCircle className="h-4 w-4 text-green-500" />,
  matched: <CheckCircle className="h-4 w-4 text-green-500" />,
  review: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  normalizing: <Clock className="h-4 w-4 text-muted-foreground" />,
  matching: <Clock className="h-4 w-4 text-muted-foreground" />,
  unmatched: <HelpCircle className="h-4 w-4 text-red-500" />,
  error: <HelpCircle className="h-4 w-4 text-red-500" />,
};

const processingStatuses = ["created", "extracting", "extracted", "normalizing", "matching"];

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

  // Auto-refresh while processing
  useEffect(() => {
    if (!sheet || !processingStatuses.includes(sheet.status)) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [sheet, fetchData]);

  async function handleExport() {
    try {
      const res = await api.get(`/pricing/${sheetId}/export`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sheet?.name || "export"}_pricing.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!sheet) {
    return <p className="text-red-500">Sheet not found</p>;
  }

  const isProcessing = processingStatuses.includes(sheet.status);
  const matchRate =
    sheet.totalItems > 0
      ? Math.round((sheet.matchedItems / sheet.totalItems) * 100)
      : 0;

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
              &middot;{" "}
              {isProcessing ? (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {sheet.status}
                </span>
              ) : (
                sheet.status
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {sheet.reviewItems > 0 && (
              <Link href={`/sheets/${sheetId}/review`}>
                <Button variant="default" size="sm">
                  <Eye className="mr-1.5 h-4 w-4" />
                  Review ({sheet.reviewItems})
                </Button>
              </Link>
            )}
            {sheet.matchedItems > 0 && (
              <Link href={`/sheets/${sheetId}/pricing`}>
                <Button variant="outline" size="sm">
                  <DollarSign className="mr-1.5 h-4 w-4" />
                  Pricing
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-5 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Match Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{matchRate}%</p>
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
                  <th className="px-4 py-3 text-right font-medium">Confidence</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.rowNumber}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">
                      {item.normalizedDescription || item.rawDescription || "—"}
                    </td>
                    <td className="px-4 py-3">{item.rawBrand || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {item.rawUpc || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {statusIcon[item.status] || statusIcon.pending}
                        <span className="text-xs">{item.status}</span>
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">
                      {item.matchedProduct ? (
                        <span title={item.matchedProduct.asin || undefined}>
                          {item.matchedProduct.canonicalName ||
                            item.matchedProduct.asin ||
                            "—"}
                        </span>
                      ) : item.matchCandidates?.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {item.matchCandidates.length} candidate{item.matchCandidates.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.matchConfidence != null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.matchConfidence >= 0.9
                              ? "bg-green-100 text-green-800"
                              : item.matchConfidence >= 0.7
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {Math.round(item.matchConfidence * 100)}%
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
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {isProcessing
                        ? "Processing items... this page will refresh automatically."
                        : "No items in this sheet"}
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
