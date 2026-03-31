"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Upload, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

export default function UploadPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (!name) {
        setName(dropped.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setIsUploading(true);
    try {
      // 1. Create the sheet
      const { data: sheetData } = await api.post("/sheets", {
        name,
        sourceType: file.type.includes("csv") ? "csv" : "excel",
      });

      const sheetId = sheetData.data.id;

      // 2. Upload the file
      const formData = new FormData();
      formData.append("file", file);

      await api.post(`/uploads/${sheetId}/csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Sheet uploaded successfully");
      router.push(`/sheets/${sheetId}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <Link
        href="/sheets"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sheets
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Upload Sheet</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Upload a line sheet</CardTitle>
          <CardDescription>
            Upload a CSV or Excel file with your inventory data
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sheet name</Label>
              <Input
                id="name"
                placeholder="Q2 2026 Inventory"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>File</Label>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <>
                    <FileSpreadsheet className="mb-2 h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Drop a file or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CSV, Excel (up to 50MB)
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!file || !name || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload & Process"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
