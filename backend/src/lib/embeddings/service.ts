import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

export function buildEmbeddingText(item: {
  normalizedBrand?: string | null;
  normalizedDescription?: string | null;
  normalizedCategory?: string | null;
  canonicalName?: string | null;
  brand?: string | null;
}): string {
  const parts = [
    item.normalizedBrand || item.brand,
    item.normalizedDescription || item.canonicalName,
    item.normalizedCategory,
  ].filter(Boolean);
  return parts.join(" | ");
}
