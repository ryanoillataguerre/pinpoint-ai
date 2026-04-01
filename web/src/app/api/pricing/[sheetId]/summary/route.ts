import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  const { sheetId } = await params;
  const token = req.headers.get("x-access-token");

  const res = await fetch(`${API_URL}/pricing/${sheetId}/summary`, {
    headers: {
      ...(token && { "x-access-token": token }),
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
