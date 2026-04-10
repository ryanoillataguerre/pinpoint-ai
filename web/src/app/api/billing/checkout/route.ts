import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

function getToken(req: NextRequest): string | null {
  return req.headers.get("x-access-token");
}

export async function POST(req: NextRequest) {
  const token = getToken(req);
  const body = await req.json();

  const res = await fetch(`${API_URL}/billing/checkout`, {
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
