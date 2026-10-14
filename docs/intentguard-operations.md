# IntentGuard Operations Console

## Current behavior and boundaries

The console is an operator workbench, not a complete policy enforcement service.

- **Audit stream:** starts with visibly identified demo events. To ingest production telemetry, configure an SSE endpoint that emits `text/event-stream` messages. Each message may be plain text or JSON such as `{"level":"intent-drift","message":"...","source":"policy-service"}`. Accepted levels are `info`, `high-risk`, `intent-drift`, and `policy-violation`. The browser keeps at most 500 events in memory; it does not persist a production audit trail.
- **Policy drafts:** stored in the current browser's localStorage. Import validates every policy before merging by ID; export creates a portable JSON file. This is not shared storage, access-controlled governance, or backend enforcement.
- **JSON policy schema:** a policy document must be an object with a non-empty `rules` array. Each rule has a unique non-empty `id`, at least one non-empty `description`, `term`, or `pattern`, and an `action` of `block`, `review`, `allow`, or `log`. Natural-language policies are stored as human-readable drafts and are not machine-interpreted.
- **Output comparison:** scores are heuristic phrase matches, not model benchmarks, semantic policy evaluation, or safety certification. The operator must paste the outputs from models they actually ran.
- **Drift alerts:** the displayed percentage is a deterministic estimate from the current workbench risk/findings, not a measured historical drift rate. The browser can POST a minimal test event to an operator-supplied HTTP(S) webhook after explicit confirmation. Browser CORS and endpoint authentication rules still apply. Do not include credentials in the URL; never put webhook tokens in client code.
- **Prompt sandbox:** invokes the existing server-side AI function and needs the deployment's server-side `LOVABLE_API_KEY`. The sandbox request does not make localStorage policies globally enforced.
- **Export:** audit JSON/CSV are client-generated. CSV cells are quoted and formula-like leading characters are neutralized. Print/Save PDF uses the browser print dialog.

## Production integration contracts

Before relying on this console operationally, implement and deploy these services:

1. **Authenticated telemetry endpoint** — SSE over HTTPS; authenticate the operator, authorize access per tenant, redact secrets/PII, validate event payloads server-side, and persist audit records before broadcasting.
2. **Authoritative policy service** — server-side schema validation, versioned policy storage, RBAC, immutable change history, and enforcement in the request path before/after model calls. Do not treat client state as authoritative.
3. **Drift measurement** — compute drift from versioned baselines and real evaluation/production events; document the numerator, denominator, sampling window, and confidence/uncertainty. Replace the UI estimate before using it for paging.
4. **Alert adapter** — server-side, allowlisted integrations for Slack/email or approved webhooks, with secrets in deployment environment/secret storage, rate limits, delivery retries, and audit logs. Avoid a generic server-side fetch proxy to arbitrary user-supplied URLs.
5. **Multi-model evaluation** — provider adapters, per-provider configuration, reproducible evaluation sets, cost/latency capture, and repeatable scoring. Keep the current manual-paste comparison labelled as such until this exists.

## Manual smoke-test checklist

- [ ] Open the Guardrails tab with no prior browser data; verify the sample log explicitly says it is demo data.
- [ ] Save valid JSON with two rules; verify it appears in the list and survives a page reload in the same browser.
- [ ] Try malformed JSON, an empty rules array, a duplicate rule ID, an invalid action, and a rule with no description/term/pattern; each must be rejected with a useful message.
- [ ] Save a natural-language draft shorter than 12 characters; verify validation rejects it.
- [ ] Edit a saved policy and update it; verify it does not create a duplicate entry. Disable and re-enable it, then delete it.
- [ ] Export policies, clear browser storage, import the exported file, and verify policies restore. Try a malformed import and verify no partial import occurs.
- [ ] Enter an SSE URL and verify connection/error status; send a JSON event with each accepted level and a plain-text event.
- [ ] Enter an invalid URL or a URL with embedded credentials; verify it is rejected before opening a stream or sending an alert.
- [ ] Confirm webhook sends only after threshold is crossed and the operator confirms the destination origin.
- [ ] Export audit CSV with a message starting with `=`, `+`, `-`, or `@`; verify the exported cell is neutralized for spreadsheet software.
- [ ] Run the repository's `npm run lint` and `npm run build` on the deployment's supported Node version.

## Validation status

Changes made through the GitHub connector have not been executed in the user's local Windows environment. Treat the checklist above as pending until run against the merged branch and deployment.