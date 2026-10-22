# Intent Guard Lab — Revised Modifications Plan

**Repository:** `deviceuser57-tech/intent-guard-lab`  
**Revision reviewed:** `2a16910` (`Fixed background task delivery`)  
**Deliverables:** human-readable plan, plus machine-readable JSON and TypeScript backlog files.  
**No repository source files were changed.**

## Executive recommendation

The upgrade proposal identifies a useful next milestone: connect the already-built free guided assistant to the main Workbench. Repository inspection confirms that `RequestAssistant.tsx`, `templates.ts`, `assistantFiles.ts`, and `requestAssistant.ts` exist, but `Workbench.tsx` does not import or render `RequestAssistant`. The correct next product release should integrate that guided flow, localize diagnostics and model explanations, repair the reported test-harness failure after reproducing it, and validate the database setup documentation. SaaS billing and Android packaging should remain a separate later phase behind security, product, and platform decisions.

**Security stop-ship:** the public repository tracks `.env`. I did not read the file contents. Revoke and rotate any credentials that may have been committed, remove `.env` from Git, add ignore rules and a sanitized example file, and run secret scanning. If purging Git history is needed, coordinate the operation because the repository is connected to Lovable; credential rotation is required regardless.

## What is already implemented

| Capability | Repository evidence | Status |
|---|---|---|
| Free request-assistant building blocks | `src/lib/prompt/templates.ts`, `assistantFiles.ts`, `requestAssistant.ts` | Implemented as modules. |
| Five-stage bilingual assistant UI | `src/components/RequestAssistant.tsx` | Implemented but not integrated into Workbench. |
| Prompt analysis, specification, compilation, linting, readiness, evaluation and red-team heuristics | `src/lib/prompt/*`; consumed from `Workbench.tsx` | Present; tests cover several engine behaviors. |
| Bilingual shell and model selectors | `src/lib/i18n.ts`, `Workbench.tsx`, `ModelSettings.tsx` | Present, but generated diagnostic and provider help copy needs more complete Arabic coverage. Current model selectors already identify provider families; richer explanations are a proposed improvement. |
| Prompt registry, lifecycle and local audit | `src/lib/prompt/registry.ts` | Implemented locally. It is not server-side immutable audit storage. |
| Optional cloud registry | `src/lib/cloudRegistry.ts`; `drizzle/migrations/0000_prompt_registries.sql` | App query and Drizzle migration use `prompt_registries`. The separate `docs/supabase-cloud-storage.sql` instead defines `intent_guard_registry`; reconcile the docs/setup paths rather than changing the app table blindly. |
| Guardrails / operations console | `src/components/GuardrailConsole.tsx`, `docs/intentguard-operations.md` | Prototype capabilities are present; docs correctly state telemetry is not a durable production audit and policies are not an authoritative enforcement service. |
| Tests and CI | `tests/*.test.mjs`, `.github/workflows/CI.yml` | CI is set to run tests, lint and build. Local tests were not run in this review because dependencies were absent. |

## Recommended delivery phases

### Phase 0 — Public-repository credential hygiene (P0, before other releases)

1. Revoke and rotate any credentials that may have been committed in `.env`; include model-provider and cloud/backend credentials as applicable.
2. Remove `.env` from the tracked tree, add `.env` and `.env.*` ignore rules with a deliberate exception for a sanitized `.env.example`, and document setup variables without values.
3. Run a secret scanner against the working tree and repository history. Purge history only with an agreed Lovable/repository synchronization plan; do not force-push casually. Rotation remains mandatory even after history cleanup.
4. Add secret scanning or push protection in GitHub and a CI check.

**Files:** `.env` (do not print or inspect contents), `.gitignore`, `.env.example`, CI workflow, security documentation.  
**Done when:** no usable credentials remain; `.env` is no longer tracked; clean-clone scanning passes; a safe example documents configuration.

### Phase 1 — Integrate the free guided assistant into Workbench (P1, next feature release)

