/**
 * Deterministic orchestration run state machine.
 *
 * This module records and validates execution transitions; it does not invoke
 * tools or models. Callers must enforce server-side authorization and persist
 * each returned immutable snapshot in an authoritative audit store.
 */
const MAX_RETRIES = 3;
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function snapshot(run, updates) {
  return Object.freeze({
    ...run,
    ...updates,
    steps: Object.freeze((updates.steps ?? run.steps).map((step) => Object.freeze({
      ...step,
      attempts: Object.freeze([...step.attempts]),
      evidence: Object.freeze([...step.evidence]),
    }))),
    events: Object.freeze([...(updates.events ?? run.events)]),
  });
}

function event(run, type, stepId, details = {}) {
  return Object.freeze({
    sequence: run.events.length + 1,
    type,
    stepId: stepId ?? null,
    at: new Date().toISOString(),
    ...details,
  });
}

export function createOrchestrationRun(plan, options = {}) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.steps) || !plan.steps.length) {
    throw new TypeError("A valid orchestration plan with steps is required");
  }
  const maxRetries = options.maxRetries ?? 1;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES) {
    throw new RangeError(`maxRetries must be an integer between 0 and ${MAX_RETRIES}`);
  }
  const steps = plan.steps.map((step) => ({
    id: requiredString(step.id, "step id"),
    specialist: requiredString(step.specialist, "step specialist"),
    objective: requiredString(step.objective, "step objective"),
    dependsOn: [...(step.dependsOn ?? [])],
    status: "planned",
    attempts: [],
    evidence: [],
    verification: "not_run",
    error: null,
  }));
  const ids = new Set(steps.map((step) => step.id));
  if (ids.size !== steps.length) throw new TypeError("Step identifiers must be unique");
  for (const step of steps) {
    for (const dependency of step.dependsOn) {
      if (!ids.has(dependency) || dependency === step.id) {
        throw new TypeError(`Invalid dependency ${dependency} for step ${step.id}`);
      }
    }
  }
  const needsApproval = Boolean(plan.requiresHumanApproval);
  const run = {
    id: requiredString(options.runId ?? `${plan.id}-run`, "run id"),
    planId: requiredString(plan.id, "plan id"),
    status: needsApproval ? "awaiting_human_approval" : "ready",
    requiresHumanApproval: needsApproval,
    approvedBy: null,
    maxRetries,
    steps,
    events: [],
    createdAt: new Date().toISOString(),
  };
  return snapshot(run, { events: [event(run, "run_created", null, { status: run.status })] });
}

export function approveOrchestrationRun(run, approverId) {
  if (!run || run.status !== "awaiting_human_approval") {
    throw new Error("Run is not awaiting human approval");
  }
  const approvedBy = requiredString(approverId, "approver id");
  const next = { ...run, status: "ready", approvedBy };
  return snapshot(next, { events: [...run.events, event(run, "human_approved", null, { approvedBy })] });
}

export function startOrchestrationStep(run, stepId) {
  if (!run || run.status !== "ready" && run.status !== "running") {
    throw new Error("Run is not ready to execute");
  }
  const id = requiredString(stepId, "step id");
  const index = run.steps.findIndex((step) => step.id === id);
  if (index < 0) throw new Error("Unknown orchestration step");
  const step = run.steps[index];
  if (step.status !== "planned" && step.status !== "retryable") {
    throw new Error("Step is not eligible to start");
  }
  const completed = new Set(run.steps.filter((item) => item.status === "verified").map((item) => item.id));
  const missing = step.dependsOn.filter((dependency) => !completed.has(dependency));
  if (missing.length) throw new Error(`Dependencies incomplete: ${missing.join(", ")}`);
  const steps = run.steps.map((item, i) => i === index ? { ...item, status: "running", error: null } : item);
  const next = { ...run, status: "running", steps };
  return snapshot(next, { events: [...run.events, event(run, "step_started", id, { attempt: step.attempts.length + 1 })] });
}

