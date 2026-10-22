# Intent Guard Lab — Repository-Specific Modifications Plan

**Repository reviewed:** `deviceuser57-tech/intent-guard-lab` (public)  
**Reviewed revision:** `2a16910` — `Fixed background task delivery`  
**Plan status:** Proposal only. No repository files were modified.

## Recommendation

The repository already contains a broader implementation than the earlier live-page review could establish: a deterministic prompt pipeline, model adapters and server functions, a prompt registry, tests for engines and guardrail rules, Supabase cloud registry support, and an operations console. The next investment should therefore be hardening and closing the gaps between implemented UI, actual evidence, and production operations—not rebuilding these features from scratch.

**Do first:** treat the tracked `.env` as a potential credential exposure. I did not read its contents. Because the repository is public and `.env` is tracked in Git, revoke and rotate any credentials that have ever been committed there, remove the file from the repository, prevent future tracking, and review Git history for secret removal. History rewriting can disrupt Lovable synchronization, so coordinate any history purge before doing it; rotate credentials regardless of whether history is rewritten.

## What the repository already has

- **Prompt workbench:** `src/components/Workbench.tsx` combines input, archetype override, analysis, specification, compilation, evaluation, security review, optimization, playground, registry, guardrails, help, and provider settings. It supports English/Arabic and changes document direction for Arabic.
- **Prompt domain modules:** `src/lib/prompt/` contains the intent analyzer, decision engine, prompt IR/specification, compiler, linter, readiness assessment, red-team heuristics, evaluation, adapters, optimization, exports, and registry.
- **Model calls:** `src/lib/ai.functions.ts` exposes server functions for provider testing, optimization, execution, judging, and embeddings. Provider keys are accepted per request; the docs say the UI keeps them in memory rather than localStorage.
- **Registry:** `src/lib/prompt/registry.ts` provides localStorage-backed assets, semantic versions, lifecycle transitions, published-example retrieval, and local audit entries. `src/lib/cloudRegistry.ts` is an opt-in cloud adapter. `docs/model-providers-cloud-sync.md` documents that workspace snapshots are last-successful-write-wins, not live collaborative editing.
- **Guardrails console:** `src/components/GuardrailConsole.tsx` has demo events, local policy drafts/import/export, an SSE client, manual output comparison, and an operator-confirmed webhook test. `docs/intentguard-operations.md` explicitly says the console is not a complete policy-enforcement service; audit events are not a durable production record and drift is only an estimate.
- **Tests and CI:** Node test files cover normalization, adapters, evaluation comparison, export, guardrail policy validation, optimization ranking, prompt engines, and registry retrieval. `.github/workflows/CI.yml` runs `npm test`, `npm run lint`, and `npm run build` on Node 22.
- **Known classifier drift is intentionally encoded as a current expected condition:** `tests/prompt-engines.test.mjs` asserts that the legacy and decision analyzers disagree on legal-compliance input. The UI surfaces the mismatch rather than silently choosing a winner.

## Prioritized plan

### P0 — Credential hygiene and release safety

**Goal:** remove the risk of public repository secrets and ensure release checks reliably run.

1. Revoke and rotate every credential that may have been placed in the tracked `.env`, including provider keys and backend credentials. Do not rely only on deleting the file.
2. Remove `.env` from the repository and add appropriate patterns (`.env`, `.env.*`, with an explicit exception for a sanitized `.env.example`) to `.gitignore`. Add a non-secret `.env.example` documenting variable names and safe placeholders.
3. Review repository history for secrets with a secret scanner. If a credential was committed, purge it from history where feasible, coordinate the operation with the connected Lovable project, and force-push only after agreeing on the impact. Rotation is mandatory even if history cleanup is performed.
4. Add automated secret scanning to CI and enable GitHub secret scanning/push protection if available for the repository.
5. Confirm the workflow install/build/test path is deterministic. Consider `npm ci` lockfile consistency and pin supported runtime/tool versions.

**Primary files:** `.env` (remove without opening/printing), `.gitignore`, `.github/workflows/CI.yml`, `README.md` or `docs/security.md`.  
**Acceptance:** no live credentials remain usable; `.env` is not tracked; a clean clone passes secret scanning; a safe example file documents setup; CI blocks detected secrets.

