import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrchestrationRun,
  approveOrchestrationRun,
  startOrchestrationStep,
  recordOrchestrationAttempt,
  verifyOrchestrationStep,
  cancelOrchestrationRun,
} from "../src/lib/governance/orchestrationRuntime.mjs";

function plan(risk = "low") {
  return {
    id: "plan-1",
    requiresHumanApproval: risk === "high" || risk === "critical",
    steps: [
      { id: "extract", specialist: "extractor", objective: "Extract claims", dependsOn: [] },
      { id: "verify", specialist: "verifier", objective: "Verify claims", dependsOn: ["extract"] },
    ],
  };
}

test("high-risk runs require explicit human approval before starting", () => {
  const run = createOrchestrationRun(plan("high"));
  assert.equal(run.status, "awaiting_human_approval");
  assert.throws(() => startOrchestrationStep(run, "extract"), /not ready/);
  const approved = approveOrchestrationRun(run, "reviewer-1");
  assert.equal(approved.status, "ready");
  assert.equal(approved.approvedBy, "reviewer-1");
  assert.throws(() => approveOrchestrationRun(approved, "reviewer-2"), /not awaiting/);
});

test("step dependencies are enforced and successful work requires verification", () => {
  let run = createOrchestrationRun(plan());
  assert.throws(() => startOrchestrationStep(run, "verify"), /Dependencies incomplete/);
  run = startOrchestrationStep(run, "extract");
  run = recordOrchestrationAttempt(run, "extract", {
    outcome: "success",
    evidence: [{ sourceId: "doc-1", excerpt: "claim from source" }],
  });
  assert.equal(run.steps[0].status, "awaiting_verification");
  run = verifyOrchestrationStep(run, "extract", { passed: true });
  assert.equal(run.steps[0].status, "verified");
  run = startOrchestrationStep(run, "verify");
  run = recordOrchestrationAttempt(run, "verify", { outcome: "success" });
  run = verifyOrchestrationStep(run, "verify", { passed: true });
  assert.equal(run.status, "succeeded");
  assert.equal(run.steps[0].evidence[0].sourceId, "doc-1");
});

test("failures have a bounded retry budget and then fail the run", () => {
  let run = createOrchestrationRun(plan(), { maxRetries: 1 });
  run = startOrchestrationStep(run, "extract");
  run = recordOrchestrationAttempt(run, "extract", { outcome: "failure", error: "temporary" });
  assert.equal(run.steps[0].status, "retryable");
  run = startOrchestrationStep(run, "extract");
  run = recordOrchestrationAttempt(run, "extract", { outcome: "failure", error: "still broken" });
  assert.equal(run.steps[0].attempts.length, 2);
  assert.equal(run.steps[0].status, "failed");
  assert.equal(run.status, "failed");
  assert.throws(() => startOrchestrationStep(run, "extract"), /not ready/);
});

test("cancellation is terminal and snapshots are immutable", () => {
  const run = createOrchestrationRun(plan());
  const cancelled = cancelOrchestrationRun(run, "operator requested stop");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(Object.isFrozen(cancelled), true);
  assert.equal(Object.isFrozen(cancelled.steps), true);
  assert.throws(() => cancelOrchestrationRun(cancelled), /Terminal runs/);
});

test("retry configuration is bounded and malformed evidence is ignored", () => {
  assert.throws(() => createOrchestrationRun(plan(), { maxRetries: 4 }), /between 0 and 3/);
  let run = createOrchestrationRun(plan(), { maxRetries: 0 });
  run = startOrchestrationStep(run, "extract");
  run = recordOrchestrationAttempt(run, "extract", {
    outcome: "success",
    evidence: [{ sourceId: "", excerpt: "bad" }, { sourceId: "source-2", excerpt: "ok" }],
  });
  assert.deepEqual(run.steps[0].evidence.map((item) => item.sourceId), ["source-2"]);
});

test("verification failures consume the same bounded retry budget", () => {
  let run = createOrchestrationRun({ id: "single", requiresHumanApproval: false, steps: [
    { id: "only", specialist: "worker", objective: "Do work", dependsOn: [] },
  ] }, { maxRetries: 1 });
  run = startOrchestrationStep(run, "only");
  run = recordOrchestrationAttempt(run, "only", { outcome: "success" });
  run = verifyOrchestrationStep(run, "only", { passed: false, reason: "unsupported claim" });
  assert.equal(run.steps[0].status, "retryable");
  run = startOrchestrationStep(run, "only");
  run = recordOrchestrationAttempt(run, "only", { outcome: "success" });
  run = verifyOrchestrationStep(run, "only", { passed: false, reason: "still unsupported" });
  assert.equal(run.steps[0].status, "failed");
  assert.equal(run.status, "failed");
});

test("dependencies cannot be spoofed by caller-supplied completion identifiers", () => {
  const run = createOrchestrationRun(plan());
  assert.throws(() => startOrchestrationStep(run, "verify"), /Dependencies incomplete/);
});


test("run creation rejects cyclic dependencies and freezes dependency lists", () => {
  assert.throws(() => createOrchestrationRun({
    id: "cycle",
    requiresHumanApproval: false,
    steps: [
      { id: "a", specialist: "worker", objective: "A", dependsOn: ["b"] },
      { id: "b", specialist: "worker", objective: "B", dependsOn: ["a"] },
    ],
  }), /dependency cycle/);
  const run = createOrchestrationRun(plan());
  assert.equal(Object.isFrozen(run.steps[1].dependsOn), true);
});


test("rejects malformed evidence payloads instead of trusting their shape", () => {
  let run = createOrchestrationRun({ id: "evidence", requiresHumanApproval: false, steps: [
    { id: "work", specialist: "worker", objective: "Do work", dependsOn: [] },
  ] });
  run = startOrchestrationStep(run, "work");
  assert.throws(() => recordOrchestrationAttempt(run, "work", {
    outcome: "success", evidence: "not-an-array",
  }), /evidence must be an array/);
});
