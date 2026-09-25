import { useEffect, useMemo, useState, type ReactNode } from "react";
import { analyzeIntent } from "@/lib/prompt/intentAnalyzer";
import { compile, defaultSpec } from "@/lib/prompt/compiler";
import { redTeam } from "@/lib/prompt/redTeam";
import { evaluate } from "@/lib/prompt/evaluation";
import { registry, diffLines, type PromptAsset, type AuditEntry, type Lifecycle } from "@/lib/prompt/registry";
import { toOpenAI, toAnthropic, toRaw, validateOpenAI, validateAnthropic } from "@/lib/prompt/exporters";
import type { Archetype, Component, IntentAnalysis, Mode, Specification } from "@/lib/prompt/types";
import { makeT, type Lang } from "@/lib/i18n";

const ARCHS: Archetype[] = ["software", "business", "copywriting", "analytics", "agents", "research", "creative", "general"];
const ALL_COMPONENTS: Component[] = ["role", "context", "task", "constraints", "output_contract", "examples", "reasoning", "safety", "variables", "citations", "tools", "evaluation_rubric"];
type Tab = "intent" | "spec" | "compiled" | "security" | "registry";

const riskTone: Record<"low" | "medium" | "high" | "critical", string> = { low: "bg-success/15 text-success", medium: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive", critical: "bg-destructive text-destructive-foreground" };

function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      {title && <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{title}</h3>{right}</div>}
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
  const [lang, setLang] = useState<Lang>("en");
  const t = useMemo(() => makeT(lang), [lang]);
  const [mode, setMode] = useState<Mode>("quick");
  const [tab, setTab] = useState<Tab>("compiled");
  const [input, setInput] = useState("");
  const [override, setOverride] = useState<Archetype | "">("");
  const [analysis, setAnalysis] = useState<IntentAnalysis | null>(null);
  const [spec, setSpec] = useState<Specification | null>(null);

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; }, [lang]);

  const compiled = useMemo(() => (spec && analysis ? compile(spec, analysis) : null), [spec, analysis]);
  const report = useMemo(() => (compiled ? redTeam(compiled) : null), [compiled]);
  const evalR = useMemo(() => (compiled && spec && analysis ? evaluate(compiled, spec, analysis) : null), [compiled, spec, analysis]);

  const run = () => {
    if (!input.trim()) return;
    const a = analyzeIntent(input, override || null);
    setAnalysis(a); setSpec(defaultSpec(input, a)); setTab(mode === "quick" ? "compiled" : "intent");
  };

  const tabs: Tab[] = mode === "quick" ? ["compiled", "security"] : mode === "expert" ? ["intent", "spec", "compiled", "security"] : ["intent", "spec", "compiled", "security", "registry"];
  useEffect(() => { if (!tabs.includes(tab)) setTab("compiled"); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabLabel: Record<Tab, string> = { intent: "tabIntent", spec: "tabSpec", compiled: "tabCompiled", security: "tabSecurity", registry: "tabRegistry" };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">{"{P}"}</div>
            <div><h1 className="font-display text-lg font-semibold leading-tight">{t("appTitle")}</h1><p className="text-xs text-muted-foreground">{t("appSub")}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {(["quick", "expert", "enterprise"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t(m)}</button>
              ))}
            </div>
            <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">{t("lang")}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <Card title={t("describe")}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={7} placeholder={t("placeholder")} className={inputCls} />
            <label className="mt-3 block text-xs text-muted-foreground">{t("archetype")}</label>
            <select value={override} onChange={(e) => setOverride(e.target.value as Archetype | "")} className={`${inputCls} mt-1`}>
              <option value="">{t("auto")}</option>
              {ARCHS.map((a) => <option key={a} value={a}>{t(a)}</option>)}
            </select>
            <button onClick={run} disabled={!input.trim()} className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">{t("generate")}</button>
          </Card>
          {analysis && report && evalR && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t(analysis.archetype)} value={`${Math.round(analysis.confidence * 100)}%`} />
              <Stat label={t("risk")} value={t(analysis.risk)} />
              <Stat label={t("securityScore")} value={`${report.score}`} />
              <Stat label={t("evalScore")} value={`${evalR.overall}`} />
            </div>
          )}
        </aside>

        <div className="min-w-0">
          <nav className="mb-4 flex flex-wrap gap-1 border-b">
            {tabs.map((x) => (
              <button key={x} onClick={() => setTab(x)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t(tabLabel[x])}</button>
            ))}
          </nav>
          {tab === "registry" ? <RegistryPanel t={t} compiled={compiled} score={report?.score ?? 0} archetype={analysis?.archetype ?? "general"} /> :
            !analysis || !spec || !compiled || !report || !evalR ? <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">{t("emptyState")}</div> :
            tab === "intent" ? <IntentPanel a={analysis} t={t} /> :
            tab === "spec" ? <SpecPanel spec={spec} setSpec={setSpec} t={t} /> :
            tab === "compiled" ? <CompiledPanel c={compiled} t={t} /> :
            <SecurityPanel report={report} evalR={evalR} t={t} />}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card p-3"><div className="truncate text-xs text-muted-foreground">{label}</div><div className="font-mono text-xl font-semibold">{value}</div></div>;
}