**Risk:** history rewriting can disrupt repository consumers and Lovable synchronization. Schedule it deliberately; do not force-push blindly.

### P1 — Resolve intent classification disagreement with evidence

**Goal:** make classification predictable and avoid downstream prompt components being selected from conflicting intent decisions.

1. Establish one authoritative classification pipeline and define the contract for legacy analyzer compatibility. Keep the audit view as a migration diagnostic, not a second competing source of truth.
2. Build a bilingual benchmark suite covering all 15 task types, short/ambiguous requests, mixed-language input, overlapping keywords, high-impact domains, and the previously failing legal/business/agent examples.
3. Replace accidental substring/keyword collisions with token-aware phrase matching, explicit priorities, ambiguity handling, and deterministic tie-breaking. Preserve user override and show why a classification was selected.
4. Revisit the `executionStatus: "measured"` value assigned by rule-only analysis in `decisionEngine.ts`; static classification is inferred, not an observed model execution. Align status and evidence terminology end-to-end.
5. Expose a confidence/evidence basis without implying calibrated probability. Ask the user to confirm or correct low-confidence/high-impact classifications before compiling.

**Primary files:** `src/lib/prompt/decisionEngine.ts`, `intentAnalyzer.ts`, `analyzerAudit.ts`, `specification.ts`, `Workbench.tsx`, `tests/prompt-engines.test.mjs`.  
**Acceptance:** benchmark reports per-class precision/recall and confusion matrix; regression tests cover Arabic/English/mixed inputs; one chosen type/risk drives downstream compiler/readiness; unresolved ambiguity is shown explicitly.

### P1 — Make readiness and security scores evidence-safe

**Goal:** prevent heuristic scores from being mistaken for execution tests or security certification.

1. Unify the separate displayed score sources (top-level security/evaluation scores, red-team score, readiness dimensions, model judge score). Every score should carry method, status (`inferred`, `measured`, `not_tested`), timestamp, test suite/model where relevant, and supporting findings.
2. Do not label deterministic text heuristics as executed red-team tests. Use clear names such as “static checks” and distinguish them from adversarial model execution.
3. Review release-gate rules so unexecuted tests cannot produce an unqualified `ready_for_release`. The existing test currently allows a ready state when certain execution arrays are populated; confirm each required dimension really has valid evidence and thresholds, not merely an entry.
4. Add adversarial fixtures for obfuscated/encoded injections, multilingual attacks, indirect prompt injection in retrieved content, quoted benign examples that should not false-positive, PII/credential formats, tool abuse, and refusal/abstention behavior.
5. Version policies/rules and include rule IDs in findings; document false-positive limits and safe usage of the findings.

**Primary files:** `src/lib/prompt/redTeam.ts`, `linter.ts`, `readiness.ts`, `specification.ts`, `Workbench.tsx`, `tests/prompt-engines.test.mjs`.  
**Acceptance:** UI never labels static-only analysis “tested”; each release-gate decision has inspectable evidence; tests cover positive and negative cases with documented thresholds; untested security dimensions remain untested and block or qualify release according to policy.

### P1 — End-to-end test the primary workflow and improve first-run UX

**Goal:** make the visible workbench feel like one guided workflow and ensure every control works in the deployed app.

1. Add browser-level tests for: empty input, generation, manual archetype override, changing specification, tabs before/after generation, copy/export, model settings validation, provider connection errors, optimization, playground, save/version/publish registry, and Arabic RTL.
2. Add a clear empty state for analysis/security/playground/registry panels before the first prompt; give the user a sample request and “Try example” action.
3. Make generation progress, errors, disabled states, retry/cancel, and partial provider failure visible and accessible.
4. Split `Workbench.tsx` into smaller feature components/hooks so state and behavior can be tested independently. Keep pure prompt engines separate from presentation per `AGENTS.md`.
5. Check responsive breakpoints, keyboard-only navigation, semantic headings/forms, focus visibility, reduced motion, screen-reader labels, and RTL-specific layout. Run an automated accessibility scan and manual keyboard pass.

**Primary files:** `src/components/Workbench.tsx`, `RequestAssistant.tsx`, `ModelSettings.tsx`, `HelpUserGuide.tsx`, `src/styles.css`, tests and CI.  
**Acceptance:** browser test covers the critical path at desktop and mobile widths; no dead-end tabs in initial or generated state; basic WCAG 2.2 AA review is documented; Arabic layout is checked in the same journeys.

