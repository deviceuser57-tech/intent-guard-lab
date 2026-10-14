import { memo, useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { analyzeIntent } from "@/lib/prompt/intentAnalyzer";
import { compile, defaultSpec, DEFAULT_ADV } from "@/lib/prompt/compiler";
import { redTeam } from "@/lib/prompt/redTeam";
import { evaluate } from "@/lib/prompt/evaluation";
import { registry, diffLines, type PromptAsset, type AuditEntry, type Lifecycle } from "@/lib/prompt/registry";
import { toOpenAI, toAnthropic, toRaw, validateOpenAI, validateAnthropic } from "@/lib/prompt/exporters";
import type { AdvancedControls, Archetype, Component, IntentAnalysis, Mode, Specification } from "@/lib/prompt/types";
import { makeT, type Lang } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { gsap } from "gsap";
import { optimizePrompt, runPrompt, judgeOutput } from "@/lib/ai.functions";

const L2: Record<string, { en: string; ar: string }> = {
  tabPlayground: { en: "Live Playground", ar: "ساحة الاختبار الحية" },
  aiOpt: { en: "AI Optimizer · Auto-Revise", ar: "المحسّن الذكي · مراجعة تلقائية" },
  aiDesc: { en: "A live AI model rewrites the prompt using current best practices, fixes security findings and tailors it to the target model.", ar: "يعيد نموذج ذكاء اصطناعي كتابة الموجّه وفق أحدث الممارسات ويعالج الملاحظات الأمنية ويكيّفه للنموذج المستهدف." },
  target: { en: "Target model", ar: "النموذج المستهدف" },
  optimize: { en: "Optimize with AI", ar: "حسّن بالذكاء الاصطناعي" },
  evolve: { en: "Auto-evolve (3 rounds)", ar: "تطوير تلقائي (3 جولات)" },
  revert: { en: "Revert to rule-based", ar: "العودة للنسخة القياسية" },
  working: { en: "Working…", ar: "جارٍ العمل…" },
  changes: { en: "AI changes", ar: "تغييرات الذكاء الاصطناعي" },
  fillVars: { en: "Fill variables", ar: "املأ المتغيرات" },
  runLive: { en: "Run against live AI", ar: "شغّل على نموذج حي" },
  output: { en: "Model output", ar: "مخرجات النموذج" },
  judge: { en: "AI judge score", ar: "تقييم الحَكَم الذكي" },
  adv: { en: "Truth & grounding controls", ar: "ضوابط الحقيقة والإسناد" },
  execDoc: { en: "Complete executive document with ready tables", ar: "ملف استراتيجي تنفيذي كامل بجداول جاهزة" },
  selfRT: { en: "Internal red-team before answering", ar: "فحص Red-team داخلي قبل الرد" },
  brutal: { en: "Brutal honesty (facts even if unwelcome)", ar: "الحقيقة الصادمة (حقائق حتى لو لم ترضِ)" },
  conf: { en: "Confidence score & calculation method", ar: "درجة الثقة وطريقة الحساب" },
  c_off: { en: "Off", ar: "بدون" },
  c_evidence_weighted: { en: "Evidence-weighted", ar: "مرجّح بقوة الدليل" },
  c_source_count: { en: "Source count", ar: "عدد المصادر" },
  c_bayesian: { en: "Bayesian (prior → posterior)", ar: "بايزي (احتمال قبلي ← بعدي)" },
  docs: { en: "Reference documents (.txt .md .csv .json)", ar: "مستندات مرجعية (.txt .md .csv .json)" },
  docsW: { en: "Answer from documents", ar: "الرد من المستندات" },
  webW: { en: "web / general knowledge", ar: "الإنترنت / المعرفة العامة" },
  noVars: { en: "No variables in this prompt.", ar: "لا توجد متغيرات." },
};

const ARCHS: Archetype[] = ["software", "business", "copywriting", "analytics", "agents", "research", "creative", "general"];
const ALL_COMPONENTS: Component[] = ["role", "context", "task", "constraints", "output_contract", "examples", "reasoning", "safety", "variables", "citations", "tools", "evaluation_rubric"];
type Tab = "intent" | "spec" | "compiled" | "security" | "playground" | "registry";

const riskTone: Record<"low" | "medium" | "high" | "critical", string> = { low: "bg-success/15 text-success", medium: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive", critical: "bg-destructive text-destructive-foreground" };

function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="glass-card rounded-lg border bg-card/80 backdrop-blur-lg border-white/20 p-4 shadow-xl">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
function CopyBtn({ text, t }: { text: string; t: (k: string) => string }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }} className="rounded border px-2 py-1 font-mono text-xs hover:bg-accent">{ok ? t("copied") : t("copy")}</button>;
}
function Pre({ children }: { children: string }) {
  return <pre dir="ltr" className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-left font-mono text-xs leading-relaxed">{children}</pre>;
}
const inputCls = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function Workbench() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<Lang>("en");
  const t = useMemo(() => { const b = makeT(lang); return (k: string) => L2[k]?.[lang] ?? b(k); }, [lang]);
  const [aiOv, setAiOv] = useState<{ system: string; user: string; changes: string[] } | null>(null);
  const [mode, setMode] = useState<Mode>("quick");
  const [tab, setTab] = useState<Tab>("compiled");
  const [input, setInput] = useState("");
  const [override, setOverride] = useState<Archetype | "">("");
  const [analysis, setAnalysis] = useState<IntentAnalysis | null>(null);
  const [spec, setSpec] = useState<Specification | null>(null);

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; }, [lang]);

  // Debounce spec edits (300 ms) so compile / red-team / evaluation don't run on every keystroke.
  const [dSpec, setDSpec] = useState<Specification | null>(null);
  const pending = spec !== dSpec; void pending;
  useEffect(() => { if (!spec || !dSpec) { setDSpec(spec); return; } const h = setTimeout(() => setDSpec(spec), 300); return () => clearTimeout(h); }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(() => (dSpec && analysis ? compile(dSpec, analysis) : null), [dSpec, analysis]);
  const compiled = useMemo(() => (base && aiOv ? { ...base, system: aiOv.system, user: aiOv.user } : base), [base, aiOv]);
  const report = useMemo(() => (compiled ? redTeam(compiled) : null), [compiled]);
  const evalR = useMemo(() => (compiled && dSpec && analysis ? evaluate(compiled, dSpec!, analysis) : null), [compiled, dSpec, analysis]);

  const run = useCallback(() => {
    if (!input.trim()) return;
