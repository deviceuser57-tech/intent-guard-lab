import { memo, useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import { analyzeIntent } from "@/lib/prompt/intentAnalyzer";
import { compile, defaultSpec, DEFAULT_ADV } from "@/lib/prompt/compiler";
import { redTeam } from "@/lib/prompt/redTeam";
import { evaluate } from "@/lib/prompt/evaluation";
import {
  registry,
  diffLines,
  type PromptAsset,
  type AuditEntry,
  type Lifecycle,
} from "@/lib/prompt/registry";
import {
  toOpenAI,
  toAnthropic,
  toRaw,
  validateOpenAI,
  validateAnthropic,
} from "@/lib/prompt/exporters";
import type {
  AdvancedControls,
  Archetype,
  Component,
  IntentAnalysis,
  Mode,
  Specification,
} from "@/lib/prompt/types";
import { makeT, type Lang } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { gsap } from "gsap";
import { optimizePrompt, runPrompt, judgeOutput } from "@/lib/ai.functions";
import { GuardrailConsole } from "@/components/GuardrailConsole";
import { buildPromptIR, type PromptIRResult } from "@/lib/prompt/ir";

const L2: Record<string, { en: string; ar: string }> = {
  tabPlayground: { en: "Live Playground", ar: "ساحة الاختبار الحية" },
  aiOpt: { en: "AI Optimizer · Auto-Revise", ar: "المحسّن الذكي · مراجعة تلقائية" },
  aiDesc: {
    en: "A live AI model rewrites the prompt using current best practices, fixes security findings and tailors it to the target model.",
    ar: "يعيد نموذج ذكاء اصطناعي كتابة الموجّه وفق أحدث الممارسات ويعالج الملاحظات الأمنية ويكيّفه للنموذج المستهدف.",
  },
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
  execDoc: {
    en: "Complete executive document with ready tables",
    ar: "ملف استراتيجي تنفيذي كامل بجداول جاهزة",
  },
  selfRT: { en: "Internal red-team before answering", ar: "فحص Red-team داخلي قبل الرد" },
  brutal: {
    en: "Brutal honesty (facts even if unwelcome)",
    ar: "الحقيقة الصادمة (حقائق حتى لو لم ترضِ)",
  },
  conf: { en: "Confidence score & calculation method", ar: "درجة الثقة وطريقة الحساب" },
  c_off: { en: "Off", ar: "بدون" },
  c_evidence_weighted: { en: "Evidence-weighted", ar: "مرجّح بقوة الدليل" },
  c_source_count: { en: "Source count", ar: "عدد المصادر" },
  c_bayesian: { en: "Bayesian (prior → posterior)", ar: "بايزي (احتمال قبلي ← بعدي)" },
  docs: {
    en: "Reference documents (.txt .md .csv .json)",
    ar: "مستندات مرجعية (.txt .md .csv .json)",
  },
  docsW: { en: "Answer from documents", ar: "الرد من المستندات" },
  webW: { en: "web / general knowledge", ar: "الإنترنت / المعرفة العامة" },
  noVars: { en: "No variables in this prompt.", ar: "لا توجد متغيرات." },
};

const ARCHS: Archetype[] = [
  "software",
  "business",
  "copywriting",
  "analytics",
  "agents",
  "research",
  "creative",
  "general",
];
const ALL_COMPONENTS: Component[] = [
  "role",
  "context",
  "task",
  "constraints",
  "output_contract",
  "examples",
  "reasoning",
  "safety",
  "variables",
  "citations",
  "tools",
  "evaluation_rubric",
];
type Tab = "intent" | "spec" | "compiled" | "security" | "playground" | "registry" | "guardrails";

const riskTone: Record<"low" | "medium" | "high" | "critical", string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

function Card({
  title,
  children,
  right,
}: {
  title?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="glass-card rounded-lg border bg-card/80 backdrop-blur-lg border-white/20 p-4 shadow-xl">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
function CopyBtn({ text, t }: { text: string; t: (k: string) => string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      className="rounded border px-2 py-1 font-mono text-xs hover:bg-accent"
    >
      {ok ? t("copied") : t("copy")}
    </button>
  );
}
function Pre({ children }: { children: string }) {
  return (
    <pre
      dir="ltr"
      className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-left font-mono text-xs leading-relaxed"
    >
      {children}
    </pre>
  );
}
const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function Workbench() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<Lang>("en");
  const t = useMemo(() => {
    const b = makeT(lang);
    const fixedEnglishLabels = new Set([
      "tabIntent", "tabSpec", "tabCompiled", "tabSecurity", "tabRegistry",
      "taskType", "risk", "complexity", "confidence", "persona", "components",
      "signals", "keywords", "goal", "audience", "tone", "constraints",
      "outputFormat", "schema", "examples", "reasoning", "maxWords", "variables",
      "system", "user", "contract", "archetype", "target",
    ]);
    return (k: string) =>
      fixedEnglishLabels.has(k) ? makeT("en")(k) : L2[k]?.[lang] ?? b(k);
  }, [lang]);
  const [aiOv, setAiOv] = useState<{ system: string; user: string; changes: string[] } | null>(
    null,
  );
  const [mode, setMode] = useState<Mode>("quick");
  const [tab, setTab] = useState<Tab>("compiled");
  const [input, setInput] = useState("");
  const [override, setOverride] = useState<Archetype | "">("");
  const [analysis, setAnalysis] = useState<IntentAnalysis | null>(null);
  const [spec, setSpec] = useState<Specification | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Debounce spec edits (300 ms) so compile / red-team / evaluation don't run on every keystroke.
  const [dSpec, setDSpec] = useState<Specification | null>(null);
  const pending = spec !== dSpec;
  void pending;
  useEffect(() => {
    if (!spec || !dSpec) {
      setDSpec(spec);
      return;
    }
    const h = setTimeout(() => setDSpec(spec), 300);
    return () => clearTimeout(h);
  }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(
    () => (dSpec && analysis ? compile(dSpec, analysis) : null),
    [dSpec, analysis],
  );
  const compiled = useMemo(
    () => (base && aiOv ? { ...base, system: aiOv.system, user: aiOv.user } : base),
    [base, aiOv],
  );
  const report = useMemo(() => (compiled ? redTeam(compiled) : null), [compiled]);
  const evalR = useMemo(
    () => (compiled && dSpec && analysis ? evaluate(compiled, dSpec!, analysis) : null),
    [compiled, dSpec, analysis],
  );
  const governance = useMemo(
    () => (dSpec ? buildPromptIR(dSpec.goal || input, dSpec, lang === "ar" ? "ar" : "en") : null),
    [dSpec, input, lang],
  );

  const run = useCallback(() => {
    if (!input.trim()) return;
    const a = analyzeIntent(input, override || null);
    const sp = defaultSpec(input, a);
    setAiOv(null);
    setAnalysis(a);
    setSpec(sp);
    setDSpec(sp);
    setTab(mode === "quick" ? "compiled" : "intent");
  }, [input, override, mode]);

  // Core analysis and registry panels are available in every mode.
  const tabs: Tab[] = [
    "intent",
    "spec",
    "compiled",
    "security",
    "playground",
    "registry",
    "guardrails",
  ];
  useEffect(() => {
    if (!tabs.includes(tab)) setTab("compiled");
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabLabel: Record<Tab, string> = {
    intent: "Intent Analysis",
    spec: "Specification",
    compiled: "Compiled Prompts",
    security: "Security / Validation",
    playground: "Playground",
    registry: "Prompt Registry",
    guardrails: "Guardrails",
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground">
      <header ref={headerRef} className="border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">
              {"{P}"}
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight">{t("appTitle")}</h1>
              <p className="text-xs text-muted-foreground">{t("appSub")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {(["quick", "expert", "enterprise"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded px-3 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t(m)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              {t("lang")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <Card title={t("describe")}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={7}
              placeholder={t("placeholder")}
              className={inputCls}
            />
            <label className="mt-3 block text-xs text-muted-foreground">{t("archetype")}</label>
            <select
              value={override}
              onChange={(e) => setOverride(e.target.value as Archetype | "")}
              className={`${inputCls} mt-1`}
            >
              <option value="">{t("auto")}</option>
              {ARCHS.map((a) => (
                <option key={a} value={a}>
                  {t(a)}
                </option>
              ))}
            </select>
            <button
              onClick={run}
              disabled={!input.trim()}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {t("generate")}
            </button>
          </Card>
          {analysis && report && evalR && (
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={t(analysis.archetype)}
                value={`${Math.round(analysis.confidence * 100)}%`}
              />
              <Stat label={t("risk")} value={t(analysis.risk)} />
              <Stat label={t("securityScore")} value={`${report.score}`} />
              <Stat label={t("evalScore")} value={`${evalR.overall}`} />
            </div>
          )}
        </aside>

        <div className="min-w-0">
          <nav className="mb-4 flex flex-wrap gap-1 border-b">
            {tabs.map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {tabLabel[x]}
              </button>
            ))}
          </nav>
          {tab === "registry" ? (
            <RegistryPanel
              t={t}
              compiled={compiled}
              score={report?.score ?? 0}
              archetype={analysis?.archetype ?? "general"}
            />
          ) : tab === "guardrails" ? (
            <GuardrailConsole
              input={input}
              findings={report?.findings.map((f) => `${f.rule}: ${f.detail}`) ?? []}
              {...(analysis ? { risk: analysis.risk } : {})}
              {...(evalR ? { evaluationScore: evalR.overall } : {})}
              {...(compiled ? { systemPrompt: compiled.system, userPrompt: compiled.user } : {})}
            />
          ) : !analysis || !spec || !compiled || !report || !evalR ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              {t("emptyState")}
            </div>
          ) : tab === "intent" ? (
            <IntentPanel a={analysis} t={t} />
          ) : tab === "spec" ? (
            <SpecPanel spec={spec} setSpec={setSpec} t={t} />
          ) : tab === "compiled" ? (
            <div className="space-y-4">
              {governance && <GovernancePanels result={governance} lang={lang} />}
              <AiOptimizer
                c={compiled}
                findings={report.findings.map((f) => `${f.rule}: ${f.detail}`)}
                ov={aiOv}
                setOv={setAiOv}
                t={t}
              />
              <CompiledPanel c={compiled} t={t} />
            </div>
          ) : tab === "playground" ? (
            <div className="space-y-4">
              <Playground c={compiled} t={t} />
              {governance && <GovernancePanels result={governance} lang={lang} />}
            </div>
          ) : (
            <SecurityPanel report={report} evalR={evalR} t={t} />
          )}
        </div>
      </main>
    </div>
  );
}

function GovernancePanels({ result, lang }: { result: PromptIRResult; lang: Lang }) {
  const ar = lang === "ar";
  const { findings, readiness } = result;
  const gate = readiness.releaseGate;
  const gateStyle =
    gate === "ready"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : gate === "blocked"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  const gateLabel = gate === "ready" ? "READY" : gate === "blocked" ? "BLOCKED" : "NEEDS_REVIEW";
  const categoryLabel: Record<string, string> = {
    structural: ar ? "البنية" : "Structure",
    semantic: ar ? "الإسناد والمعنى" : "Grounding",
    security: ar ? "الأمان" : "Security",
    operational: ar ? "التنسيق والتشغيل" : "Formatting / Operations",
  };
  const severityStyle: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-destructive/15 text-destructive",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    low: "bg-secondary text-secondary-foreground",
    info: "bg-muted text-muted-foreground",
  };
  return (
    <div className="space-y-4">
      <Card
        title="Decision Engine"
        right={
          <span className="rounded bg-secondary px-2 py-1 text-xs">
            {result.decisions.length} {ar ? "قرار مكوّن" : "component decisions"}
          </span>
        }
      >
        <div className="space-y-2">
          {result.decisions.map((decision) => (
            <div
              key={decision.component}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
            >
              <div className="min-w-0">
                <code className="text-xs">{decision.component}</code>
                <p className="mt-1 text-sm text-muted-foreground">{decision.reason}</p>
              </div>
              <span className="rounded bg-secondary px-2 py-1 text-xs uppercase">
                {decision.status}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card
        title={ar ? "فحص الموجّه والسياسات" : "Prompt Linter & Policy Findings"}
        right={
          <span className="rounded bg-secondary px-2 py-1 text-xs">
            {findings.length} {ar ? "ملاحظة" : "findings"}
          </span>
        }
      >
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {ar
              ? "لم يرصد الفاحص أي ملاحظات من القواعد الحالية."
              : "No findings were raised by the current rules."}
          </p>
        ) : (
          <div className="space-y-2">
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                    {categoryLabel[finding.category] ?? finding.category}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] uppercase ${severityStyle[finding.severity] ?? severityStyle["info"]}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {finding.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-2 text-sm">{finding.message}</p>
                {finding.affectedComponent && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ar ? "المكوّن" : "Component"}: <code>{finding.affectedComponent}</code>
                  </p>
                )}
                {finding.suggestedCorrection && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {ar ? "الإصلاح المقترح:" : "Suggested fix:"}
                    </span>{" "}
                    {finding.suggestedCorrection}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card
        title={ar ? "جاهزية الإصدار" : "Production Readiness Release Gate"}
        right={
          <span
            className={`rounded-md border px-3 py-1.5 font-mono text-xs font-bold tracking-wide ${gateStyle}`}
          >
            {gateLabel}
          </span>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {ar
            ? "تقييم قواعد ثابتة؛ لا يعني أن اختبارات التنفيذ أو Red Team قد شُغّلت."
            : "Rule-based assessment only; this does not mean execution tests or red-team runs have been performed."}
        </p>
        <div className="space-y-3">
          {readiness.dimensions.map((dimension) => (
            <div key={dimension.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span>{dimension.name}</span>
                <span className="font-mono text-xs">
                  {dimension.value === undefined
                    ? ar
                      ? "غير مقاس"
                      : "Not scored"
                    : `${Math.round(dimension.value)}/100`}{" "}
                  · {dimension.status}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${Math.max(0, Math.min(100, dimension.value ?? 0))}%` }}
                />
              </div>
              {dimension.evidence.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {dimension.evidence.slice(0, 2).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
        {(readiness.blockingReasons?.length ?? 0) > 0 && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <h4 className="mb-1 text-sm font-semibold">
              {ar ? "أسباب المنع أو المراجعة" : "Blockers / review reasons"}
            </h4>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {readiness.blockingReasons!.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {ar ? "حالة التقييم:" : "Assessment state:"} <code>{readiness.overallState}</code> ·{" "}
          {ar ? "آخر تقييم:" : "Assessed at:"} {new Date(readiness.assessedAt).toLocaleString()}
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
    </div>
  );
}

const IntentPanel = memo(function IntentPanel({
  a,
  t,
}: {
  a: IntentAnalysis;
  t: (k: string) => string;
}) {
  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-end">{v}</span>
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("tabIntent")}>
        <Row k={t("archetype")} v={t(a.archetype)} />
        <Row k={t("taskType")} v={<code className="font-mono text-xs">{a.taskType}</code>} />
        <Row k={t("confidence")} v={`${Math.round(a.confidence * 100)}%`} />
        <Row
          k={t("risk")}
          v={<span className={`rounded px-2 py-0.5 text-xs ${riskTone[a.risk]}`}>{t(a.risk)}</span>}
        />
        <Row k={t("complexity")} v={t(a.complexity)} />
        <Row k={t("persona")} v={a.persona} />
      </Card>
      <div className="space-y-4">
        <Card title={t("components")}>
          <div className="flex flex-wrap gap-1.5">
            {a.components.map((c) => (
              <span key={c} className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">
                {c}
              </span>
            ))}
          </div>
        </Card>
        <Card title={t("signals")}>
          {a.riskSignals.length ? (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {a.riskSignals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          )}
        </Card>
        <Card title={t("keywords")}>
          <p className="font-mono text-xs text-muted-foreground">
            {a.keywords.join(" · ") || t("none")}
          </p>
        </Card>
      </div>
    </div>
  );
});

const SpecPanel = memo(function SpecPanel({
  spec,
  setSpec,
  t,
}: {
  spec: Specification;
  setSpec: (s: Specification) => void;
  t: (k: string) => string;
}) {
  const up = useCallback(
    <K extends keyof Specification>(k: K, v: Specification[K]) => setSpec({ ...spec, [k]: v }),
    [spec, setSpec],
  );
  const L = ({ children }: { children: ReactNode }) => (
    <label className="mb-1 block text-xs text-muted-foreground">{children}</label>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("tabSpec")}>
        <div className="space-y-3">
          <div>
            <L>{t("goal")}</L>
            <textarea
              rows={3}
              className={inputCls}
              value={spec.goal}
              onChange={(e) => up("goal", e.target.value)}
            />
          </div>
          <div>
            <L>{t("persona")}</L>
            <input
              className={inputCls}
              value={spec.persona}
              onChange={(e) => up("persona", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <L>{t("audience")}</L>
              <input
                className={inputCls}
                value={spec.audience}
                onChange={(e) => up("audience", e.target.value)}
              />
            </div>
            <div>
              <L>{t("tone")}</L>
              <input
                className={inputCls}
                value={spec.tone}
                onChange={(e) => up("tone", e.target.value)}
              />
            </div>
          </div>
          <div>
            <L>{t("constraints")}</L>
            <textarea
              rows={4}
              className={inputCls}
              value={spec.constraints.join("\n")}
              onChange={(e) =>
                up(
                  "constraints",
                  e.target.value.split("\n").filter((l) => l.trim()),
                )
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <L>{t("outputFormat")}</L>
              <select
                className={inputCls}
                value={spec.outputFormat}
                onChange={(e) =>
                  up("outputFormat", e.target.value as Specification["outputFormat"])
                }
              >
                {["markdown", "json", "plain", "code", "table"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <L>{t("reasoning")}</L>
              <select
                className={inputCls}
                value={spec.reasoning}
                onChange={(e) => up("reasoning", e.target.value as Specification["reasoning"])}
              >
                {["none", "brief", "step_by_step"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <L>{t("maxWords")}</L>
              <input
                type="number"
                className={inputCls}
                value={spec.maxWords}
                onChange={(e) => up("maxWords", Number(e.target.value) || 100)}
              />
            </div>
          </div>
          <div>
            <L>{t("schema")}</L>
            <textarea
              dir="ltr"
              rows={3}
              className={`${inputCls} font-mono text-xs`}
              value={spec.outputSchema}
              onChange={(e) => up("outputSchema", e.target.value)}
            />
          </div>
          <div>
            <L>{t("examples")}</L>
            <textarea
              rows={3}
              className={inputCls}
              value={spec.examples}
              onChange={(e) => up("examples", e.target.value)}
            />
          </div>
        </div>
      </Card>
      <div className="space-y-4">
        <AdvancedCard adv={spec.advanced ?? DEFAULT_ADV} set={(v) => up("advanced", v)} t={t} />
        <Card title={t("components")}>
          <div className="grid grid-cols-2 gap-2">
            {ALL_COMPONENTS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={spec.components.includes(c)}
                  onChange={(e) =>
                    up(
                      "components",
                      e.target.checked
                        ? [...spec.components, c]
                        : spec.components.filter((x) => x !== c),
                    )
                  }
                  className="accent-primary"
                />
                <span className="font-mono text-xs">{c}</span>
              </label>
            ))}
          </div>
        </Card>
        <Card
          title={t("variables")}
          right={
            <button
              className="rounded border px-2 py-0.5 text-xs"
              onClick={() =>
                up("variables", [
                  ...spec.variables,
                  { name: `var${spec.variables.length + 1}`, description: "", example: "" },
                ])
              }
            >
              +
            </button>
          }
        >
          <div className="space-y-2">
            {spec.variables.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  dir="ltr"
                  className={`${inputCls} font-mono text-xs`}
                  value={v.name}
                  onChange={(e) =>
                    up(
                      "variables",
                      spec.variables.map((x, j) =>
                        j === i ? { ...x, name: e.target.value.replace(/\W/g, "") } : x,
                      ),
                    )
                  }
                />
                <button
                  className="rounded border px-2 text-xs"
                  onClick={() =>
                    up(
                      "variables",
                      spec.variables.filter((_, j) => j !== i),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
});

const CompiledPanel = memo(function CompiledPanel({
  c,
  t,
}: {
  c: NonNullable<ReturnType<typeof compile>>;
  t: (k: string) => string;
}) {
  const [prov, setProv] = useState<"split" | "openai" | "anthropic" | "raw">("split");
  const oa = toOpenAI(c),
    an = toAnthropic(c);
  const v =
    prov === "openai" ? validateOpenAI(oa) : prov === "anthropic" ? validateAnthropic(an) : null;
  const text =
    prov === "openai"
      ? JSON.stringify(oa, null, 2)
      : prov === "anthropic"
        ? JSON.stringify(an, null, 2)
        : toRaw(c);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {(["split", "openai", "anthropic", "raw"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setProv(p)}
            className={`rounded-md border px-3 py-1.5 font-mono text-xs ${prov === p ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {p === "split" ? "system / user" : p === "raw" ? t("raw") : p}
          </button>
        ))}
      </div>
      {prov === "split" ? (
        <>
          <Card title={t("system")} right={<CopyBtn text={c.system} t={t} />}>
            <Pre>{c.system}</Pre>
          </Card>
          <Card title={t("user")} right={<CopyBtn text={c.user} t={t} />}>
            <Pre>{c.user}</Pre>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={t("contract")}>
              <Pre>{c.outputContract}</Pre>
            </Card>
            <Card title={t("variables")}>
              <div className="flex flex-wrap gap-1.5">
                {c.variables.map((x) => (
                  <code
                    key={x}
                    className="rounded bg-secondary px-2 py-0.5 font-mono text-xs"
                  >{`{{${x}}}`}</code>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card
          title={prov}
          right={
            <div className="flex items-center gap-2">
              {v && (
                <span
                  className={`rounded px-2 py-0.5 text-xs ${v.valid ? riskTone.low : riskTone.high}`}
                >
                  {v.valid ? t("valid") : t("invalid")}
                </span>
              )}
              <CopyBtn text={text} t={t} />
            </div>
          }
        >
          {v && !v.valid && (
            <ul className="mb-2 text-xs text-destructive">
              {v.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
          <Pre>{text}</Pre>
        </Card>
      )}
    </div>
  );
});

const SecurityPanel = memo(function SecurityPanel({
  report,
  evalR,
  t,
}: {
  report: ReturnType<typeof redTeam>;
  evalR: ReturnType<typeof evaluate>;
  t: (k: string) => string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={`${t("securityScore")} · ${report.score}/100`}>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {report.checks.map((c) => (
            <div key={c.category} className="flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${c.passed ? "bg-success" : "bg-destructive"}`}
              />
              <span className="font-mono">{c.category}</span>
            </div>
          ))}
        </div>
        <h4 className="mb-2 text-xs text-muted-foreground">{t("findings")}</h4>
        {report.findings.length ? (
          <div className="space-y-2">
            {report.findings.map((f) => (
              <div key={f.rule} className="rounded border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${riskTone[f.severity]}`}
                  >
                    {t(f.severity)}
                  </span>
                  <code className="font-mono text-xs text-muted-foreground">{f.rule}</code>
                </div>
                <p className="mt-1">{f.detail}</p>
                <p className="text-xs text-muted-foreground">
                  {t("mitigation")}: {f.mitigation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noFindings")}</p>
        )}
      </Card>
      <div className="space-y-4">
        <Card title={`${t("evalScore")} · ${evalR.overall}/100`}>
          <div className="space-y-2">
            {evalR.metrics.map((m) => (
              <div key={m.key}>
                <div className="flex justify-between text-xs">
                  <span>{t(m.key)}</span>
                  <span className="font-mono">{m.value}</span>
                </div>
                <div className="h-1.5 rounded bg-muted">
                  <div className="h-1.5 rounded bg-primary" style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("tokens")}>
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            {(["system", "user", "total"] as const).map((k) => (
              <div key={k}>
                <div className="text-lg">{evalR.tokens[k]}</div>
                <div className="text-[10px] text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("tests")}>
          <div className="space-y-1.5">
            {evalR.tests.map((x) => (
              <div key={x.name} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <div>{x.name}</div>
                  <div className="text-xs text-muted-foreground">{x.expectation}</div>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs ${x.passed ? riskTone.low : riskTone.high}`}
                >
                  {t(x.passed ? "passed" : "failed")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
});

function RegistryPanel({
  t,
  compiled,
  score,
  archetype,
}: {
  t: (k: string) => string;
  compiled: ReturnType<typeof compile> | null;
  score: number;
  archetype: Archetype;
}) {
  const [assets, setAssets] = useState<PromptAsset[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [diffFor, setDiffFor] = useState<string | null>(null);
  const sync = (s = registry.read()) => {
    setAssets(s.assets ?? []);
    setAudit(s.audit ?? []);
  };
  useEffect(() => sync(), []);
  const act = (fn: () => ReturnType<typeof registry.read>) => {
    try {
      setErr("");
      sync(fn());
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {compiled && (
          <Card title={t("saveNew")}>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder={t("assetName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                disabled={!name.trim()}
                onClick={() => {
                  act(() => registry.create(name.trim(), archetype, compiled, score));
                  setName("");
                }}
                className="shrink-0 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-40"
              >
                {t("saveNew")}
              </button>
            </div>
          </Card>
        )}
        {err && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {err}
          </div>
        )}
        {!assets.length && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}
        {assets.map((a) => {
          const latest = a.versions[a.versions.length - 1]!;
          return (
            <Card
              key={a.id}
              title={`${a.name} · v${latest.version}`}
              right={
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">{t(a.status)}</span>
              }
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {t(a.archetype)} · {t("securityScore")} {latest.securityScore}
                </span>
                {registry.nextStates(a.status).map((s: Lifecycle) => (
                  <button
                    key={s}
                    onClick={() => act(() => registry.transition(a.id, s))}
                    className="rounded border px-2 py-1 hover:bg-accent"
                  >
                    → {t(s)}
                  </button>
                ))}
              </div>
              {compiled && a.status !== "deprecated" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder={t("note")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {(["patch", "minor", "major"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        act(() => registry.addVersion(a.id, compiled, k, note || k, score));
                        setNote("");
                      }}
                      className="rounded border px-2 font-mono text-xs hover:bg-accent"
                    >
                      +{k}
                    </button>
                  ))}
                  <button
                    onClick={() => setDiffFor(diffFor === a.id ? null : a.id)}
                    className="rounded border px-2 text-xs hover:bg-accent"
                  >
                    {t("compare")}
                  </button>
                </div>
              )}
              {diffFor === a.id && compiled && (
                <pre
                  dir="ltr"
                  className="mt-3 max-h-60 overflow-auto rounded bg-muted p-2 text-left font-mono text-xs"
                >
                  {diffLines(toRaw(latest.prompt), toRaw(compiled)).map((d, i) => (
                    <div key={i} className={d.t === "+" ? "text-success" : "text-destructive"}>
                      {d.t} {d.l}
                    </div>
                  ))}
                  {!diffLines(toRaw(latest.prompt), toRaw(compiled)).length && "No changes"}
                </pre>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                {t("versions")}: {a.versions.map((v) => `v${v.version}`).join(" · ")}
              </div>
            </Card>
          );
        })}
      </div>
      <Card title={t("audit")}>
        <ol className="max-h-[32rem] space-y-2 overflow-auto">
          {[...audit].reverse().map((e) => (
            <li key={e.id} className="border-s-2 border-primary/50 ps-2 text-xs">
              <div className="font-mono text-muted-foreground">
                {new Date(e.at).toLocaleString()}
              </div>
              <div>
                <b>{e.action}</b> — {e.detail}
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function AiOptimizer({
  c,
  findings,
  ov,
  setOv,
  t,
}: {
  c: NonNullable<ReturnType<typeof compile>>;
  findings: string[];
  ov: { changes: string[] } | null;
  setOv: (v: { system: string; user: string; changes: string[] } | null) => void;
  t: (k: string) => string;
}) {
  const opt = useServerFn(optimizePrompt);
  const [target, setTarget] = useState<"openai" | "anthropic" | "reasoning">("openai");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const go = async (rounds: number) => {
    setErr("");
    let cur = { system: c.system, user: c.user };
    const all: string[] = [];
    try {
      for (let i = 0; i < rounds; i++) {
        setBusy(`${t("working")} ${rounds > 1 ? `${i + 1}/${rounds}` : ""}`);
        const r = await opt({ data: { ...cur, findings: i === 0 ? findings : [], target } });
        if (!r.ok) {
          setErr(r.error);
          break;
        }
        cur = { system: r.system, user: r.user };
        all.push(...r.changes.map((x) => (rounds > 1 ? `[${i + 1}] ${x}` : x)));
        setOv({ ...cur, changes: [...all] });
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy("");
  };
  return (
    <Card
      title={t("aiOpt")}
      right={
        ov && (
          <button
            onClick={() => setOv(null)}
            className="rounded border px-2 py-1 text-xs hover:bg-accent"
          >
            {t("revert")}
          </button>
        )
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">{t("aiDesc")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as typeof target)}
          className={`${inputCls} w-auto`}
          aria-label={t("target")}
        >
          <option value="openai">OpenAI GPT</option>
          <option value="anthropic">Anthropic Claude (XML)</option>
          <option value="reasoning">Reasoning models</option>
        </select>
        <button
          disabled={!!busy}
          onClick={() => go(1)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          {t("optimize")}
        </button>
        <button
          disabled={!!busy}
          onClick={() => go(3)}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-40"
        >
          {t("evolve")}
        </button>
        {busy && <span className="text-xs text-muted-foreground">{busy}</span>}
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {ov && ov.changes.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs text-muted-foreground">{t("changes")}</h4>
          <ul className="list-disc space-y-0.5 ps-5 text-sm">
            {ov.changes.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Playground({
  c,
  t,
}: {
  c: NonNullable<ReturnType<typeof compile>>;
  t: (k: string) => string;
}) {
  const run = useServerFn(runPrompt);
  const judge = useServerFn(judgeOutput);
  const vars = useMemo(
    () =>
      Array.from(
        new Set([...`${c.system}\n${c.user}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!)),
      ),
    [c],
  );
  const [vals, setVals] = useState<Record<string, string>>({});
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [j, setJ] = useState<{ score: number; verdict: string; issues: string[] } | null>(null);
  const sub = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vals[k] ?? `{{${k}}}`);
  const go = async () => {
    setBusy(true);
    setErr("");
    setOut("");
    setJ(null);
    try {
      const system = sub(c.system),
        user = sub(c.user);
      const r = await run({ data: { system, user } });
      if (!r.ok) setErr(r.error);
      else {
        setOut(r.text);
        const g = await judge({ data: { system, user, output: r.text } });
        if (g.ok) setJ(g);
        else setErr(g.error);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <Card title={t("fillVars")}>
        <div className="space-y-2">
          {vars.length ? (
            vars.map((v) => (
              <div key={v}>
                <label className="mb-1 block font-mono text-xs text-muted-foreground">{`{{${v}}}`}</label>
                <input
                  className={inputCls}
                  value={vals[v] ?? ""}
                  onChange={(e) => setVals({ ...vals, [v]: e.target.value })}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("noVars")}</p>
          )}
        </div>
        <button
          disabled={busy}
          onClick={go}
          className="mt-4 w-full rounded-md bg-primary py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          {busy ? t("working") : t("runLive")}
        </button>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </Card>
      <div className="space-y-4">
        <Card title={t("output")} right={out ? <CopyBtn text={out} t={t} /> : undefined}>
          {out ? <Pre>{out}</Pre> : <p className="text-sm text-muted-foreground">—</p>}
        </Card>
        {j && (
          <Card title={`${t("judge")} · ${j.score}/100`}>
            <p className="text-sm">{j.verdict}</p>
            {j.issues.length > 0 && (
              <ul className="mt-2 list-disc ps-5 text-sm text-muted-foreground">
                {j.issues.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function AdvancedCard({
  adv,
  set,
  t,
}: {
  adv: AdvancedControls;
  set: (a: AdvancedControls) => void;
  t: (k: string) => string;
}) {
  const up = <K extends keyof AdvancedControls>(k: K, v: AdvancedControls[K]) =>
    set({ ...adv, [k]: v });
  const chk = (k: "executiveDoc" | "selfRedTeam" | "brutalTruth", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary"
        checked={adv[k]}
        onChange={(e) => up(k, e.target.checked)}
      />
      {label}
    </label>
  );
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const read = await Promise.all(
      Array.from(files).map(async (f) => ({
        name: f.name,
        content: (await f.text()).slice(0, 80000),
      })),
    );
    up("documents", [...adv.documents, ...read]);
  };
  return (
    <Card title={t("adv")}>
      <div className="space-y-3">
        {chk("executiveDoc", t("execDoc"))}
        {chk("selfRedTeam", t("selfRT"))}
        {chk("brutalTruth", t("brutal"))}
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("conf")}</p>
          <div className="grid grid-cols-2 gap-1">
            {(["off", "evidence_weighted", "source_count", "bayesian"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="conf"
                  className="accent-primary"
                  checked={adv.confidence === m}
                  onChange={() => up("confidence", m)}
                />
                {t(`c_${m}`)}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("docs")}</p>
          <input
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,text/*"
            className="text-xs"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {adv.documents.length > 0 && (
            <>
              <ul className="mt-2 space-y-1">
                {adv.documents.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border px-2 py-1 text-xs"
                  >
                    <span className="truncate">
                      {d.name} · {Math.ceil(d.content.length / 4)} tok
                    </span>
                    <button
                      onClick={() =>
                        up(
                          "documents",
                          adv.documents.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={adv.docsWeight}
                  onChange={(e) => up("docsWeight", Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs">
                  {t("docsW")}: <b>{adv.docsWeight}%</b> · {t("webW")}:{" "}
                  <b>{100 - adv.docsWeight}%</b>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
