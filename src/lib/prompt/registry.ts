import type { CompiledPrompt, Archetype } from "./types";

export type Lifecycle = "draft" | "review" | "published" | "deprecated";
export interface PromptVersion { version: string; createdAt: string; prompt: CompiledPrompt; note: string; securityScore: number }
export interface PromptAsset { id: string; name: string; archetype: Archetype; status: Lifecycle; versions: PromptVersion[] }
export interface AuditEntry { readonly id: string; readonly at: string; readonly assetId: string; readonly action: string; readonly detail: string }
interface State { assets: PromptAsset[]; audit: AuditEntry[] }

const KEY = "pew.registry.v1";
const TRANSITIONS: Record<Lifecycle, Lifecycle[]> = { draft: ["review"], review: ["draft", "published"], published: ["deprecated"], deprecated: [] };

const load = (): State => {
  if (typeof window === "undefined") return { assets: [], audit: [] };
  try { return JSON.parse(localStorage.getItem(KEY) || "") as State; } catch { return { assets: [], audit: [] }; }
};
const save = (s: State) => localStorage.setItem(KEY, JSON.stringify(s));
const uid = () => Math.random().toString(36).slice(2, 10);

function log(s: State, assetId: string, action: string, detail: string) {
  s.audit = [...s.audit, Object.freeze({ id: uid(), at: new Date().toISOString(), assetId, action, detail })];
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
  read: load,
  canTransition: (from: Lifecycle, to: Lifecycle) => TRANSITIONS[from].includes(to),
  nextStates: (from: Lifecycle) => TRANSITIONS[from],
  create(name: string, archetype: Archetype, prompt: CompiledPrompt, securityScore: number): State {
    const s = load(); const id = uid();
    s.assets.push({ id, name, archetype, status: "draft", versions: [{ version: "1.0.0", createdAt: new Date().toISOString(), prompt, note: "Initial version", securityScore }] });
    log(s, id, "create", `${name} v1.0.0`); save(s); return s;
  },
  addVersion(id: string, prompt: CompiledPrompt, kind: "major" | "minor" | "patch", note: string, securityScore: number): State {
    const s = load(); const a = s.assets.find((x) => x.id === id); if (!a) return s;
    if (a.status === "deprecated") throw new Error("Deprecated assets are immutable");
    const latest = a.versions[a.versions.length - 1]!.version; const v = bump(latest, kind);
    a.versions.push({ version: v, createdAt: new Date().toISOString(), prompt, note, securityScore });
    a.status = "draft"; log(s, id, "version", `${latest} → ${v}: ${note}`); save(s); return s;
  },
  transition(id: string, to: Lifecycle): State {
    const s = load(); const a = s.assets.find((x) => x.id === id); if (!a) return s;
    if (!TRANSITIONS[a.status].includes(to)) throw new Error(`Invalid transition ${a.status} → ${to}`);
    const latest = a.versions[a.versions.length - 1]!;
    if (to === "published" && latest.securityScore < 60) throw new Error("Security score below 60 — publishing blocked");
    log(s, id, "transition", `${a.status} → ${to}`); a.status = to; save(s); return s;
  },
};
