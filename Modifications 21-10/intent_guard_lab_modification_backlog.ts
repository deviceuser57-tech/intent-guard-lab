export type Priority = "P0" | "P1" | "P2" | "P3";
export type Status = "proposed" | "in_progress" | "blocked" | "deferred" | "done";

export interface ModificationTask {
  id: string;
  title: string;
  priority: Priority;
  phase: number;
  status: Status;
  dependsOn: string[];
  files: string[];
  actions: string[];
  acceptanceCriteria: string[];
  risks?: string[];
}

export interface ModificationPlan {
  schemaVersion: string;
  repository: string;
  reviewedRevision: string;
  planStatus: "proposed";
  tasks: ModificationTask[];
}

export const plan: ModificationPlan = {
  schemaVersion: "1.0.0",
  repository: "deviceuser57-tech/intent-guard-lab",
  reviewedRevision: "2a16910",
  planStatus: "proposed",
  tasks: [
    {
      id: "SEC-001",
      title: "Respond to tracked .env exposure",
      priority: "P0",
      phase: 0,
      status: "proposed",
      dependsOn: [],
      files: [".env", ".gitignore", ".env.example", ".github/workflows/CI.yml"],
      actions: [
        "Revoke and rotate any credentials that may have been committed in .env",
        "Remove .env from Git without printing its contents",
        "Add ignore rules, a sanitized example and automated secret scanning",
        "Coordinate any history purge with Lovable synchronization",
      ],
      acceptanceCriteria: [
        "No possibly exposed credentials remain usable",
        ".env is no longer tracked and is ignored",
        "Secret scanning passes on a clean checkout",
      ],
      risks: [
        "History rewriting can disrupt repository consumers and Lovable sync; credential rotation is mandatory regardless.",
      ],
    },
    {
      id: "UX-001",
      title: "Integrate RequestAssistant into Workbench without overwriting its draft",
      priority: "P1",
      phase: 1,
      status: "proposed",
      dependsOn: ["SEC-001"],
      files: [
        "src/components/Workbench.tsx",
        "src/components/RequestAssistant.tsx",
        "src/lib/prompt/requestAssistant.ts",
      ],
      actions: [
        "Render RequestAssistant in or above .workbench-request and connect existing language/input/archetype state",
        "On adoption preserve the reviewed AssistantDraft specification and compute/pass its analysis explicitly",
        "Clear stale optimizer output and navigate to Compiled Prompts",
        "Do not call the current run() callback because it rebuilds defaultSpec and overwrites adopted settings",
        "Test template selection, guided dialogue, review editing, adoption, close and restart",
      ],
      acceptanceCriteria: [
        "Adopted specification, constraints, advanced controls and output format survive unchanged",
        "No redundant generation overwrites the adopted draft",
        "The original task remains available after closing or restarting the assistant",
      ],
    },
    {
      id: "UX-002",
      title: "Prefill Playground variables from AssistantDraft.inputValues",
      priority: "P1",
      phase: 1,
      status: "proposed",
      dependsOn: ["UX-001"],
      files: ["src/components/Workbench.tsx"],
      actions: [
        "Add an explicit initialValues prop to Playground",
        "Map draft.inputValues to matching prompt placeholders",
        "Reset or reconcile stale values when prompt identity/variables change",
        "Keep file parsing client-side and disclose that a later model run transmits chosen content to the provider",
      ],
      acceptanceCriteria: [
        "Matching variable inputs are prefilled when Playground opens",
        "Stale values are not reused for unrelated placeholders",
        "File parsing and model transmission are distinct user-visible actions",
      ],
    },
    {
      id: "I18N-001",
      title: "Localize linter and readiness diagnostics by stable codes",
      priority: "P1",
      phase: 2,
      status: "proposed",
      dependsOn: ["UX-001"],
      files: [
        "src/lib/i18n.ts",
        "src/lib/prompt/linter.ts",
        "src/lib/prompt/readiness.ts",
        "src/components/Workbench.tsx",
      ],
      actions: [
        "Add stable finding IDs and typed English/Arabic message catalogs",
        "Translate titles, messages, remediations and status announcements",
        "Keep localization separate from engine decisions and provide unknown-code fallback",
      ],
      acceptanceCriteria: [
        "Every known diagnostic code has English and Arabic copy",
        "Language changes do not mutate diagnostic identity or evidence",
        "RTL and mixed-script diagnostics pass smoke tests",
      ],
    },
    {
      id: "I18N-002",
      title: "Add bilingual, version-neutral model-provider explanations",
      priority: "P1",
      phase: 2,
      status: "proposed",
      dependsOn: [],
      files: ["src/components/ModelSettings.tsx", "src/lib/i18n.ts"],
      actions: [
        "Explain provider family, endpoint format, key handling and connection tests in Arabic and English",
        "Avoid hard-coded stale model-version claims; use editable model IDs or a maintained dated catalog",
      ],
      acceptanceCriteria: [
        "All provider explanations are bilingual",
        "No unverified model capability or performance guarantee is displayed",
      ],
    },
    {
      id: "TEST-001",
      title: "Reproduce and fix the reported NameTooLong test-loader failure",
      priority: "P1",
      phase: 3,
      status: "proposed",
      dependsOn: ["SEC-001"],
      files: ["tests/prompt-engines.test.mjs", "tests/helpers/*", "package.json", ".github/workflows/CI.yml"],
      actions: [
        "Reproduce on clean install using CI's Node version",
        "If confirmed replace oversized base64 data-URL imports with temporary transpiled .mjs modules/file URLs or a compatible TS test runner",
        "Preserve classifier and safety assertions until a deliberate behavior change",
        "Run tests, lint and build from clean install",
      ],
      acceptanceCriteria: [
        "Failure is reproduced before the fix",
        "No data-URL length failure remains",
        "CI tests, lint and build pass on Node 22",
      ],
    },
    {
      id: "DB-001",
      title: "Reconcile cloud registry SQL docs with the app's canonical table",
      priority: "P1",
      phase: 4,
      status: "proposed",
      dependsOn: [],
      files: [
        "src/lib/cloudRegistry.ts",
        "src/integrations/supabase/types.ts",
        "drizzle/migrations/0000_prompt_registries.sql",
        "docs/supabase-cloud-storage.sql",
        "docs/model-providers-cloud-sync.md",
      ],
      actions: [
        "Keep prompt_registries as canonical unless an explicit migration is approved; code and Drizzle migration already use it",
        "Correct or retire docs SQL that defines intent_guard_registry and workspace tables",
        "Test canonical setup against clean Supabase under RLS",
        "Surface cloud save errors and add retry/status feedback",
      ],
      acceptanceCriteria: [
        "Exactly one documented schema path matches the app query and generated types",
        "RLS isolation tests pass",
        "Sync failures are visible and retryable",
      ],
    },
    {
      id: "CORE-001",
      title: "Resolve classifier drift with a bilingual benchmark",
      priority: "P1",
      phase: 5,
      status: "proposed",
      dependsOn: ["TEST-001"],
      files: [
        "src/lib/prompt/decisionEngine.ts",
        "src/lib/prompt/intentAnalyzer.ts",
        "src/lib/prompt/analyzerAudit.ts",
        "tests/prompt-engines.test.mjs",
      ],
      actions: [
        "Select one authoritative classifier and keep legacy analysis as diagnostic during migration",
        "Add bilingual/mixed/ambiguous/overlapping-intent examples and deterministic tie handling",
        "Label rule-only analysis as inferred rather than measured",
      ],
      acceptanceCriteria: [
        "Benchmark reports per-class metrics and confusion matrix",
        "A single selected classification drives downstream decisions",
        "Ambiguity and user override are visible",
      ],
    },
    {
      id: "SEC-002",
      title: "Harden provider requests and custom endpoint handling",
      priority: "P1",
      phase: 5,
      status: "proposed",
      dependsOn: ["SEC-001"],
      files: ["src/lib/ai.functions.ts", "src/lib/prompt/providerTypes.ts", "src/components/ModelSettings.tsx"],
      actions: [
        "Test private IPv4/IPv6, alternate encodings, redirects and DNS rebinding against SSRF protections",
        "Use supported authorization headers and redact credentials from URLs, logs and errors",
        "Add timeout, cancellation, response limits, schema validation and usage limits",
      ],
      acceptanceCriteria: [
        "Disallowed destinations remain blocked across redirects/resolution variants",
        "Credentials never appear in logs, exports or browser persistence",
        "Calls are bounded and error messages are actionable",
      ],
    },
    {
      id: "OPS-001",
      title: "Separate Guardrails prototype from production enforcement",
      priority: "P2",
      phase: 5,
      status: "proposed",
      dependsOn: ["SEC-002", "DB-001"],
      files: ["src/components/GuardrailConsole.tsx", "src/lib/guardrail-policy.mjs", "docs/intentguard-operations.md"],
      actions: [
        "Mark demo/local telemetry and heuristic drift clearly",
        "If approved, implement authenticated durable telemetry, tenant-scoped policies and server-side enforcement",
        "Use server-mediated, allowlisted webhook delivery with audit and retry",
      ],
      acceptanceCriteria: [
        "Only server-enforced policy is labeled enforced",
        "Production logs are durable and tenant-scoped",
        "Demo and production states are distinguishable",
      ],
    },
    {
      id: "BILL-001",
      title: "Implement web subscriptions and server-authoritative entitlements",
      priority: "P3",
      phase: 6,
      status: "deferred",
      dependsOn: ["SEC-001", "DB-001"],
      files: ["database migrations", "server routes", "webhook handler", "billing UI", "billing tests"],
      actions: [
        "Select one provider after region/product requirements review",
        "Add subscription state, event IDs, signature verification, idempotent webhooks and server-side entitlements",
        "Support cancellation/refunds and never store card data",
      ],
      acceptanceCriteria: [
        "Payment lifecycle is idempotent and replay-safe",
        "Client redirect cannot grant entitlement",
        "Cancellation/refund webhook transitions are tested",
      ],
    },
    {
      id: "ANDROID-001",
      title: "Prototype Capacitor Android support after compatibility and policy review",
      priority: "P3",
      phase: 6,
      status: "deferred",
      dependsOn: ["BILL-001"],
      files: ["Capacitor configuration", "Android app project", "CI signing workflow", "mobile tests"],
      actions: [
        "Test SSR, file import, auth redirects, clipboard and downloads in a proof of concept",
        "Verify current Google Play billing requirements before deciding purchase flow",
        "Build and install on a real Android device",
        "Store signing material only in an approved secret manager or CI secret store",
      ],
      acceptanceCriteria: [
        "Core flows pass on a real Android device",
        "Billing approach has documented policy review",
        "Signing material is absent from source control",
      ],
    },
  ],
};
