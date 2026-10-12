import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";

type Res = { ok: true; text: string } | { ok: false; status: number; error: string };

async function callResponses(instructions: string, input: string, schema?: { name: string; schema: object }): Promise<Res> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false, status: 401, error: "AI is not configured." };
  const body: Record<string, unknown> = {
    model: MODEL, instructions, input, stream: true, store: false,
    reasoning: { effort: "low" },
  };
  if (schema) body.text = { format: { type: "json_schema", name: schema.name, schema: schema.schema, strict: true } };
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    let msg = `AI request failed (${r.status}).`;
    try { const j = await r.json(); msg = j?.error?.message ?? j?.message ?? msg; } catch { /* ignore */ }
    if (r.status === 429) msg = "Rate limited — please wait a moment and try again.";
    if (r.status === 402) msg = msg || "AI credits exhausted.";
    return { ok: false, status: r.status, error: msg };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", refusal = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "response.refusal.delta") refusal += ev.delta ?? "";
        else if (ev.type === "response.failed" || ev.type === "error") return { ok: false, status: 500, error: ev.error?.message ?? ev.response?.error?.message ?? "AI request failed." };
      } catch { /* partial */ }
    }
  }
  if (!text && refusal) return { ok: false, status: 200, error: `Model refused: ${refusal}` };
  return { ok: true, text };
}

const SYS_OPT = `You are a world-class prompt engineer (2026 best practices). Rewrite the given system and user prompts to be production-grade:
- Clear role, context, task, constraints, explicit output contract, success criteria.
- Target model family "{target}": for anthropic use XML tags (<role>, <context>, <instructions>, <output_format>); for openai use concise Markdown sections; for reasoning models avoid "think step by step" and state goals + constraints instead.
- Keep every {{variable}} placeholder intact. Put untrusted input inside delimiters and add prompt-injection defenses.
- Fix every listed finding. Do not invent facts.
Return JSON with system, user, and changes (short bullet list of what you improved).`;

export const optimizePrompt = createServerFn({ method: "POST" })
  .inputValidator(z.object({ system: z.string().max(40000), user: z.string().max(40000), findings: z.array(z.string()).max(50), target: z.enum(["openai", "anthropic", "reasoning"]) }))
  .handler(async ({ data }) => {
    const r = await callResponses(SYS_OPT.replace("{target}", data.target),
      `SYSTEM PROMPT:\n${data.system}\n\nUSER PROMPT:\n${data.user}\n\nFINDINGS TO FIX:\n${data.findings.join("\n") || "none"}`,
      { name: "optimized_prompt", schema: { type: "object", additionalProperties: false, required: ["system", "user", "changes"], properties: { system: { type: "string" }, user: { type: "string" }, changes: { type: "array", items: { type: "string" } } } } });
    if (!r.ok) return r;
    try { const j = JSON.parse(r.text); return { ok: true as const, system: String(j.system), user: String(j.user), changes: (j.changes ?? []).map(String) as string[] }; }
    catch { return { ok: false as const, status: 500, error: "AI returned an unreadable result." }; }
  });

export const runPrompt = createServerFn({ method: "POST" })
  .inputValidator(z.object({ system: z.string().max(40000), user: z.string().max(40000) }))
  .handler(async ({ data }) => callResponses(data.system, data.user));

export const judgeOutput = createServerFn({ method: "POST" })
  .inputValidator(z.object({ system: z.string().max(40000), user: z.string().max(40000), output: z.string().max(60000) }))
  .handler(async ({ data }) => {
    const r = await callResponses("You are a strict evaluator of AI outputs. Score how well the OUTPUT follows the prompt's instructions, format and constraints (0-100). Return JSON.",
      `SYSTEM:\n${data.system}\n\nUSER:\n${data.user}\n\nOUTPUT:\n${data.output}`,
      { name: "judgement", schema: { type: "object", additionalProperties: false, required: ["score", "verdict", "issues"], properties: { score: { type: "number" }, verdict: { type: "string" }, issues: { type: "array", items: { type: "string" } } } } });
    if (!r.ok) return r;
    try { const j = JSON.parse(r.text); return { ok: true as const, score: Math.max(0, Math.min(100, Math.round(Number(j.score) || 0))), verdict: String(j.verdict), issues: (j.issues ?? []).map(String) as string[] }; }
    catch { return { ok: false as const, status: 500, error: "AI returned an unreadable result." }; }
  });
