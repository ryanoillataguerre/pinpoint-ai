"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingTable } from "@/components/features/pricing-table";
import { ArrowLeft, Download, DollarSign, TrendingUp, Package, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

interface PricingSummary {
  totalItems: number;
  matched: number;
  pricingAvailable: number;
  avgBuyBoxCents: number | null;
  avgProfitMargin: number | null;
  avgRoi: number | null;
}

export default function PricingPage() {
  const params = useParams();
  const sheetId = params.id as string;

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState<PricingSummary | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [pricingRes, summaryRes] = await Promise.all([
        api.get(`/pricing/${sheetId}`),
        api.get(`/pricing/${sheetId}/summary`),
      ]);
      setSheetName(pricingRes.data.data.sheetName);
      setItems(pricingRes.data.data.items);
      setSummary(summaryRes.data.data);
    } catch {
      toast.error("Failed to load pricing data");
    } finally {
      setIsLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleExport() {
    try {
      const res = await api.get(`/pricing/${sheetId}/export`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sheetName || "export"}_pricing.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading pricing data...</p>;
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
            <h1 className="text-2xl font-bold">Pricing Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              {summary?.pricingAvailable || 0} of {summary?.matched || 0} matched
              items have pricing data
            </p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                Matched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.matched}</p>
              <p className="text-xs text-muted-foreground">
                of {summary.totalItems} items
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Avg Buy Box
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {summary.avgBuyBoxCents
                  ? `$${(summary.avgBuyBoxCents / 100).toFixed(2)}`
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Avg Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${
                summary.avgProfitMargin != null
                  ? summary.avgProfitMargin > 0.15
                    ? "text-green-600"
                    : summary.avgProfitMargin > 0
                      ? "text-yellow-600"
                      : "text-red-600"
                  : ""
              }`}>
                {summary.avgProfitMargin != null
                  ? `${(summary.avgProfitMargin * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                Avg ROI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {summary.avgRoi != null
                  ? `${(summary.avgRoi * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pricing table */}
      <Card>
        <CardContent className="p-0">
          <PricingTable items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
