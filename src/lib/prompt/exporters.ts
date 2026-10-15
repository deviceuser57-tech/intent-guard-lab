import type { CompiledPrompt } from "./types";

export type Provider = "openai" | "anthropic" | "gemini" | "raw";
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function toOpenAI(p: CompiledPrompt, model = "gpt-4o") {
  return {
    model,
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.user },
    ],
  };
}
export function toAnthropic(p: CompiledPrompt, model = "claude-sonnet-4-5") {
  return {
    model,
    max_tokens: 4096,
    system: p.system,
    messages: [{ role: "user", content: p.user }],
  };
}
export const toRaw = (p: CompiledPrompt) =>
  `=== SYSTEM ===\n${p.system}\n\n=== USER ===\n${p.user}`;

export function toGemini(p: CompiledPrompt, model = "gemini-2.5-pro") {
  return {
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    body: {
      systemInstruction: { parts: [{ text: p.system }] },
      contents: [{ role: "user" as const, parts: [{ text: p.user }] }],
    },
  };
}

export function validateGemini(x: ReturnType<typeof toGemini>): ValidationResult {
  const errors: string[] = [];
  if (!x.endpoint.includes("/v1beta/models/") || !x.endpoint.endsWith(":generateContent")) {
    errors.push("endpoint must target a Gemini generateContent model");
  }
  if (!x.body.systemInstruction.parts.some((part) => part.text.trim())) {
    errors.push("systemInstruction must contain non-empty text");
  }
  if (!Array.isArray(x.body.contents) || x.body.contents.length === 0) {
    errors.push("contents must be a non-empty array");
  }
  if (x.body.contents[x.body.contents.length - 1]?.role !== "user") {
    errors.push("last content item should have role=user");
  }
  x.body.contents.forEach((content, index) => {
    if (!content.parts.length || content.parts.some((part) => typeof part.text !== "string")) {
      errors.push(`contents[${index}].parts must contain text parts`);
    }
  });
  return { valid: errors.length === 0, errors };
}

export function validateOpenAI(x: ReturnType<typeof toOpenAI>): ValidationResult {
  const e: string[] = [];
  if (!x.model) e.push("model is required");
  if (!Array.isArray(x.messages) || !x.messages.length)
    e.push("messages must be a non-empty array");
  x.messages.forEach((m, i) => {
    if (!["system", "user", "assistant", "developer"].includes(m.role))
      e.push(`messages[${i}].role invalid`);
    if (typeof m.content !== "string" || !m.content.trim()) e.push(`messages[${i}].content empty`);
  });
  if (x.messages[x.messages.length - 1]?.role !== "user")
    e.push("last message should be role=user");
  return { valid: !e.length, errors: e };
}
export function validateAnthropic(x: ReturnType<typeof toAnthropic>): ValidationResult {
  const e: string[] = [];
  if (!x.model) e.push("model is required");
  if (!Number.isInteger(x.max_tokens) || x.max_tokens < 1)
    e.push("max_tokens must be a positive integer");
  if (typeof x.system !== "string") e.push("system must be a top-level string");
  if (x.messages.some((m) => (m.role as string) === "system"))
    e.push("system role not allowed inside messages");
  if (x.messages[0]?.role !== "user") e.push("first message must be role=user");
  x.messages.forEach((m, i) => {
    if (!m.content.trim()) e.push(`messages[${i}].content empty`);
  });
  return { valid: !e.length, errors: e };
}
