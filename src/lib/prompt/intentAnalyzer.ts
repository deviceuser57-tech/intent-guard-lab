import type { Archetype, Component, Complexity, IntentAnalysis, RiskLevel, TaskType } from "./types";

const TASK_RULES: { type: TaskType; archetype: Archetype; words: string[] }[] = [
  { type: "debugging", archetype: "software", words: ["bug", "error", "stack trace", "exception", "debug", "crash", "fix", "خطأ", "إصلاح"] },
  { type: "code_review", archetype: "software", words: ["review", "refactor", "code quality", "pull request", "pr ", "مراجعة"] },
  { type: "code_generation", archetype: "software", words: ["code", "function", "api", "typescript", "python", "react", "sql", "script", "implement", "كود", "برمجة", "دالة"] },
  { type: "business_strategy", archetype: "business", words: ["strategy", "market", "competitor", "business plan", "pricing", "go-to-market", "okr", "revenue", "استراتيجية", "سوق"] },
  { type: "copywriting", archetype: "copywriting", words: ["copy", "headline", "ad ", "slogan", "landing page", "tagline", "cta", "إعلان", "شعار"] },
  { type: "content_marketing", archetype: "copywriting", words: ["blog", "article", "newsletter", "seo", "social post", "linkedin", "مقال", "محتوى"] },
  { type: "data_extraction", archetype: "analytics", words: ["extract", "parse", "json from", "structured data", "entities", "استخراج"] },
  { type: "data_analysis", archetype: "analytics", words: ["analy", "dataset", "metrics", "kpi", "chart", "statistic", "trend", "csv", "تحليل", "بيانات"] },
  { type: "agent_system", archetype: "agents", words: ["agent", "system prompt", "system instruction", "tool", "autonomous", "assistant that", "workflow", "وكيل"] },
  { type: "deep_research", archetype: "research", words: ["research", "literature", "sources", "cite", "evidence", "investigate", "report on", "بحث", "مصادر"] },
  { type: "creative_visual", archetype: "creative", words: ["image", "illustration", "midjourney", "photo", "render", "logo", "visual", "story", "poem", "صورة", "قصة"] },
  { type: "education", archetype: "general", words: ["teach", "explain", "lesson", "tutor", "curriculum", "quiz", "شرح", "درس"] },
  { type: "legal_compliance", archetype: "business", words: ["legal", "contract", "gdpr", "compliance", "policy", "regulation", "قانون", "عقد"] },
  { type: "customer_support", archetype: "agents", words: ["support", "customer", "ticket", "refund", "complaint", "عميل", "دعم"] },
];

const RISK_RULES: { level: RiskLevel; words: string[]; label: string }[] = [
  { level: "critical", words: ["medical diagnosis", "dosage", "weapon", "exploit", "malware", "self-harm", "bypass security"], label: "Safety-critical domain" },
  { level: "high", words: ["legal", "financial advice", "invest", "medical", "patient", "pii", "password", "credit card", "ssn", "personal data", "health"], label: "Regulated / sensitive data" },
  { level: "medium", words: ["customer", "production", "publish", "email", "public", "autonomous", "execute", "tool"], label: "External exposure or actions" },
];

const PERSONAS: Record<Archetype, string> = {
  software: "Principal Software Engineer",
  business: "Senior Strategy Consultant",
  copywriting: "Conversion-focused Senior Copywriter",
  analytics: "Lead Data Analyst",
  agents: "AI Systems Architect",
  research: "Research Analyst with rigorous sourcing standards",
  creative: "Award-winning Creative Director",
  general: "Expert Generalist Advisor",
};

export const ARCHETYPE_DEFAULT_TASK: Record<Archetype, TaskType> = {
  software: "code_generation", business: "business_strategy", copywriting: "copywriting",
  analytics: "data_analysis", agents: "agent_system", research: "deep_research",
  creative: "creative_visual", general: "general_inquiry",
};

export function componentsFor(archetype: Archetype, complexity: Complexity, risk: RiskLevel): Component[] {
  const c = new Set<Component>(["role", "context", "task", "constraints", "output_contract"]);
  if (complexity !== "simple") { c.add("reasoning"); c.add("examples"); }
  if (complexity === "complex") c.add("evaluation_rubric");
  if (risk === "high" || risk === "critical") c.add("safety");
  if (archetype === "research") c.add("citations");
  if (archetype === "agents") { c.add("tools"); c.add("safety"); }
  c.add("variables");
  return [...c];
}

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Compiled once at module load: one alternation regex per rule (substring semantics preserved, e.g. "analy" matches "analysis").
const compileRule = (words: string[]) => new RegExp(words.map(esc).join("|"), "g");
const TASK_RX = TASK_RULES.map((r) => ({ ...r, rx: compileRule(r.words) }));
const RISK_RX = RISK_RULES.map((r) => ({ ...r, rx: compileRule(r.words) }));
const hitsOf = (rx: RegExp, text: string) => { rx.lastIndex = 0; return Array.from(new Set(text.match(rx) ?? [])); };

export function analyzeIntent(input: string, override?: Archetype | null): IntentAnalysis {
  const text = ` ${input.toLowerCase()} `;
  let best = { type: "general_inquiry" as TaskType, archetype: "general" as Archetype, score: 0 };
  const keywords: string[] = [];
  for (const r of TASK_RX) {
    const hits = hitsOf(r.rx, text);
    keywords.push(...hits);
    if (hits.length > best.score) best = { type: r.type, archetype: r.archetype, score: hits.length };
  }
  let taskType = best.type;
  let archetype = best.archetype;
  if (override && override !== archetype) { archetype = override; taskType = ARCHETYPE_DEFAULT_TASK[override]; }

  let risk: RiskLevel = "low";
  const riskSignals: string[] = [];
  for (const r of RISK_RX) {
    const hits = hitsOf(r.rx, text);
    if (hits.length) {
      riskSignals.push(`${r.label}: ${hits.join(", ")}`);
      if (risk === "low" || (risk === "medium" && r.level !== "medium") || (risk === "high" && r.level === "critical")) risk = r.level;
    }
  }

  const words = input.trim().split(/\s+/).filter(Boolean).length;
  const clauses = (input.match(/[,;.\n]| and | then | و/g) || []).length;
  const complexity: Complexity = words > 60 || clauses > 6 ? "complex" : words > 18 || clauses > 2 ? "moderate" : "simple";

  const variables = Array.from(new Set([...input.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1] as string)));
  const confidence = override ? 1 : Math.min(0.95, 0.35 + best.score * 0.2);

  return {
    taskType, archetype, confidence, risk, riskSignals, complexity,
    components: componentsFor(archetype, complexity, risk),
    persona: PERSONAS[archetype], variables, keywords: Array.from(new Set(keywords)),
  };
}
