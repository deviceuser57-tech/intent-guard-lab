import type { CompiledPrompt, Archetype } from "./types";

export type Lifecycle = "draft" | "review" | "published" | "deprecated";

export interface PromptVersion {
  version: string;
  createdAt: string;
  prompt: CompiledPrompt;
  note: string;
  securityScore: number;
}

export interface PromptAsset {
  id: string;
  name: string;
  archetype: Archetype;
  status: Lifecycle;
  versions: PromptVersion[];
}

export interface AuditEntry {
  readonly id: string;
  readonly at: string;
  readonly assetId: string;
  readonly action: string;
  readonly detail: string;
}

interface State {
  assets: PromptAsset[];
  audit: AuditEntry[];
}

const KEY = "pew.registry.v1";

const TRANSITIONS: Record<Lifecycle, Lifecycle[]> = {
  draft: ["review"],
  review: ["draft", "published"],
  published: ["deprecated"],
  deprecated: [],
};

// In-memory cache: parse localStorage once, then serve reads from memory.
let cache: State | null = null;
let index = new Map<string, PromptAsset>();

const reindex = (state: State): void => {
  index = new Map(state.assets.map((asset) => [asset.id, asset]));
};

const snapshot = (state: State): State => ({
  assets: state.assets.map((asset) => ({
    ...asset,
    versions: [...asset.versions],
  })),
  audit: [...state.audit],
});

const emptyState = (): State => ({ assets: [], audit: [] });

const load = (): State => {
  if (typeof window === "undefined") {
    return cache ?? emptyState();
  }

  if (!cache) {
    try {
      const stored = localStorage.getItem(KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : null;

      if (
        parsed &&
        typeof parsed === "object" &&
        "assets" in parsed &&
        Array.isArray(parsed.assets) &&
        "audit" in parsed &&
        Array.isArray(parsed.audit)
      ) {
        cache = parsed as State;
      } else {
        cache = emptyState();
      }
    } catch {
      cache = emptyState();
    }

    reindex(cache);
  }

  return cache;
};

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const flush = (): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  if (typeof window !== "undefined" && cache) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (error) {
      // Keep the in-memory state usable if browser storage is unavailable/full.
      console.error("Unable to persist prompt registry:", error);
    }
  }
};

const save = (_state: State): void => {
  if (typeof window === "undefined") return;

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(flush, 300);
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

const uid = (): string => Math.random().toString(36).slice(2, 10);

function log(state: State, assetId: string, action: string, detail: string): void {
  state.audit.push(
    Object.freeze({
      id: uid(),
      at: new Date().toISOString(),
      assetId,
      action,
      detail,
    }),
  );
}

export function bump(v: string, kind: "major" | "minor" | "patch"): string {
  const [major = 1, minor = 0, patch = 0] = v.split(".").map(Number);

  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function compareVersions(a: string, b: string): number {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);

  for (let i = 0; i < 3; i += 1) {
    const left = x[i] ?? 0;
    const right = y[i] ?? 0;

    if (left !== right) return left - right;
  }

  return 0;
}

export function diffLines(a: string, b: string) {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const setA = new Set(linesA);
  const setB = new Set(linesB);

  return [
    ...linesA.filter((line) => !setB.has(line)).map((line) => ({ t: "-" as const, l: line })),
    ...linesB.filter((line) => !setA.has(line)).map((line) => ({ t: "+" as const, l: line })),
  ];
}

export const registry = {
  read(): State {
    return snapshot(load());
  },

  get(id: string): PromptAsset | undefined {
    load();
    return index.get(id);
  },

  canTransition(from: Lifecycle, to: Lifecycle): boolean {
    return TRANSITIONS[from].includes(to);
  },

  nextStates(from: Lifecycle): Lifecycle[] {
    return [...TRANSITIONS[from]];
  },

  create(name: string, archetype: Archetype, prompt: CompiledPrompt, securityScore: number): State {
    const state = load();
    const id = uid();

    const asset: PromptAsset = {
      id,
      name,
      archetype,
      status: "draft",
      versions: [
        {
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          prompt,
          note: "Initial version",
          securityScore,
        },
      ],
    };

    state.assets.push(asset);
    index.set(id, asset);
    log(state, id, "create", `${name} v1.0.0`);
    save(state);

    return snapshot(state);
  },

  addVersion(
    id: string,
    prompt: CompiledPrompt,
    kind: "major" | "minor" | "patch",
    note: string,
    securityScore: number,
  ): State {
    const state = load();
    const asset = index.get(id);

    if (!asset) return snapshot(state);
    if (asset.status === "deprecated") {
      throw new Error("Deprecated assets are immutable");
    }

    const latest = asset.versions[asset.versions.length - 1]?.version;
    if (!latest) {
      throw new Error("Cannot add a version because the asset has no existing versions");
    }

    const version = bump(latest, kind);

    asset.versions.push({
      version,
      createdAt: new Date().toISOString(),
      prompt,
      note,
      securityScore,
    });

    asset.status = "draft";
    log(state, id, "version", `${latest} → ${version}: ${note}`);
    save(state);

    return snapshot(state);
  },

  transition(id: string, to: Lifecycle): State {
    const state = load();
    const asset = index.get(id);

    if (!asset) return snapshot(state);

    if (!TRANSITIONS[asset.status].includes(to)) {
      throw new Error(`Invalid transition ${asset.status} → ${to}`);
    }

    const latest = asset.versions[asset.versions.length - 1];
    if (!latest) {
      throw new Error("Cannot change lifecycle because the asset has no versions");
    }

    if (to === "published" && latest.securityScore < 60) {
      throw new Error("Security score below 60 — publishing blocked");
    }

    const previousStatus = asset.status;
    asset.status = to;
    log(state, id, "transition", `${previousStatus} → ${to}`);
    save(state);

    return snapshot(state);
  },
};
