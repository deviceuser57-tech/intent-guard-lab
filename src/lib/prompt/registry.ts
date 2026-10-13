import type { CompiledPrompt, Archetype } from "./types";

export type Lifecycle = "draft" | "review" | "published" | "deprecated";
export interface PromptVersion { version: string; createdAt: string; prompt: CompiledPrompt; note: string; securityScore: number }
export interface PromptAsset { id: string; name: string; archetype: Archetype; status: Lifecycle; versions: PromptVersion[] }
export interface AuditEntry { readonly id: string; readonly at: string; readonly assetId: string; readonly action: string; readonly detail: string }
interface State { assets: PromptAsset[]; audit: AuditEntry[] }

const KEY = "pew.registry.v1";
const TRANSITIONS: Record<Lifecycle, Lifecycle[]> = { draft: ["review"], review: ["draft", "published"], published: ["deprecated"], deprecated: [] };

// In-memory cache: parse localStorage once, then serve reads from memory.
let cache: State | null = null;
let index = new Map<string, PromptAsset>();
const reindex = (s: State) => { index = new Map(s.assets.map((a) => [a.id, a])); };
const snapshot = (s: State): State => ({ assets: [...s.assets], audit: [...s.audit] });
const load = (): State => {
  if (typeof window === "undefined") return { assets: [], audit: [] };
  if (!cache) {
    try { cache = JSON.parse(localStorage.getItem(KEY) || "") as State; } catch { cache = { assets: [], audit: [] }; }
    cache.assets ??= []; cache.audit ??= []; reindex(cache);
  }
  return cache;
};
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const flush = () => { if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; } if (cache) localStorage.setItem(KEY, JSON.stringify(cache)); };
const save = (_s: State) => { if (saveTimeout) clearTimeout(saveTimeout); saveTimeout = setTimeout(flush, 300); };
if (typeof window !== "undefined") { window.addEventListener("beforeunload", flush); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); }); }
const uid = () => Math.random().toString(36).slice(2, 10);

function log(s: State, assetId: string, action: string, detail: string) {
  s.audit.push(Object.freeze({ id: uid(), at: new Date().toISOString(), assetId, action, detail }));
}

export function bump(v: string, kind: "major" | "minor" | "patch"): string {
  const [ma = 1, mi = 0, pa = 0] = v.split(".").map(Number);
  return kind === "major" ? `${ma + 1}.0.0` : kind === "minor" ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
}
export function compareVersions(a: string, b: string) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}
export function diffLines(a: string, b: string) {
  const A = a.split("\n"), B = b.split("\n"); const sa = new Set(A), sb = new Set(B);
  return [...A.filter((l) => !sb.has(l)).map((l) => ({ t: "-" as const, l })), ...B.filter((l) => !sa.has(l)).map((l) => ({ t: "+" as const, l }))];
}

export const registry = {
  read: () => snapshot(load()),
  get: (id: string) => { load(); return index.get(id); },
  canTransition: (from: Lifecycle, to: Lifecycle) => TRANSITIONS[from].includes(to),
  nextStates: (from: Lifecycle) => TRANSITIONS[from],
  create(name: string, archetype: Archetype, prompt: CompiledPrompt, securityScore: number): State {
    const s = load(); const id = uid();
    const asset: PromptAsset = { id, name, archetype, status: "draft", versions: [{ version: "1.0.0", createdAt: new Date().toISOString(), prompt, note: "Initial version", securityScore }] };
    s.assets.push(asset); index.set(id, asset);
    log(s, id, "create", `${name} v1.0.0`);
    save(s);
    return snapshot(s);
  },
  addVersion(id: string, prompt: CompiledPrompt, kind: "major" | "minor" | "patch", note: string, securityScore: number): State {
    const s = load(); const a = index.get(id); if (!a) return snapshot(s);
    if (a.status === "deprecated") throw new Error("Deprecated assets are immutable");
    const latest = a.versions[a.versions.length - 1]!.version; const v = bump(latest, kind);
    a.versions.push({ version: v, createdAt: new Date().toISOString(), prompt, note, securityScore });
    a.status = "draft"; log(s, id, "version", `${latest} → ${v}: ${note}`); save(s); return snapshot(s);
  },
  transition(id: string, to: Lifecycle): State {
    const s = load(); const a = index.get(id); if (!a) return snapshot(s);
    if (!TRANSITIONS[a.status].includes(to)) throw new Error(`Invalid transition ${a.status} → ${to}`);
    const latest = a.versions[a.versions.length - 1]!;
    if (to === "published" && latest.securityScore < 60) throw new Error("Security score below 60 — publishing blocked");
    log(s, id, "transition", `${a.status} → ${to}`);
    a.status = to;
    save(s);
    return snapshot(s);
  },
};
