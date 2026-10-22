# IntentGuard — Execution Roadmap and Closure Register

This file is the source of truth for delivery scope. A code change is not considered complete merely because it exists; runtime acceptance and the relevant tests must pass before closure.

## 00 — Security and CI
- [x] Remove the tracked `.env` file from the current branch and add a non-secret `.env.example`.
- [x] Ignore environment files and common private-key/certificate files.
- [x] Make CI dependency installation tolerant of the current lockfile mismatch.
- [x] Latest known CI and prompt-engine regression workflows passed on the earlier recorded head; re-check after the current changes.
- [ ] Rotate any credentials that were ever committed and confirm no deployment/collaborator dependency remains before purging sensitive history.
- [ ] Review dependency and client/server secret boundaries; keep privileged credentials server-side.
- [x] Re-ran dependency installation, tests, lint, and production build through GitHub Actions on commit `67b3612fd103e22c9645ff2127e3c931f6d0bb50`; both CI and prompt-engine regression workflows passed. Re-run after any subsequent source changes.

## 01 — Free guided assistant and specification preservation
- [x] Bilingual templates, matching suggestions, and step-by-step request questions exist.
- [x] Local reference-file extraction and editable request synthesis exist.
- [x] DOCX text extraction supports stored/deflate-raw ZIP entries; embedded images, tracked changes, and formatting are explicitly out of scope.
- [x] Preserve a reviewed/adopted specification and require explicit confirmation when legacy intent analyzers disagree.
- [ ] Verify the complete adoption → Generate Prompt → populated fields → default playground inputs flow.
- [ ] Verify all supported reference file types and rejection/error states.
- [ ] Run the full rule and specification-preservation regression suite.

## 02 — Canonical intent, decision, and specification IR
- [x] Build the current Prompt IR and show analyzer drift for explicit review.
- [ ] Integrate the authoritative `Prompts` domain layer: specification IR, decision engine, compiler, linter, readiness, evidence-backed scoring, and Arabic-aware classification.
- [ ] Replace duplicated/legacy decision paths with one documented source of truth.
- [ ] Add contract tests for intent classification, component selection, compilation, confidence/evidence, and Arabic/RTL cases.
- [ ] Verify the canonical IR drives the Workbench, linter, readiness score, exports, and playground consistently.
- [x] Add the compiler from the `Prompts` domain layer as `canonicalCompiler.ts` and wire the active Workbench compiled artifact to `buildPromptIR`; the same IR result supplies linter findings/readiness and the compiled envelope used by registry, exports, and playground.

## 03 — Localization and reference tests
- [ ] Audit every visible diagnostic, validation error, tooltip, empty state, and accessibility label in Arabic and English.
- [ ] Verify RTL layout at desktop and narrow widths.
- [ ] Add stable reference cases for supported task archetypes, ambiguous requests, prompt injection, missing evidence, and analyzer disagreement.
- [ ] Confirm no visible diagnostic falls back to untranslated internal identifiers.
- [x] Add a regression test requiring Arabic and English UI dictionaries to expose identical key sets.
- [x] Add Arabic reference cases for translation and research classification, Arabic language detection, and safety-risk detection.

## 04 — DNA, persona, and governed learning
- [ ] Define versioned cognitive-profile/DNA and persona schemas with explicit precedence and compatibility rules.
- [ ] Record feedback as a learning candidate, not an automatic policy/profile mutation.
- [ ] Require human review, diff, approval/rejection, provenance, and rollback before adopting a candidate.
- [ ] Add tests for version migration, conflicting traits, rejected candidates, rollback, and tenant isolation.
- [x] Add deterministic cognitive-profile diff and rollback primitives; rollback restores earlier content as a new monotonically increasing version and records actor/source versions without mutating history.
- [x] Add regression tests for profile diff accuracy, monotonic rollback versioning, immutable history, invalid targets, duplicate versions, and cross-profile history rejection.

