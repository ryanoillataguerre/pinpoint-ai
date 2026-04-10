import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  const formData = await req.formData();
  const token = req.headers.get("x-access-token") || "";

  const body = new FormData();
  const file = formData.get("file");
  if (file) {
    body.append("file", file);
  }

  const res = await fetch(`${API_URL}/uploads/${sheetId}/file`, {
    method: "POST",
    headers: {
      ...(token && { "x-access-token": token }),
    },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
