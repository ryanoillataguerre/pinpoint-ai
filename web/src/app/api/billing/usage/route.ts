import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

function getToken(req: NextRequest): string | null {
  return req.headers.get("x-access-token");
}

export async function GET(req: NextRequest) {
  const token = getToken(req);

  const res = await fetch(`${API_URL}/billing/usage`, {
    headers: {
      ...(token && { "x-access-token": token }),
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
