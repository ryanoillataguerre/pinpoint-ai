import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:8080";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function serverRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("pinpoint_access_token")?.value;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken && { "x-access-token": accessToken }),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `API error: ${res.status}`);
  }

  return res.json();
}