1. Import `RequestAssistant` in `src/components/Workbench.tsx` and render it in or immediately above `.workbench-request`, as proposed. Keep the current direct request field and archetype selector available so users can bypass the guide.
2. Wire `lang`, `input`, `override`, and `onInput` to existing Workbench state. The assistant’s `onAdopt` receives an `AssistantDraft` with `source`, `specification`, and `inputValues`.
3. On adoption, update the Workbench input, specification and analysis from the accepted draft, clear stale AI optimizer output, and navigate to Compiled Prompts. Derive the analysis from the adopted goal and chosen archetype using the existing analyzer contract, or extend `AssistantDraft` with the analysis so the source of truth is explicit.
4. **Do not call the current `run()` callback from `onAdopt`.** In `Workbench.tsx`, `run()` derives a fresh `defaultSpec(input, analysis)` and would overwrite the assistant’s reviewed specification and its constraints/advanced settings. Factor a shared “apply request / generate” handler that accepts the exact adopted specification, or set the relevant state directly.
5. The proposed setters `setAdv` and `setPlaygroundInputs` do not exist in the current `Workbench.tsx`. The Playground stores variable values internally in `Playground` (`vals` state), so add an explicit `initialValues` prop and a controlled/reset strategy. Ensure accepted `draft.inputValues` appear in matching `{{variable}}` fields when the Playground is opened; reset stale values when prompt identity/variable set changes.
6. Verify document behavior. `assistantFiles.ts` reads supported files client-side, and `synthesizeRequest()` places document names/content into `AdvancedControls.documents` / generated inputs. Preserve the local-only promise; show accepted types, size limits, parsing errors and a clear notice before any later model call sends extracted text to a provider.
7. Add cancel/edit/restart behavior and avoid losing the user’s typed task when closing the assistant. Confirm template selection and the three-question flow preserve the original task as intended.

**Files:** `src/components/Workbench.tsx`, `src/components/RequestAssistant.tsx`, `src/components/Playground` (currently nested in `Workbench.tsx`), `src/lib/prompt/requestAssistant.ts`, tests.  
**Acceptance:** an end-to-end test starts with a task, completes the guided flow, edits the review, adopts it, and observes the exact adopted constraints/output format in Specification and Compiled Prompts; variable values are prefilled in Playground; no second generation overwrites them; closing or restarting does not silently discard the source task.

### Phase 2 — Arabic diagnostic localization and provider explanations (P1)

1. Replace brittle translation-by-display-string logic with stable diagnostic IDs and typed message keys. Linter findings and readiness blockers should carry stable codes; `i18n.ts` maps those codes to English and Arabic. Keep unknown codes readable with a fallback rather than hiding them.
2. Translate diagnostic titles, explanations, remediation text, component labels, readiness blockers, and relevant status/accessibility announcements—not just the top-level headings.
3. Improve `ModelSettings.tsx` with bilingual provider cards that describe provider families and suitable task characteristics, privacy/key handling, endpoint requirements and the connection-test step.
4. Do **not** hard-code the particular model-version recommendations in the attachment (for example Claude 3.5 or Gemini 2.0) as current advice. Model catalogs change. Prefer provider-family descriptions plus user-editable model IDs, or source a dynamic, maintained model catalog with a “last verified” date and no unsupported performance claims.
5. Review Arabic RTL, mixed-script IDs/code, focus order, screen-reader labels and mobile wrapping on the model and diagnostics panels.

**Files:** `src/lib/i18n.ts`, `src/lib/prompt/linter.ts`, `readiness.ts`, diagnostic types, `src/components/ModelSettings.tsx`, governance panels in `Workbench.tsx`, tests.  
**Acceptance:** every known linter/readiness code has English and Arabic strings; unknown codes fall back safely; language switching does not change codes or engine logic; provider descriptions contain no stale model claims; Arabic UI passes RTL smoke tests.

### Phase 3 — Reproduce and fix the prompt-engine test import failure (P1, release gate)

1. Reproduce `NameTooLong` on the reported Node version with a clean dependency install. The current test harness in `tests/prompt-engines.test.mjs` transpiles TypeScript and imports `data:text/javascript;base64,...` URLs. Several other tests use similar data URLs. The attachment’s diagnosis is plausible, but was not independently verified because dependencies were not installed.
2. Prefer a test loader that writes transpiled modules to a temporary directory and imports them by `file:` URL, preserving/re-writing relative module links as needed; alternatively use a maintained TypeScript-aware test runner if compatible with CI and repository conventions. Avoid blindly “direct importing” TypeScript source unless the chosen Node/test runtime and all imported dependencies support it.
3. Keep the existing test assertions, especially the known classifier-drift test, until the classification migration explicitly changes expected behavior. Do not remove tests merely to obtain a green run.
4. Run the entire suite, lint, and build locally and in CI. Record the Node version and exact command.

**Files:** `tests/prompt-engines.test.mjs`, potentially shared test loader and `package.json`, `.github/workflows/CI.yml`.  
**Acceptance:** the failure is reproduced before the fix; `npm test`, lint and build pass on CI’s Node 22 from a clean install; no data-URL length failure; all current safety/regression assertions remain meaningful.

### Phase 4 — Reconcile cloud-registry schema and setup documentation (P1)

