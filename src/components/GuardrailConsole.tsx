import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runPrompt } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";

type LogLevel = "info" | "high-risk" | "intent-drift" | "policy-violation";
type AuditLog = { id: string; time: string; level: LogLevel; message: string; source: string };
type Policy = { id: string; name: string; mode: "natural" | "json"; content: string; enabled: boolean };
const STORAGE_KEY = "intentguard.custom-policies.v1";
const defaultPolicy = [
  "{",
  '  "name": "Protect sensitive data",',
  '  "rules": [',
  '    { "id": "no-secrets", "description": "Do not expose credentials, API keys, or private tokens", "action": "block" },',
  '    { "id": "human-review", "description": "Require human review for high-impact actions", "action": "review" }',
  "  ]",
  "}",
].join("\n");
const levelLabel: Record<LogLevel, string> = { info: "Info", "high-risk": "High risk", "intent-drift": "Intent drift", "policy-violation": "Policy violation" };
function downloadFile(name: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function csvCell(value: string) { return '"' + value.replace(/"/g, '""') + '"'; }
function scoreOutput(value: string, policyText: string) {
  const text = value.toLowerCase();
  const terms = Array.from(policyText.matchAll(/"(?:description|term|pattern)"\s*:\s*"([^"]+)"/g)).map((m) => m[1] ?? "").filter(Boolean);
  const matched = terms.filter((term) => text.includes(term.toLowerCase()));
  const score = Math.max(0, Math.min(100, 70 + Math.min(20, Math.floor(value.length / 120)) - matched.length * 25 - (value.trim() ? 0 : 70)));
  return { score, matched, verdict: matched.length ? "Review required: configured policy phrase matched." : value.trim() ? "No configured phrase matched; not a safety certification." : "No output provided." };
}
function initialLogs(): AuditLog[] {
  return [
    { id: "demo-1", time: new Date().toISOString(), level: "info", message: "Console initialized. These are sample events, not production telemetry.", source: "local demo" },
    { id: "demo-2", time: new Date(Date.now() - 42000).toISOString(), level: "intent-drift", message: "Example drift event: requested intent differs from evaluated action.", source: "local demo" },
    { id: "demo-3", time: new Date(Date.now() - 83000).toISOString(), level: "policy-violation", message: "Example policy event requiring review against configured boundaries.", source: "local demo" },
  ];
}

export function GuardrailConsole({ input, risk, findings, evaluationScore, systemPrompt, userPrompt }: {
  input: string; risk?: string; findings: string[]; evaluationScore?: number; systemPrompt?: string; userPrompt?: string;
}) {
  const queryClient = useQueryClient();
  const runAI = useServerFn(runPrompt);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => { setLogs(initialLogs()); }, []);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<"all" | LogLevel>("all");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamState, setStreamState] = useState("Disconnected");
  const [policyName, setPolicyName] = useState("Protect sensitive data");
  const [policyMode, setPolicyMode] = useState<"natural" | "json">("json");
  const [policyText, setPolicyText] = useState(defaultPolicy);
  const [policyError, setPolicyError] = useState("");
  const [driftThreshold, setDriftThreshold] = useState(20);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [alertStatus, setAlertStatus] = useState("");
  const [sandboxSystem, setSandboxSystem] = useState(systemPrompt ?? "You are a careful assistant. Follow the user's request and configured policies.");
  const [sandboxUser, setSandboxUser] = useState(userPrompt ?? input);
  const [sandboxOutput, setSandboxOutput] = useState("");
  const [sandboxError, setSandboxError] = useState("");
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [modelOutputs, setModelOutputs] = useState(["", "", ""]);
  const [activeFlow, setActiveFlow] = useState(0);

  const policyQuery = useQuery<Policy[]>({
    queryKey: ["intentguard", "policies"],
    queryFn: async () => {
      if (typeof window === "undefined") return [];
      try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Policy[]; } catch { return []; }
    },
    staleTime: 30000,
  });
  const savePolicy = useMutation({
    mutationFn: async (policy: Policy) => {
      const current = queryClient.getQueryData<Policy[]>(["intentguard", "policies"]) ?? [];
      const next = [...current.filter((p) => p.id !== policy.id), policy];
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },
    onMutate: async (policy) => {
      await queryClient.cancelQueries({ queryKey: ["intentguard", "policies"] });
      const previous = queryClient.getQueryData<Policy[]>(["intentguard", "policies"]) ?? [];
      queryClient.setQueryData<Policy[]>(["intentguard", "policies"], [...previous.filter((p) => p.id !== policy.id), policy]);
      return { previous };
    },
    onError: (_error, _policy, context) => queryClient.setQueryData(["intentguard", "policies"], context?.previous ?? []),
    onSuccess: (next) => queryClient.setQueryData(["intentguard", "policies"], next),
  });
  const savedPolicies = policyQuery.data ?? [];
  const activePolicies = savedPolicies.filter((p) => p.enabled);
  const driftRate = risk === "high" || risk === "critical" ? 35 : findings.length ? 22 : 8;
  const filteredLogs = useMemo(() => logs.filter((log) => (level === "all" || log.level === level) && (log.message + " " + log.source + " " + log.level).toLowerCase().includes(search.toLowerCase())), [logs, level, search]);
  const matrix = useMemo(() => modelOutputs.map((output, i) => ({ name: ["Model A", "Model B", "Model C"][i]!, ...scoreOutput(output, policyText) })), [modelOutputs, policyText]);

  useEffect(() => {
    if (!streamUrl.trim()) { setStreamState("Disconnected"); return; }
    let source: EventSource | undefined;
    try {
      source = new EventSource(streamUrl);
      source.onopen = () => setStreamState("Connected to SSE");
      source.onerror = () => setStreamState("SSE connection error / reconnecting");
      source.onmessage = (event) => {
        let parsed: Partial<AuditLog> = {};
        try { parsed = JSON.parse(event.data) as Partial<AuditLog>; } catch { /* plain-text SSE */ }
        const allowed: LogLevel[] = ["info", "high-risk", "intent-drift", "policy-violation"];
        const eventLevel = allowed.includes(parsed.level as LogLevel) ? parsed.level as LogLevel : "info";
        setLogs((current) => [{ id: crypto.randomUUID(), time: new Date().toISOString(), level: eventLevel, message: parsed.message ?? event.data, source: parsed.source ?? "SSE" }, ...current].slice(0, 500));
      };
    } catch { setStreamState("Invalid SSE URL"); }
    return () => source?.close();
  }, [streamUrl]);

  const addLog = (eventLevel: LogLevel, message: string, source = "local evaluator") => {
    setLogs((current) => [{ id: crypto.randomUUID(), time: new Date().toISOString(), level: eventLevel, message, source }, ...current].slice(0, 500));
  };
  const saveCurrentPolicy = () => {
    if (!policyName.trim() || !policyText.trim()) { setPolicyError("Policy name and content are required."); return; }
    if (policyMode === "json") {
      try { const parsed = JSON.parse(policyText); if (!parsed || typeof parsed !== "object") throw new Error("JSON root must be an object."); }
      catch (e) { setPolicyError((e as Error).message); return; }
    }
    setPolicyError("");
    const id = "policy-" + policyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    savePolicy.mutate({ id, name: policyName.trim(), mode: policyMode, content: policyText, enabled: true });
    addLog("info", 'Policy "' + policyName.trim() + '" saved locally.');
  };
  const sendAlert = async () => {
    setAlertStatus("");
    if (!webhookUrl.trim()) { setAlertStatus("Enter a webhook URL first. No alert was sent."); return; }
    if (driftRate < driftThreshold) { setAlertStatus("Current estimated drift (" + driftRate + "%) is below threshold (" + driftThreshold + "%)."); return; }
    try {
      const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "intent_drift_threshold_exceeded", driftRate, threshold: driftThreshold, createdAt: new Date().toISOString(), source: "IntentGuard Console" }) });
      if (!response.ok) throw new Error("Webhook returned HTTP " + response.status);
      setAlertStatus("Webhook accepted the test alert.");
      addLog("high-risk", "Webhook alert sent at estimated drift " + driftRate + "%.");
    } catch (e) { setAlertStatus("Webhook failed: " + (e as Error).message + ". Check CORS and endpoint configuration."); }
  };
  const runSandbox = async () => {
    setSandboxBusy(true); setSandboxError(""); setSandboxOutput("");
    try {
      const result = await runAI({ data: { system: sandboxSystem, user: sandboxUser } });
      if (result.ok) {
        setSandboxOutput(result.text);
        const assessment = scoreOutput(result.text, policyText);
        addLog(assessment.matched.length ? "policy-violation" : "info", "Sandbox run completed; local policy phrase matches: " + assessment.matched.length + ".");
        setActiveFlow(4);
      } else setSandboxError(result.error);
    } catch (e) { setSandboxError((e as Error).message); }
    finally { setSandboxBusy(false); }
  };
  const exportJson = () => downloadFile("intentguard-audit.json", JSON.stringify({ exportedAt: new Date().toISOString(), telemetryMode: streamUrl ? "SSE configured" : "local demo + local events", driftRate, driftThreshold, logs: filteredLogs, policies: savedPolicies }, null, 2), "application/json");
  const exportCsv = () => {
    const rows = [["time", "level", "source", "message"], ...filteredLogs.map((l) => [l.time, l.level, l.source, l.message])];
    downloadFile("intentguard-audit.csv", rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">IntentGuard Operations Console</h2><p className="mt-1 text-sm text-muted-foreground">Flow inspection, policy authoring, audit export and telemetry connection.</p></div>
      <div className="flex flex-wrap gap-2"><button className="rounded border px-3 py-2 text-sm hover:bg-accent" onClick={exportJson}>Export JSON</button><button className="rounded border px-3 py-2 text-sm hover:bg-accent" onClick={exportCsv}>Export CSV</button><button className="rounded border px-3 py-2 text-sm hover:bg-accent" onClick={() => window.print()}>Print / Save PDF</button></div>
    </div>
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Interactive decision flow</h3><span className="text-xs text-muted-foreground">Select a stage to inspect</span></div>
      <div className="grid gap-2 sm:grid-cols-5">{["User input", "Agent action", "Guardrail analysis", "Multi-model validation", "Accept / Block"].map((name, index) => <button key={name} onClick={() => setActiveFlow(index)} className={"rounded-md border p-3 text-left transition " + (activeFlow === index ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-accent")}><span className="mb-2 block font-mono text-xs text-muted-foreground">STEP 0{index + 1}</span><span className="text-sm font-medium">{name}</span><span className="mt-2 block text-xs text-muted-foreground">{["Request received", "Prompt prepared", "Risk: " + (risk ?? "not evaluated"), "Score: " + (evaluationScore ?? "—"), risk === "high" || risk === "critical" ? "Review / block candidate" : "Decision requires policy evaluation"][index]}</span></button>)}</div>
      <p className="mt-3 rounded bg-muted p-3 text-sm">{[
        "Input: " + (input.trim() || "No request supplied yet."),
        "Agent action: the existing workbench prepares a prompt; this does not imply an external agent executed a tool.",
        "Guardrail analysis: " + findings.length + " finding(s). " + (findings.slice(0, 2).join(" · ") || "No findings passed into this panel."),
        "Multi-model validation: enter three outputs below. This panel does not invoke three separate providers.",
        "Decision preview: " + (risk === "high" || risk === "critical" ? "high-risk input — require human review before execution" : "no automatic block asserted by this console") + ".",
      ][activeFlow]}</p>
    </section>
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Audit log stream</h3><p className="mt-1 text-xs text-muted-foreground">{streamUrl ? streamState : "Local demo events only — connect an SSE endpoint for real server events."}</p></div><span className="rounded bg-muted px-2 py-1 text-xs">{filteredLogs.length} visible / {logs.length} retained</span></div>
      <div className="grid gap-2 md:grid-cols-[1fr_220px]"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events instantly…" className="w-full rounded-md border bg-background px-3 py-2 text-sm" /><select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="all">All severities</option><option value="high-risk">High risk</option><option value="intent-drift">Intent drift</option><option value="policy-violation">Policy violation</option><option value="info">Info</option></select></div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="Optional SSE endpoint URL (EventSource)" className="rounded-md border bg-background px-3 py-2 text-sm" /><button className="rounded border px-3 py-2 text-sm" onClick={() => addLog("info", "Manual audit marker added.")}>Add marker</button></div>
      <div className="mt-3 max-h-64 space-y-2 overflow-auto">{filteredLogs.map((log) => <div key={log.id} className="grid gap-1 rounded border p-2 sm:grid-cols-[150px_130px_1fr]"><span className="text-xs text-muted-foreground">{new Date(log.time).toLocaleTimeString()}</span><span className={"text-xs font-semibold " + (log.level === "info" ? "text-muted-foreground" : "text-destructive")}>{levelLabel[log.level]}</span><span className="text-sm">{log.message}<span className="ms-2 text-xs text-muted-foreground">· {log.source}</span></span></div>)}{!filteredLogs.length && <p className="py-5 text-center text-sm text-muted-foreground">No events match this filter.</p>}</div>
    </section>
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Three-output comparison matrix</h3><p className="my-2 text-xs text-muted-foreground">Paste outputs from models you actually ran. Scores are a local heuristic, not a provider benchmark or safety certification.</p>
      <div className="grid gap-3 md:grid-cols-3">{modelOutputs.map((value, i) => <label key={i} className="block text-sm font-medium">Model {["A", "B", "C"][i]} output<textarea rows={5} value={value} onChange={(e) => setModelOutputs((current) => current.map((old, j) => j === i ? e.target.value : old))} className="mt-1 w-full rounded-md border bg-background p-2 text-sm font-normal" placeholder="Paste model response…" /></label>)}</div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2">Metric</th>{matrix.map((m) => <th key={m.name} className="p-2">{m.name}</th>)}</tr></thead><tbody><tr className="border-b"><td className="p-2">Local heuristic score</td>{matrix.map((m) => <td key={m.name} className="p-2 font-mono">{m.score}/100</td>)}</tr><tr className="border-b"><td className="p-2">Policy phrase matches</td>{matrix.map((m) => <td key={m.name} className="p-2">{m.matched.length}</td>)}</tr><tr><td className="p-2">Assessment</td>{matrix.map((m) => <td key={m.name} className="p-2 text-xs">{m.verdict}</td>)}</tr></tbody></table></div>
    </section>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border bg-card p-4"><h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Custom policy editor</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]"><input value={policyName} onChange={(e) => setPolicyName(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm" aria-label="Policy name" /><select value={policyMode} onChange={(e) => setPolicyMode(e.target.value as typeof policyMode)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="json">JSON policy</option><option value="natural">Natural language</option></select></div>
        <textarea rows={8} value={policyText} onChange={(e) => setPolicyText(e.target.value)} className="mt-2 w-full rounded-md border bg-background p-3 font-mono text-xs" placeholder={policyMode === "natural" ? "Describe safety boundaries in plain language…" : "Enter a JSON policy object…"} />
        {policyError && <p className="mt-2 text-sm text-destructive">{policyError}</p>}<button onClick={saveCurrentPolicy} className="mt-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Validate & save policy</button>
        <div className="mt-3 space-y-2">{savedPolicies.map((policy) => <div key={policy.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm"><span>{policy.name}<span className="ms-2 text-xs text-muted-foreground">{policy.mode} · {policy.enabled ? "enabled" : "disabled"}</span></span><button className="text-xs underline" onClick={() => savePolicy.mutate({ ...policy, enabled: !policy.enabled })}>{policy.enabled ? "Disable" : "Enable"}</button></div>)}</div>
        {activePolicies.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{activePolicies.length} active policies saved in this browser. Backend enforcement is not configured by this UI alone.</p>}
      </section>
      <section className="rounded-lg border bg-card p-4"><h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Intent drift alert</h3>
        <div className="mt-3 flex items-center justify-between"><label className="text-sm">Alert threshold <b>{driftThreshold}%</b></label><input type="range" min={5} max={80} step={5} value={driftThreshold} onChange={(e) => setDriftThreshold(Number(e.target.value))} /></div>
        <div className="mt-3 rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Estimated drift from current workbench risk/findings, not historical telemetry</div><div className="mt-1 text-2xl font-semibold">{driftRate}%</div><div className="mt-1 text-xs">{driftRate >= driftThreshold ? "Threshold crossed" : "Below threshold"}</div></div>
        <label className="mt-3 block text-xs text-muted-foreground">Webhook endpoint (optional; not saved)<input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-service.example/webhook" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
        <button onClick={sendAlert} className="mt-3 rounded-md border px-3 py-2 text-sm hover:bg-accent">Send test alert if threshold crossed</button>{alertStatus && <p className="mt-2 text-sm">{alertStatus}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Slack/email delivery requires a trusted server-side adapter. Never place tokens in browser code.</p>
      </section>
    </div>
    <section className="rounded-lg border bg-card p-4"><h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Prompt sandbox</h3><p className="mt-1 text-xs text-muted-foreground">Calls the configured AI server function and requires server-side LOVABLE_API_KEY.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm font-medium">System prompt<textarea rows={5} value={sandboxSystem} onChange={(e) => setSandboxSystem(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs" /></label><label className="text-sm font-medium">User prompt<textarea rows={5} value={sandboxUser} onChange={(e) => setSandboxUser(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs" /></label></div>
      <button disabled={sandboxBusy || !sandboxUser.trim()} onClick={runSandbox} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40">{sandboxBusy ? "Running…" : "Run sandbox prompt"}</button>
      {sandboxError && <p className="mt-2 text-sm text-destructive">{sandboxError}</p>}{sandboxOutput && <div className="mt-3 rounded-md border p-3"><div className="mb-2 text-xs text-muted-foreground">Actual model response</div><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-sm">{sandboxOutput}</pre></div>}
    </section>
    <p className="text-xs text-muted-foreground">Without an SSE URL, logs are local demo/sample events. WebSocket transport and server-side alert delivery still require backend endpoints.</p>
  </div>;
}