export function recordOrchestrationAttempt(run, stepId, result) {
  if (!run || run.status !== "running") throw new Error("Run is not executing");
  const id = requiredString(stepId, "step id");
  const index = run.steps.findIndex((step) => step.id === id);
  if (index < 0) throw new Error("Unknown orchestration step");
  const step = run.steps[index];
  if (step.status !== "running") throw new Error("Step must be running before recording an attempt");
  if (!result || !["success", "failure"].includes(result.outcome)) {
    throw new TypeError("Attempt outcome must be success or failure");
  }
  const attempt = Object.freeze({
    number: step.attempts.length + 1,
    outcome: result.outcome,
    error: result.outcome === "failure" ? String(result.error ?? "Unspecified failure").slice(0, 1000) : null,
    at: new Date().toISOString(),
  });
  const attempts = [...step.attempts, attempt];
  const evidence = result.evidence === undefined ? step.evidence : [
    ...step.evidence,
    ...result.evidence.filter((item) => item && typeof item.sourceId === "string" && item.sourceId.trim())
      .map((item) => Object.freeze({ sourceId: item.sourceId.trim(), excerpt: String(item.excerpt ?? "").slice(0, 2000) })),
  ];
  const succeeded = result.outcome === "success";
  const canRetry = !succeeded && attempts.length <= run.maxRetries;
  const updated = {
    ...step,
    attempts,
    evidence,
    status: succeeded ? "awaiting_verification" : canRetry ? "retryable" : "failed",
    verification: "not_run",
    error: succeeded ? null : attempt.error,
  };
  const steps = run.steps.map((item, i) => i === index ? updated : item);
  const anyFailed = steps.some((item) => item.status === "failed");
  const allDone = steps.every((item) => item.status === "verified");
  const nextStatus = anyFailed ? "failed" : allDone ? "succeeded" : "running";
  const next = { ...run, status: nextStatus, steps };
  return snapshot(next, { events: [...run.events, event(run, "attempt_recorded", id, {
    outcome: result.outcome, attempt: attempt.number, retryAvailable: canRetry,
  })] });
}

export function verifyOrchestrationStep(run, stepId, result) {
  if (!run || run.status !== "running") throw new Error("Run is not executing");
  const id = requiredString(stepId, "step id");
  const index = run.steps.findIndex((step) => step.id === id);
  if (index < 0) throw new Error("Unknown orchestration step");
  const step = run.steps[index];
  if (step.status !== "awaiting_verification") throw new Error("Step is not awaiting verification");
  if (!result || typeof result.passed !== "boolean") throw new TypeError("Verification must specify passed as a boolean");
  const canRetry = !result.passed && step.attempts.length <= run.maxRetries;
  const updated = {
    ...step,
    status: result.passed ? "verified" : canRetry ? "retryable" : "failed",
    verification: result.passed ? "passed" : "failed",
    error: result.passed ? null : String(result.reason ?? "Verification failed").slice(0, 1000),
  };
  const steps = run.steps.map((item, i) => i === index ? updated : item);
  const nextStatus = steps.some((item) => item.status === "failed") ? "failed" : steps.every((item) => item.status === "verified") ? "succeeded" : "running";
  const next = { ...run, status: nextStatus, steps };
  return snapshot(next, { events: [...run.events, event(run, "verification_recorded", id, {
    passed: result.passed, reason: updated.error,
  })] });
}

export function cancelOrchestrationRun(run, reason = "Cancelled by authorized caller") {
  if (!run || TERMINAL.has(run.status)) throw new Error("Terminal runs cannot be cancelled or changed");
  const note = String(reason).trim().slice(0, 500) || "Cancelled";
  const steps = run.steps.map((step) => step.status === "verified" || step.status === "failed"
    ? step : { ...step, status: "cancelled", error: note });
  const next = { ...run, status: "cancelled", steps };
  return snapshot(next, { events: [...run.events, event(run, "run_cancelled", null, { reason: note })] });
}
