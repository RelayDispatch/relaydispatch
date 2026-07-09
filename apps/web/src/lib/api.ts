import type { AIClassification } from "../types";

export async function classifyRequest(text: string): Promise<AIClassification> {
  const response = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to classify request");
  }

  return response.json();
}
