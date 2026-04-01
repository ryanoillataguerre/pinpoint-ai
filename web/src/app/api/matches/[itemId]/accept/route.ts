import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const token = req.headers.get("x-access-token");
  const body = await req.json();

  const res = await fetch(`${API_URL}/matches/${itemId}/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "x-access-token": token }),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
