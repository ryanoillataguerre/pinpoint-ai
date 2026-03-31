"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

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

const statusColors: Record<string, string> = {
  created: "bg-yellow-100 text-yellow-800",
  extracting: "bg-blue-100 text-blue-800",
  extracted: "bg-blue-100 text-blue-800",
  normalizing: "bg-purple-100 text-purple-800",
  matching: "bg-indigo-100 text-indigo-800",
  complete: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

export default function SheetsPage() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSheets = useCallback(async () => {
    try {
      const { data } = await api.get("/sheets");
      setSheets(data.data.sheets);
    } catch {
      toast.error("Failed to load sheets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sheets</h1>
          <p className="text-sm text-muted-foreground">
            Upload and manage your inventory line sheets
          </p>
        </div>
        <Link href="/sheets/upload">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Upload Sheet
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading sheets...</p>
      ) : sheets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No sheets yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload a CSV, Excel file, or image to get started
            </p>
            <Link href="/sheets/upload">
              <Button>Upload your first sheet</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sheets.map((sheet) => (
            <Link key={sheet.id} href={`/sheets/${sheet.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">{sheet.name}</CardTitle>
                    <CardDescription>
                      {sheet.sourceType.toUpperCase()} &middot;{" "}
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      statusColors[sheet.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {sheet.status}
                  </span>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>{sheet.totalItems} items</span>
                    <span className="text-green-600">
                      {sheet.matchedItems} matched
                    </span>
                    <span className="text-yellow-600">
                      {sheet.reviewItems} review
                    </span>
                    <span className="text-red-600">
                      {sheet.unmatchedItems} unmatched
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