function IntentPanel({ a, t }: { a: IntentAnalysis; t: (k: string) => string }) {
  const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-end">{v}</span></div>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("tabIntent")}>
        <Row k={t("archetype")} v={t(a.archetype)} />
        <Row k={t("taskType")} v={<code className="font-mono text-xs">{a.taskType}</code>} />
        <Row k={t("confidence")} v={`${Math.round(a.confidence * 100)}%`} />
        <Row k={t("risk")} v={<span className={`rounded px-2 py-0.5 text-xs ${riskTone[a.risk]}`}>{t(a.risk)}</span>} />
        <Row k={t("complexity")} v={t(a.complexity)} />
        <Row k={t("persona")} v={a.persona} />
      </Card>
      <div className="space-y-4">
        <Card title={t("components")}><div className="flex flex-wrap gap-1.5">{a.components.map((c) => <span key={c} className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">{c}</span>)}</div></Card>
        <Card title={t("signals")}>{a.riskSignals.length ? <ul className="list-disc space-y-1 ps-5 text-sm">{a.riskSignals.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("none")}</p>}</Card>
        <Card title={t("keywords")}><p className="font-mono text-xs text-muted-foreground">{a.keywords.join(" · ") || t("none")}</p></Card>
      </div>
    </div>
  );
}

function SpecPanel({ spec, setSpec, t }: { spec: Specification; setSpec: (s: Specification) => void; t: (k: string) => string }) {
  const up = <K extends keyof Specification>(k: K, v: Specification[K]) => setSpec({ ...spec, [k]: v });
  const L = ({ children }: { children: ReactNode }) => <label className="mb-1 block text-xs text-muted-foreground">{children}</label>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("tabSpec")}>
        <div className="space-y-3">
          <div><L>{t("goal")}</L><textarea rows={3} className={inputCls} value={spec.goal} onChange={(e) => up("goal", e.target.value)} /></div>
          <div><L>{t("persona")}</L><input className={inputCls} value={spec.persona} onChange={(e) => up("persona", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>{t("audience")}</L><input className={inputCls} value={spec.audience} onChange={(e) => up("audience", e.target.value)} /></div>
            <div><L>{t("tone")}</L><input className={inputCls} value={spec.tone} onChange={(e) => up("tone", e.target.value)} /></div>
          </div>
          <div><L>{t("constraints")}</L><textarea rows={4} className={inputCls} value={spec.constraints.join("\n")} onChange={(e) => up("constraints", e.target.value.split("\n").filter((l) => l.trim()))} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><L>{t("outputFormat")}</L><select className={inputCls} value={spec.outputFormat} onChange={(e) => up("outputFormat", e.target.value as Specification["outputFormat"])}>{["markdown", "json", "plain", "code", "table"].map((f) => <option key={f}>{f}</option>)}</select></div>
            <div><L>{t("reasoning")}</L><select className={inputCls} value={spec.reasoning} onChange={(e) => up("reasoning", e.target.value as Specification["reasoning"])}>{["none", "brief", "step_by_step"].map((f) => <option key={f}>{f}</option>)}</select></div>
            <div><L>{t("maxWords")}</L><input type="number" className={inputCls} value={spec.maxWords} onChange={(e) => up("maxWords", Number(e.target.value) || 100)} /></div>
          </div>
          <div><L>{t("schema")}</L><textarea dir="ltr" rows={3} className={`${inputCls} font-mono text-xs`} value={spec.outputSchema} onChange={(e) => up("outputSchema", e.target.value)} /></div>
          <div><L>{t("examples")}</L><textarea rows={3} className={inputCls} value={spec.examples} onChange={(e) => up("examples", e.target.value)} /></div>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title={t("components")}>
          <div className="grid grid-cols-2 gap-2">
            {ALL_COMPONENTS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={spec.components.includes(c)} onChange={(e) => up("components", e.target.checked ? [...spec.components, c] : spec.components.filter((x) => x !== c))} className="accent-primary" />
                <span className="font-mono text-xs">{c}</span>
              </label>
            ))}
          </div>
        </Card>
        <Card title={t("variables")} right={<button className="rounded border px-2 py-0.5 text-xs" onClick={() => up("variables", [...spec.variables, { name: `var${spec.variables.length + 1}`, description: "", example: "" }])}>+</button>}>
          <div className="space-y-2">
            {spec.variables.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input dir="ltr" className={`${inputCls} font-mono text-xs`} value={v.name} onChange={(e) => up("variables", spec.variables.map((x, j) => (j === i ? { ...x, name: e.target.value.replace(/\W/g, "") } : x)))} />
                <button className="rounded border px-2 text-xs" onClick={() => up("variables", spec.variables.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CompiledPanel({ c, t }: { c: NonNullable<ReturnType<typeof compile>>; t: (k: string) => string }) {
  const [prov, setProv] = useState<"split" | "openai" | "anthropic" | "raw">("split");
  const oa = toOpenAI(c), an = toAnthropic(c);
  const v = prov === "openai" ? validateOpenAI(oa) : prov === "anthropic" ? validateAnthropic(an) : null;
  const text = prov === "openai" ? JSON.stringify(oa, null, 2) : prov === "anthropic" ? JSON.stringify(an, null, 2) : toRaw(c);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {(["split", "openai", "anthropic", "raw"] as const).map((p) => (
          <button key={p} onClick={() => setProv(p)} className={`rounded-md border px-3 py-1.5 font-mono text-xs ${prov === p ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{p === "split" ? "system / user" : p === "raw" ? t("raw") : p}</button>
        ))}
      </div>
      {prov === "split" ? (
        <>
          <Card title={t("system")} right={<CopyBtn text={c.system} t={t} />}><Pre>{c.system}</Pre></Card>
          <Card title={t("user")} right={<CopyBtn text={c.user} t={t} />}><Pre>{c.user}</Pre></Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title={t("contract")}><Pre>{c.outputContract}</Pre></Card>
            <Card title={t("variables")}><div className="flex flex-wrap gap-1.5">{c.variables.map((x) => <code key={x} className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">{`{{${x}}}`}</code>)}</div></Card>
          </div>
        </>
      ) : (
        <Card title={prov} right={<div className="flex items-center gap-2">{v && <span className={`rounded px-2 py-0.5 text-xs ${v.valid ? riskTone.low : riskTone.high}`}>{v.valid ? t("valid") : t("invalid")}</span>}<CopyBtn text={text} t={t} /></div>}>
          {v && !v.valid && <ul className="mb-2 text-xs text-destructive">{v.errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
          <Pre>{text}</Pre>
        </Card>
      )}
    </div>
  );
}

function SecurityPanel({ report, evalR, t }: { report: ReturnType<typeof redTeam>; evalR: ReturnType<typeof evaluate>; t: (k: string) => string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={`${t("securityScore")} · ${report.score}/100`}>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {report.checks.map((c) => <div key={c.category} className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${c.passed ? "bg-success" : "bg-destructive"}`} /><span className="font-mono">{c.category}</span></div>)}
        </div>
        <h4 className="mb-2 text-xs text-muted-foreground">{t("findings")}</h4>
        {report.findings.length ? <div className="space-y-2">{report.findings.map((f) => (
          <div key={f.rule} className="rounded border p-2 text-sm">
            <div className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${riskTone[f.severity]}`}>{t(f.severity)}</span><code className="font-mono text-xs text-muted-foreground">{f.rule}</code></div>
            <p className="mt-1">{f.detail}</p><p className="text-xs text-muted-foreground">{t("mitigation")}: {f.mitigation}</p>
          </div>))}</div> : <p className="text-sm text-muted-foreground">{t("noFindings")}</p>}
      </Card>
      <div className="space-y-4">
        <Card title={`${t("evalScore")} · ${evalR.overall}/100`}>
          <div className="space-y-2">{evalR.metrics.map((m) => (
            <div key={m.key}><div className="flex justify-between text-xs"><span>{t(m.key)}</span><span className="font-mono">{m.value}</span></div>
              <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${m.value}%` }} /></div></div>))}</div>
        </Card>
        <Card title={t("tokens")}><div className="grid grid-cols-3 gap-2 text-center font-mono">{(["system", "user", "total"] as const).map((k) => <div key={k}><div className="text-lg">{evalR.tokens[k]}</div><div className="text-[10px] text-muted-foreground">{k}</div></div>)}</div></Card>
        <Card title={t("tests")}>
          <div className="space-y-1.5">{evalR.tests.map((x) => (
            <div key={x.name} className="flex items-start justify-between gap-2 text-sm"><div><div>{x.name}</div><div className="text-xs text-muted-foreground">{x.expectation}</div></div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${x.passed ? riskTone.low : riskTone.high}`}>{t(x.passed ? "passed" : "failed")}</span></div>))}</div>
        </Card>
      </div>
    </div>
  );
}

function RegistryPanel({ t, compiled, score, archetype }: { t: (k: string) => string; compiled: ReturnType<typeof compile> | null; score: number; archetype: Archetype }) {
  const [assets, setAssets] = useState<PromptAsset[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [diffFor, setDiffFor] = useState<string | null>(null);
  const sync = (s = registry.read()) => { setAssets(s.assets ?? []); setAudit(s.audit ?? []); };
  useEffect(() => sync(), []);
  const act = (fn: () => ReturnType<typeof registry.read>) => { try { setErr(""); sync(fn()); } catch (e) { setErr((e as Error).message); } };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {compiled && (
          <Card title={t("saveNew")}>
            <div className="flex gap-2"><input className={inputCls} placeholder={t("assetName")} value={name} onChange={(e) => setName(e.target.value)} />
              <button disabled={!name.trim()} onClick={() => { act(() => registry.create(name.trim(), archetype, compiled, score)); setName(""); }} className="shrink-0 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-40">{t("saveNew")}</button></div>
          </Card>
        )}
        {err && <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{err}</div>}
        {!assets.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("empty")}</div>}
        {assets.map((a) => {
          const latest = a.versions[a.versions.length - 1]!;
          return (
            <Card key={a.id} title={`${a.name} · v${latest.version}`} right={<span className="rounded bg-secondary px-2 py-0.5 text-xs">{t(a.status)}</span>}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{t(a.archetype)} · {t("securityScore")} {latest.securityScore}</span>
                {registry.nextStates(a.status).map((s: Lifecycle) => <button key={s} onClick={() => act(() => registry.transition(a.id, s))} className="rounded border px-2 py-1 hover:bg-accent">→ {t(s)}</button>)}
              </div>
              {compiled && a.status !== "deprecated" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input className={`${inputCls} flex-1`} placeholder={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
                  {(["patch", "minor", "major"] as const).map((k) => <button key={k} onClick={() => { act(() => registry.addVersion(a.id, compiled, k, note || k, score)); setNote(""); }} className="rounded border px-2 font-mono text-xs hover:bg-accent">+{k}</button>)}
                  <button onClick={() => setDiffFor(diffFor === a.id ? null : a.id)} className="rounded border px-2 text-xs hover:bg-accent">{t("compare")}</button>
                </div>
              )}
              {diffFor === a.id && compiled && (
                <pre dir="ltr" className="mt-3 max-h-60 overflow-auto rounded bg-muted p-2 text-left font-mono text-xs">
                  {diffLines(toRaw(latest.prompt), toRaw(compiled)).map((d, i) => <div key={i} className={d.t === "+" ? "text-success" : "text-destructive"}>{d.t} {d.l}</div>)}
                  {!diffLines(toRaw(latest.prompt), toRaw(compiled)).length && "No changes"}
                </pre>
              )}
              <div className="mt-3 text-xs text-muted-foreground">{t("versions")}: {a.versions.map((v) => `v${v.version}`).join(" · ")}</div>
            </Card>
          );
        })}
      </div>
      <Card title={t("audit")}>
        <ol className="max-h-[32rem] space-y-2 overflow-auto">
          {[...audit].reverse().map((e) => (
            <li key={e.id} className="border-s-2 border-primary/50 ps-2 text-xs"><div className="font-mono text-muted-foreground">{new Date(e.at).toLocaleString()}</div><div><b>{e.action}</b> — {e.detail}</div></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
