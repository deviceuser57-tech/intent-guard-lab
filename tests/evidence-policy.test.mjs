import test from "node:test";
import assert from "node:assert/strict";
import { prepareEvidenceSet, createEvidenceOutputContract } from "../src/lib/governance/evidencePolicy.mjs";

const context = {
  tenantId: "tenant-a",
  now: "2026-10-23T00:00:00.000Z",
  maxAgeDays: 30,
  allowedSources: ["approved-kb"],
};

test("filters tenant and permission boundaries before accepting evidence", () => {
  const result = prepareEvidenceSet([
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "s1", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: "Verified excerpt" },
    { tenantId: "tenant-b", authorized: true, source: "approved-kb", sourceId: "leak", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: "Secret" },
    { tenantId: "tenant-a", authorized: false, source: "approved-kb", sourceId: "denied", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: "Denied" },
    { tenantId: "tenant-a", authorized: true, source: "other", sourceId: "wrong-source", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: "Wrong source" },
  ], context);
  assert.deepEqual(result.items.map((item) => item.sourceId), ["s1"]);
  assert.equal(result.rejected.unauthorized, 3);
});

test("rejects stale or provenance-free retrieval records", () => {
  const result = prepareEvidenceSet([
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "stale", type: "retrieved", observedAt: "2026-01-01T00:00:00Z", excerpt: "Old fact" },
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "missing-date", type: "retrieved", excerpt: "No timestamp" },
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "unknown", type: "unknown", excerpt: "Unattributed claim" },
  ], context);
  assert.equal(result.items.length, 0);
  assert.equal(result.rejected.stale, 1);
  assert.equal(result.rejected.missingProvenance, 2);
});

test("deduplicates by source id and normalized content while bounding excerpts", () => {
  const result = prepareEvidenceSet([
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "s1", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: "Same   evidence" },
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "s2", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: " same evidence " },
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "s1", type: "retrieved", observedAt: "2026-10-22T00:00:00Z", excerpt: "Another excerpt" },
  ], context);
  assert.equal(result.items.length, 1);
  assert.equal(result.rejected.duplicate, 2);
  assert.equal(result.items[0].trust, "untrusted_reference_data");
});

test("user facts are labelled separately and output contract preserves unknowns", () => {
  const result = prepareEvidenceSet([
    { tenantId: "tenant-a", authorized: true, source: "approved-kb", sourceId: "user-note", type: "user_provided", excerpt: "User says the site was inspected" },
  ], context);
  assert.equal(result.items[0].trust, "user_supplied_claim");
  assert.equal(result.items[0].freshness, "not_applicable");
  assert.deepEqual(createEvidenceOutputContract().categories, [
    "user_provided_facts", "retrieved_evidence", "model_inference", "unknowns",
  ]);
  assert.equal(createEvidenceOutputContract().prohibitFabricatedCitations, true);
});

test("requires a trusted tenant context and bounds record count", () => {
  assert.throws(() => prepareEvidenceSet([], {}), /tenant id/);
  assert.throws(() => prepareEvidenceSet("not an array", context), /array/);
});
