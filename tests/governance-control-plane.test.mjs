import test from "node:test";
import assert from "node:assert/strict";
import {
  createCognitiveProfile,
  proposeLearningCandidate,
  reviewLearningCandidate,
  filterRetrievedDocuments,
  retrieveKnowledge,
  createOrchestrationPlan,
  authorizeOrchestrationStart,
  canRunOrchestrationStep,
  authorizeAction,
} from "../src/lib/governance/controlPlane.mjs";

test("cognitive profile requires principles and explicit limitations", () => {
  assert.throws(() => createCognitiveProfile({ id: "p", version: 1, name: "Base", principles: [], limitations: ["no override"] }));
  const profile = createCognitiveProfile({ id: "p", version: 1, name: "Base", principles: ["ground claims"], limitations: ["no tool authority"] });
  assert.match(profile.securityPolicy, /always override/);
  assert.equal(Object.isFrozen(profile), true);
});

test("learning remains pending until an independent reviewer approves it", () => {
  const candidate = proposeLearningCandidate({ id: "c1", feedback: "Add citations", createdBy: "alice", currentVersion: 4, evidence: ["case-1"] });
  assert.equal(candidate.status, "pending_review");
  assert.throws(() => reviewLearningCandidate(candidate, "alice", "approve"), /other than its creator/);
  const approved = reviewLearningCandidate(candidate, "bob", "approve");
  assert.equal(approved.status, "approved");
  assert.equal(approved.approvedVersion, 5);
  assert.equal(candidate.status, "pending_review");
});

test("retrieval fails closed across tenant, status, role, and source boundaries", () => {
  const docs = [
    { id: "ok", tenantId: "a", status: "approved", source: "kb", allowedRoles: ["reviewer"], content: "reference", score: 0.9 },
    { id: "tenant", tenantId: "b", status: "approved", source: "kb", allowedRoles: ["reviewer"], content: "leak", score: 1 },
    { id: "draft", tenantId: "a", status: "draft", source: "kb", allowedRoles: ["reviewer"], content: "unapproved", score: 1 },
    { id: "role", tenantId: "a", status: "approved", source: "kb", allowedRoles: ["admin"], content: "private", score: 1 },
    { id: "source", tenantId: "a", status: "approved", source: "external", allowedRoles: ["reviewer"], content: "not allowed", score: 1 },
  ];
  const result = filterRetrievedDocuments(docs, { tenantId: "a", roles: ["reviewer"], allowedSources: ["kb"] });
  assert.deepEqual(result.map((doc) => doc.id), ["ok"]);
  assert.equal(result[0].trust, "untrusted_reference_data");
});

test("orchestration rejects cycles and requires approval for high-risk tasks", () => {
  assert.throws(() => createOrchestrationPlan({ id: "x", task: "t", risk: "high", steps: [
    { id: "a", specialist: "research", objective: "a", dependsOn: ["b"] },
    { id: "b", specialist: "review", objective: "b", dependsOn: ["a"] },
  ] }), /cycle/);
  const plan = createOrchestrationPlan({ id: "x", task: "review a contract", risk: "high", steps: [
    { id: "a", specialist: "legal-review", objective: "extract clauses" },
  ] });
  assert.equal(plan.status, "awaiting_human_approval");
  assert.equal(plan.requiresHumanApproval, true);
});

test("authorization denies unknown roles, missing permissions, and cross-tenant access", () => {
  assert.equal(authorizeAction({ actor: { id: "u", role: "viewer" }, tenantId: "a", resourceTenantId: "b", permission: "knowledge:read" }).allowed, false);
  assert.equal(authorizeAction({ actor: { id: "u", role: "viewer" }, tenantId: "a", resourceTenantId: "a", permission: "policy:write" }).reason, "permission_denied");
  assert.equal(authorizeAction({ actor: { id: "u", role: "admin" }, tenantId: "a", resourceTenantId: "a", permission: "knowledge:read" }).allowed, true);
});