## 05 — Retrieval and evidence governance
- [ ] Implement hybrid retrieval with explicit source references, freshness, relevance, and permission filters.
- [ ] Enforce tenant and role filters before retrieval results enter a prompt.
- [ ] Distinguish retrieved evidence, user-provided facts, model inference, and unknowns in output contracts.
- [ ] Add tests for inaccessible documents, stale/duplicate evidence, empty retrieval, prompt injection in retrieved content, and traceability.
- [x] Add a deterministic evidence policy utility that filters tenant/source/authorization boundaries, rejects stale or provenance-free retrieved records, deduplicates records, bounds excerpts, and labels user claims separately from retrieved evidence.
- [x] Add an explicit output epistemic contract for user-provided facts, retrieved evidence, model inference, unknowns, and citation requirements.
- [ ] Define retention/deletion behavior for any persisted memory or retrieved content.

## 06 — Orchestration and multimodal
- [ ] Implement traceable Router → Planner → Executor/Tools → Verifier flow with bounded retries and failure states.
- [ ] Make plan steps, tool calls, evidence, and verification results inspectable.
- [ ] Add multimodal ingestion incrementally with explicit capability limits and source traceability.
- [ ] Add deterministic tests for routing, tool failure, cancellation, retry bounds, and verification failure.
- [x] Add a deterministic orchestration run state machine with human approval gates, dependency checks based on recorded verified steps, bounded retries, verification state, evidence snapshots, immutable returned snapshots, cancellation, and terminal-state guards. This records state only; it does not execute tools or persist authoritative audit records.
- [x] Add tests for approval gates, dependency enforcement, bounded retries including verification failures, cancellation, cycle rejection, malformed evidence, and immutable snapshots.

## 07 — Enterprise governance
- [x] Local Guardrails console includes an audit-log UI, severity filters/search, SSE connection, policy drafts, JSON/CSV export, webhook test alerts, and a sandbox/model-output comparison interface.
- [x] React Query is used for local policy query/mutation state.
- [x] Incoming SSE events are now parsed through a bounded validator; malformed/oversized structured events are rejected and logged.
- [ ] Verify Flow Visualizer behavior against actual execution after an execution service is connected.
- [x] Label the current Flow Visualizer explicitly as an illustrative view derived from current state, not an actual execution trace.
- [ ] Verify severity filtering, search, SSE reconnect/error behavior, and the 500-event memory bound.
- [ ] Verify policy editor validation, import/export, edits, enable/disable, and browser persistence.
- [x] Make policy imports atomic, reject duplicate IDs case-insensitively, cap imports at 100 policies, and validate every imported policy before mutating browser state.
- [ ] Verify webhook threshold, explicit confirmation, failure reporting, and CORS constraints.
- [x] Add client-side HTTPS-only webhook validation, reject embedded credentials/fragments and common local/private-network destinations, and retain explicit confirmation and failure reporting. This is defense-in-depth, not a server-side SSRF control.
- [ ] Verify the three-model comparison semantics and keep manual-paste/heuristic scoring clearly labelled.
- [ ] Implement authenticated server-side telemetry, tenant authorization, redaction, and durable audit storage before production use.
- [ ] Implement authoritative versioned policy storage, server-side RBAC, immutable history, and enforcement in the request path.
- [ ] Replace estimated drift with documented measurements from versioned baselines and real events.
- [ ] Add server-side allowlisted Slack/email alert adapters, retries, rate limits, and delivery audit.
- [ ] Verify privacy, retention, deletion, and observability controls.

## 08 — UI reference and responsive acceptance
- [ ] Apply the supplied HTML reference's header, palette, headings, tabs, and metric styling without changing prompt behavior.
- [ ] Verify all tab navigation and key interactions at desktop and narrow widths.
- [ ] Run end-to-end browser acceptance for generation, linter, readiness, security, exports, and playground.

## Explicitly deferred
- Android conversion.
- Subscription, payment, and commercialization work.

## Closure criteria
A stage may be marked complete only when:
1. Its code is present on the target branch.
2. Relevant automated tests pass on the same commit.
3. Required manual/browser acceptance is recorded with the tested commit and environment.
4. Security, data-handling, and capability limitations are documented.
5. No unchecked required item remains in that stage.

## Current execution note
The GitHub connector can commit source changes and inspect GitHub Actions, but it does not establish that the user's local Windows environment or hosted preview was exercised. Do not mark browser/manual acceptance complete without recorded evidence.
