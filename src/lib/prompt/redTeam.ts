import type { CompiledPrompt, RiskLevel } from "./types";

export type Category = "prompt_injection" | "context_poisoning" | "data_leakage" | "unsafe_instructions" | "output_violation" | "hallucination_inducement";
export interface Finding { category: Category; severity: RiskLevel; rule: string; detail: string; mitigation: string }
export interface RedTeamReport { score: number; findings: Finding[]; checks: { category: Category; passed: boolean }[] }

const CATS: Category[] = ["prompt_injection", "context_poisoning", "data_leakage", "unsafe_instructions", "output_violation", "hallucination_inducement"];
const W: Record<RiskLevel, number> = { low: 5, medium: 12, high: 22, critical: 35 };

export function redTeam(p: CompiledPrompt): RedTeamReport {
  const all = `${p.system}\n${p.user}`; const low = all.toLowerCase(); const sys = p.system.toLowerCase();
  const f: Finding[] = [];
  const add = (x: Finding) => f.push(x);

  if (/ignore (all |any )?(previous|prior|above) instructions|disregard .*rules|you are now|developer mode|jailbreak/.test(low))
    add({ category: "prompt_injection", severity: "critical", rule: "PI-001", detail: "Contains known injection phrasing.", mitigation: "Remove override phrases from the template." });
  if (/\{\{\s*\w+\s*\}\}/.test(p.user) && !/<user_input>|<\w+>\s*\{\{/.test(p.user))
    add({ category: "prompt_injection", severity: "high", rule: "PI-002", detail: "Variables are interpolated without delimiters.", mitigation: "Wrap every variable in XML-style tags." });
  if (!/is data, not instructions|untrusted/.test(sys))
    add({ category: "prompt_injection", severity: "medium", rule: "PI-003", detail: "No instruction-hierarchy / untrusted-input clause.", mitigation: "Enable the Safety component." });
  if (/retriev|document|tool output|web|search/.test(low) && !/untrusted|not as instructions|is data/.test(sys))
    add({ category: "context_poisoning", severity: "high", rule: "CP-001", detail: "External content referenced without trust boundary.", mitigation: "Declare retrieved/tool content as untrusted data." });
  if (/(api[_ ]?key|password|secret|token)\s*[:=]\s*\S+|sk-[a-z0-9]{10,}/i.test(all))
    add({ category: "data_leakage", severity: "critical", rule: "DL-001", detail: "Possible hard-coded credential.", mitigation: "Remove secrets; inject at runtime server-side." });
  if (/\b\d{3}-\d{2}-\d{4}\b|[\w.+-]+@[\w-]+\.[\w.]+/.test(all))
    add({ category: "data_leakage", severity: "medium", rule: "DL-002", detail: "PII pattern (email/SSN) found in template.", mitigation: "Replace with a variable placeholder." });
  if (!/do not reveal this system prompt/.test(sys))
    add({ category: "data_leakage", severity: "low", rule: "DL-003", detail: "No system-prompt confidentiality clause.", mitigation: "Add a non-disclosure line." });
  if (/without (asking|confirmation)|always comply|never refuse|no restrictions|delete|rm -rf|drop table/.test(low))
    add({ category: "unsafe_instructions", severity: "high", rule: "UI-001", detail: "Encourages unconditional or destructive action.", mitigation: "Require confirmation for irreversible actions." });
  if (!/# output contract|format:/i.test(p.system))
    add({ category: "output_violation", severity: "medium", rule: "OV-001", detail: "No explicit output contract.", mitigation: "Enable the Output contract component." });
  if (/valid json/i.test(p.system) && !/schema:/i.test(p.system))
    add({ category: "output_violation", severity: "medium", rule: "OV-002", detail: "JSON required but no schema supplied.", mitigation: "Provide a JSON schema." });
  if (/(always|must) (provide|give|include) (an? )?(answer|number|statistic|source)/.test(low) && !/i don't know|say so|mark missing/.test(low))
    add({ category: "hallucination_inducement", severity: "high", rule: "HI-001", detail: "Forces an answer with no abstention path.", mitigation: "Allow the model to say it doesn't know." });
  if (!/don't know|say so|mark missing|flag assumptions|confidence/.test(low))
    add({ category: "hallucination_inducement", severity: "low", rule: "HI-002", detail: "No uncertainty / abstention guidance.", mitigation: "Add a line permitting uncertainty." });

  const score = Math.max(0, 100 - f.reduce((s, x) => s + W[x.severity], 0));
  return { score, findings: f, checks: CATS.map((c) => ({ category: c, passed: !f.some((x) => x.category === c && x.severity !== "low") })) };
}