1. Treat `prompt_registries` as the current code/Drizzle-migration name: `src/lib/cloudRegistry.ts`, generated Supabase types and `drizzle/migrations/0000_prompt_registries.sql` use that name.
2. Correct or retire the conflicting standalone setup SQL in `docs/supabase-cloud-storage.sql`, which defines `intent_guard_registry` and additional workspace tables. Decide whether it is a separate legacy path or the intended setup. Do not instruct users to run a schema that does not match current client queries.
3. Document the canonical migration sequence and test it against a clean Supabase project. Include RLS ownership tests and workspace-member tests if the workspace feature remains in the setup SQL.
4. Surface background sync failures instead of swallowing them in `cloudRegistry.ts`, and add retry/status feedback. Keep the documented last-write-wins limitation until conflict detection is implemented.

**Files:** `src/lib/cloudRegistry.ts`, `src/integrations/supabase/types.ts`, Drizzle migrations, `docs/supabase-cloud-storage.sql`, `docs/model-providers-cloud-sync.md`, cloud panel tests.  
**Acceptance:** one canonical table/schema path is documented and executable; integration tests prove the app can read/write the migrated table under RLS; failures are user-visible and retryable.

### Phase 5 — Broader reliability and security hardening (P1/P2)

- Align legacy and decision-engine classification; add a bilingual benchmark and deterministic confusion/tie handling.
- Make inferred vs measured vs untested statuses consistent. Static red-team findings must not imply executed adversarial tests or a security certification.
- Harden custom provider endpoints against SSRF, alternate/private IPv6 representations, redirects and DNS rebinding; add timeouts, response-size caps, key redaction, schema validation and usage limits.
- Add browser-level tests for model setup, generation, registry lifecycle, cloud sync errors, export, guardrails and Arabic RTL. Break up the oversized `Workbench.tsx` into smaller behavioral components as needed for testing.
- Keep the operator console’s demo/local data clearly separated from production telemetry and enforcement. Implement authenticated ingestion and server-side policy enforcement only if product scope calls for an actual operations service.

### Phase 6 — Monetization and Android (P3, separate product decision)

Do not start with payment code or signing keys. First decide product packaging, supported regions, billing provider, entitlements, refund/cancellation rules, customer support ownership, privacy/data-retention terms, and whether Android subscriptions are sold in-app or through web checkout. Verify the current Google Play and payment-provider requirements before implementation.

**Web subscription backend:**
- Create a subscription/entitlement schema with provider customer/subscription IDs, status, plan, billing period, renewal/cancel timestamps, and auditable event IDs. Avoid storing card data.
- Add a single payment provider first (Stripe *or* Paddle, selected after a requirements review), with verified webhook signatures, idempotency, replay-safe state transitions, and server-side entitlement checks.
- Enforce plan limits on the server, not by hiding UI controls. Add migrations, RLS, billing portal/cancellation behavior, test/sandbox mode, and webhook replay tests.
- Do not let a client return URL or UI state grant Pro/Enterprise access.

**Android app:**
- Evaluate Capacitor compatibility for TanStack Start SSR/server routes, OAuth/redirect flows, file import, clipboard, downloads, and hosted model calls before promising a wrapper “without reprogramming.”
- Build a proof-of-concept Android app and test on a real device before committing to release scope. Add native billing integration only after confirming current store rules for the chosen purchase path.
- Produce the Android App Bundle through a documented CI/signing process. Store signing material in an approved secret manager/CI secret store; never commit signing keys or passwords. Verify entitlements server-side and define account deletion/data export/privacy disclosures.

**Acceptance:** sandbox purchase lifecycle is idempotent and server-authoritative; entitlements survive webhook retries and cancellation/refund events; Android build installs on device; signing credentials are not in Git; purchase policy is confirmed before production submission.

## Updated priority order

1. **P0:** public `.env` exposure response and repository secret scanning.
2. **P1:** integrate `RequestAssistant` without overwriting the reviewed specification; add the correct Playground variable handoff.
3. **P1:** diagnose/fix the test import error with a preserved test suite and green CI.
4. **P1:** diagnostic translations and explanatory bilingual provider cards, avoiding stale model-version claims.
5. **P1:** reconcile the SQL documentation with the actual `prompt_registries` code/migration and test RLS/sync.
6. **P1/P2:** classification/evidence/provider security and browser-level reliability.
7. **P3:** SaaS billing and Android after policy, architecture and product decisions.

## Verification limits

Repository contents and source paths above were reviewed. The attachment’s claims about clean `tsgo` output and the `NameTooLong` failure were not independently executed. Dependencies were absent, so this review did not run the tests, linter, type check, or build. The proposed model-version descriptions were not validated as current catalog recommendations and are therefore intentionally replaced by version-neutral guidance. No repository files were changed.
