import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("x-access-token");
  const url = new URL(req.url);

  const res = await fetch(`${API_URL}/sheets/${id}/items?${url.searchParams}`, {
    headers: {
      ...(token && { "x-access-token": token }),
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