### P1 — Make prompt registry durable, recoverable, and transparent

**Goal:** close the gap between local registry lifecycle and dependable user/team storage.

1. Validate and version the registry snapshot schema at load/import boundaries. Provide migrations for older local snapshots and reject/backup malformed data instead of silently replacing it with an empty registry.
2. Add explicit backup/export, restore/import preview, conflict handling, and success/failure status for cloud sync. Current `cloudRegistry.ts` suppresses background write errors (`catch(() => {})`); record and surface sync failures and support retry.
3. Replace last-write-wins workspace sync with revision/ETag/updated-at conflict detection. Offer a compare-and-resolve flow before overwriting simultaneous edits.
4. Confirm actual RLS/table names agree between app queries and SQL migration. `cloudRegistry.ts` queries `prompt_registries`, while the SQL doc defines `intent_guard_registry`; reconcile these names before treating cloud persistence as operational.
5. Clarify audit semantics: local `Object.freeze` plus localStorage is not tamper-resistant or immutable in a security sense. Label it accurately, and use an append-only server-side event store for any compliance-grade audit history.
6. Add automated migration/RLS tests for owner isolation, workspace membership, editor access, invalid roles, and deletion behavior.

**Primary files:** `src/lib/cloudRegistry.ts`, `src/lib/prompt/registry.ts`, `src/components/CloudStoragePanel.tsx`, `docs/supabase-cloud-storage.sql`, Supabase migrations, `tests/registry-retrieval.test.mjs`.  
**Acceptance:** app table names match migration; corrupted snapshot recovery is tested; cloud write errors are visible/retryable; concurrent updates cannot silently overwrite; RLS tests prove tenant isolation; audit language matches actual trust level.

### P1 — Secure and operationalize provider requests

**Goal:** make user-configured model requests safer, bounded, and diagnosable.

1. Review `providerUrl()` against DNS rebinding and alternate IP representations. Validate/allowlist hosts where feasible, block private/link-local IPv6 and IPv4-mapped forms, and revalidate resolved destinations at the network boundary to prevent SSRF through custom endpoints.
2. Avoid API keys in query strings for providers that support header authentication. Gemini currently places the key in a URL; verify the provider-supported header alternative and redact URLs from logs/errors.
3. Add request timeouts, cancellation, bounded response size, retry policy for safe transient failures, and consistent sanitized error handling across provider and Lovable gateway paths.
4. Validate provider-specific response formats and structured JSON outputs with explicit schemas; clamp output sizes and validate optimization fields instead of coercing arbitrary values to strings.
5. Add per-user rate/usage limits and server-side abuse protection; record provider/model, latency, token counts, and status without recording prompt content or secrets by default.
6. Add tests for SSRF edge addresses, redirects, DNS failures, key redaction, malformed provider responses, timeout/oversized responses, and rate-limit responses.

**Primary files:** `src/lib/ai.functions.ts`, `src/lib/prompt/providerTypes.ts`, `src/components/ModelSettings.tsx`, relevant provider tests.  
**Acceptance:** prohibited destinations remain inaccessible even with redirects/resolution tricks; no credential appears in logs/export; requests are bounded; errors are actionable; provider adapter tests cover each supported family.

### P2 — Turn the operator console into an honest operations integration

**Goal:** preserve the useful prototype while avoiding accidental claims of production enforcement.

1. Keep demo events unmistakably marked and add a UI banner that distinguishes demo/local telemetry from authenticated production telemetry.
2. Replace estimated “drift rate” with an explicitly named heuristic estimate until a real baseline, denominator, time window, and confidence are available; do not page operators on heuristic values.
3. Move webhook delivery to a server-side allowlisted adapter with secrets in server-side secret storage, SSRF protections, rate limits, retries, delivery receipts, and an audit event. Keep the current direct browser send as a clearly labelled local test only.
4. Add a real authenticated telemetry ingestion service with tenant authorization, payload schema validation, PII/secret redaction, durable storage before SSE broadcast, retention controls, and authorized stream access.
5. Make policy drafts versioned server-side policies and enforce them in the model request path, not only in localStorage or post-output phrase matching. Preserve a local demo mode, clearly separated from enforcement mode.
6. Replace `scoreOutput()` phrase matching as the only comparator with explicit “heuristic phrase match” labeling and optionally a configurable, reproducible evaluator for outputs actually generated by selected providers.

