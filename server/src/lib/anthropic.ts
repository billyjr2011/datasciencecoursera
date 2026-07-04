import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

// The Anthropic client lives ONLY on the server. The API key is never bundled
// into the frontend. This is the central fix vs. the original browser-side artifact.
export const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

/**
 * Run a single completion and return the concatenated text content.
 * Non-streaming: triage output is a small (~4k token) JSON object well under
 * the SDK timeout threshold.
 */
export async function complete(prompt: string, maxTokens = 4096): Promise<string> {
  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