test("RAG retrieval applies access filters before relevance ranking", () => {
  const docs = [
    { id: "low", tenantId: "a", status: "approved", source: "kb", allowedRoles: ["reviewer"], content: "General operational notes", score: 1 },
    { id: "match", tenantId: "a", status: "approved", source: "kb", allowedRoles: ["reviewer"], content: "Helideck operational safety checklist", score: 0.2 },
    { id: "leak", tenantId: "b", status: "approved", source: "kb", allowedRoles: ["reviewer"], content: "Helideck secret checklist", score: 1 },
  ];
  const result = retrieveKnowledge("helideck safety checklist", docs, { tenantId: "a", roles: ["reviewer"], allowedSources: ["kb"] });
  assert.deepEqual(result.map((doc) => doc.id), ["match", "low"]);
  assert.equal(result[0].trust, "untrusted_reference_data");
  assert.throws(() => retrieveKnowledge("  ", docs, { tenantId: "a", roles: ["reviewer"] }), /non-empty/);
});

test("high-risk orchestration requires approval and respects dependency completion", () => {
  const plan = createOrchestrationPlan({ id: "sequence", task: "review", risk: "critical", steps: [
    { id: "extract", specialist: "extractor", objective: "extract facts" },
    { id: "verify", specialist: "verifier", objective: "verify facts", dependsOn: ["extract"] },
  ] });
  assert.equal(authorizeOrchestrationStart(plan).allowed, false);
  assert.equal(authorizeOrchestrationStart(plan, "reviewer-1").allowed, true);
  assert.equal(canRunOrchestrationStep(plan, "verify", []).allowed, false);
  assert.equal(canRunOrchestrationStep(plan, "verify", ["extract"]).allowed, true);
});


test("profile diffs show added and removed principles and limitations", async () => {
  const { createCognitiveProfile, diffCognitiveProfiles } = await import("../src/lib/governance/controlPlane.mjs");
  const before = createCognitiveProfile({
    id: "profile", version: 1, name: "Base", principles: ["ground claims", "cite sources"], limitations: ["no tool authority"],
  });
  const after = createCognitiveProfile({
    id: "profile", version: 2, name: "Research", principles: ["ground claims", "state unknowns"], limitations: ["no tool authority", "no policy override"],
  });
  const diff = diffCognitiveProfiles(before, after);
  assert.deepEqual(diff.principles.added, ["state unknowns"]);
  assert.deepEqual(diff.principles.removed, ["cite sources"]);
  assert.deepEqual(diff.limitations.added, ["no policy override"]);
  assert.equal(diff.nameChanged, true);
  assert.equal(Object.isFrozen(diff), true);
});

test("rollback creates a new version and preserves history", async () => {
  const { createCognitiveProfile, rollbackCognitiveProfile } = await import("../src/lib/governance/controlPlane.mjs");
  const v1 = createCognitiveProfile({ id: "p", version: 1, name: "Base", principles: ["truth"], limitations: ["no authority"] });
  const v2 = createCognitiveProfile({ id: "p", version: 2, name: "Changed", principles: ["speed"], limitations: ["no authority"] });
  const rolledBack = rollbackCognitiveProfile([v1, v2], 1, "reviewer-2");
  assert.equal(rolledBack.version, 3);
  assert.equal(rolledBack.name, "Base");
  assert.deepEqual(rolledBack.principles, ["truth"]);
  assert.deepEqual(rolledBack.rollback, {
    restoredContentFromVersion: 1, supersedesVersion: 2, actorId: "reviewer-2",
  });
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);
});

test("rollback rejects unknown targets, duplicate versions, and cross-profile histories", async () => {
  const { createCognitiveProfile, rollbackCognitiveProfile } = await import("../src/lib/governance/controlPlane.mjs");
  const v1 = createCognitiveProfile({ id: "p", version: 1, name: "Base", principles: ["truth"], limitations: ["no authority"] });
  const v2 = createCognitiveProfile({ id: "p", version: 2, name: "Changed", principles: ["speed"], limitations: ["no authority"] });
  assert.throws(() => rollbackCognitiveProfile([v1, v2], 8, "reviewer"), /target version/);
  assert.throws(() => rollbackCognitiveProfile([v1, v1], 1, "reviewer"), /Duplicate profile version/);
  const other = createCognitiveProfile({ id: "other", version: 2, name: "Other", principles: ["truth"], limitations: ["no authority"] });
  assert.throws(() => rollbackCognitiveProfile([v1, other], 1, "reviewer"), /one profile/);
});
