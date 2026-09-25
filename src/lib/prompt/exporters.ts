import type { CompiledPrompt } from "./types";

export type Provider = "openai" | "anthropic" | "raw";
export interface ValidationResult { valid: boolean; errors: string[] }

export function toOpenAI(p: CompiledPrompt, model = "gpt-4o") {
  return { model, messages: [{ role: "system", content: p.system }, { role: "user", content: p.user }] };
}
export function toAnthropic(p: CompiledPrompt, model = "claude-sonnet-4-5") {
  return { model, max_tokens: 4096, system: p.system, messages: [{ role: "user", content: p.user }] };
}
export const toRaw = (p: CompiledPrompt) => `=== SYSTEM ===\n${p.system}\n\n=== USER ===\n${p.user}`;

export function validateOpenAI(x: ReturnType<typeof toOpenAI>): ValidationResult {
  const e: string[] = [];
  if (!x.model) e.push("model is required");
  if (!Array.isArray(x.messages) || !x.messages.length) e.push("messages must be a non-empty array");
  x.messages.forEach((m, i) => {
    if (!["system", "user", "assistant", "developer"].includes(m.role)) e.push(`messages[${i}].role invalid`);
    if (typeof m.content !== "string" || !m.content.trim()) e.push(`messages[${i}].content empty`);
  });
  if (x.messages[x.messages.length - 1]?.role !== "user") e.push("last message should be role=user");
  return { valid: !e.length, errors: e };
}
export function validateAnthropic(x: ReturnType<typeof toAnthropic>): ValidationResult {
  const e: string[] = [];
  if (!x.model) e.push("model is required");
  if (!Number.isInteger(x.max_tokens) || x.max_tokens < 1) e.push("max_tokens must be a positive integer");
  if (typeof x.system !== "string") e.push("system must be a top-level string");
  if (x.messages.some((m) => (m.role as string) === "system")) e.push("system role not allowed inside messages");
  if (x.messages[0]?.role !== "user") e.push("first message must be role=user");
  x.messages.forEach((m, i) => { if (!m.content.trim()) e.push(`messages[${i}].content empty`); });
  return { valid: !e.length, errors: e };
}