**Primary files:** `src/components/GuardrailConsole.tsx`, `src/lib/guardrail-policy.mjs`, server routes/functions, `docs/intentguard-operations.md`, migration/schema, tests.  
**Acceptance:** no policy is represented as enforced unless the server request path checks it; audit is durable and tenant-scoped; telemetry source and demo status are visible; alerts are server-mediated and logged; drift metrics have documented measurement definitions.

### P2 — Finish bilingual onboarding and documentation

**Goal:** reduce the learning curve for both Arabic and English audiences.

1. Add guided templates and matching suggestions using the existing `RequestAssistant.tsx` and `assistantFiles.ts` capabilities; keep uploaded-file interpretation local unless the user explicitly requests external model processing.
2. Provide editable step-by-step questions for underspecified requests and preserve a visible manual archetype override.
3. Translate tabs/field labels consistently or document a deliberate bilingual terminology policy; verify Arabic text, mixed-script prompt output, errors, and RTL in all workflows.
4. Update `README.md`, Arabic guide, provider docs, and operations docs to distinguish existing, experimental, and production-ready features.
5. Update `roadmap.md` to reflect the current branch reality: it lists the authoritative domain-layer integration as incomplete even though numerous domain modules and the prompt-engine tests are already present. Replace stale checklist items only after verifying current behavior.

**Primary files:** `RequestAssistant.tsx`, `assistantFiles.ts`, `src/lib/i18n.ts`, `HelpUserGuide.tsx`, `docs/دليل-الاستخدام-بالعربية.md`, `README.md`, `roadmap.md`.  
**Acceptance:** guided flows have bilingual end-to-end coverage; docs accurately label local, cloud, demo, experimental, and production behavior; roadmap tasks have clear owners/status/acceptance checks.

## Suggested delivery sequence

1. **Security stop-ship:** revoke/rotate potentially exposed credentials; untrack `.env`; add secret scanning. Do not defer this behind feature work.
2. **Stabilize evidence and classifier:** one authoritative intent path; bilingual benchmark; score/readiness evidence contract; security false-positive/negative fixtures.
3. **Validate core journey:** browser tests and empty/progress/error states; split oversized UI component where required for testability.
4. **Repair persistence:** reconcile database table naming; validate snapshots; surface sync errors; handle workspace conflicts; verify RLS.
5. **Harden provider layer:** SSRF/URL safeguards, timeouts, redaction, schema validation, usage limits, provider contract tests.
6. **Decide operator-console scope:** either label it a local/demo operator prototype or fund the authenticated, durable enforcement architecture. Avoid implying production guardrails before that work ships.
7. **Bilingual and release polish:** responsive/accessibility verification, onboarding, docs, roadmap alignment, final release checks.

## Cross-cutting done criteria

- `npm test`, `npm run lint`, and `npm run build` pass in CI from a clean install.
- Add browser-level critical-flow tests and provider/registry/Supabase security tests; no major feature is considered complete from static unit tests alone.
- Every numeric score states whether it is inferred, measured, or not tested and links to its evidence.
- Production claims (immutable audit, enforced policies, measured drift, enterprise security, provider connection) are supported by server-side behavior and tests, not labels alone.
- No credentials are committed, logged, included in exports, or persisted in browser storage.
- Arabic and English critical flows work at desktop and mobile widths with keyboard navigation and reduced-motion support.
- Documentation distinguishes local-only, opt-in cloud, demo, experimental, and production-backed behavior.

## Verification performed for this plan

- Confirmed the repository is public and reviewed revision `2a16910`.
- Read repository guidance, README, roadmap, operational guide, cloud/provider guide, Arabic guide, key engine/UI/cloud files, SQL migration, CI, and existing test source.
- Confirmed `.env` is tracked in Git by filename/index metadata only. Its contents were not opened.
- Did not install dependencies or run the test/build commands because `node_modules` is absent. CI is configured to run them, but current pass status was not independently verified.
- No files in the repository were changed.
