import test from "node:test";
import assert from "node:assert/strict";
import {
  csvCell,
  scoreOutput,
  validatePolicy,
  validatePolicyContent,
} from "../src/lib/guardrail-policy.mjs";

const valid = JSON.stringify({
  name: "Example",
  rules: [{ id: "no-token", term: "secret token", action: "block" }],
});

test("accepts a valid JSON policy", () => assert.equal(validatePolicyContent("json", valid), null));
test("rejects malformed JSON and non-object roots", () => {
  assert.match(validatePolicyContent("json", "{oops"), /JSON|position|property/i);
  assert.match(validatePolicyContent("json", "[]"), /root must be an object/i);
});
test("requires at least one rule", () =>
  assert.match(
    validatePolicyContent("json", JSON.stringify({ rules: [] })),
    /non-empty "rules" array/i,
  ));
test("rejects duplicate rule IDs", () => {
  const policy = {
    rules: [
      { id: "same", term: "a", action: "block" },
      { id: "same", term: "b", action: "review" },
    ],
  };
  assert.match(validatePolicyContent("json", JSON.stringify(policy)), /Duplicate rule id/);
});
test("validates each rule's matcher and action", () => {
  assert.match(
    validatePolicyContent("json", JSON.stringify({ rules: [{ id: "x", action: "block" }] })),
    /description, term, or pattern/,
  );
  assert.match(
    validatePolicyContent(
      "json",
      JSON.stringify({ rules: [{ id: "x", term: "x", action: "ignore" }] }),
    ),
    /action must be/,
  );
});
test("requires useful natural-language content", () => {
  assert.match(validatePolicyContent("natural", "short"), /at least 12 characters/);
  assert.equal(validatePolicyContent("natural", "Never reveal confidential records."), null);
});
test("validates imported policy shape", () => {
  assert.equal(
    validatePolicy({ id: "a", name: "A", mode: "json", content: valid, enabled: true }),
    true,
  );
  assert.equal(
    validatePolicy({ id: "a", name: "A", mode: "json", content: valid, enabled: "yes" }),
    false,
  );
});
test("scores exact configured phrase matches without claiming certification", () => {
  const result = scoreOutput("This includes a secret token.", valid);
  assert.equal(result.matched.length, 1);
  assert.match(result.verdict, /Review required/);
  assert.match(scoreOutput("A normal response.", valid).verdict, /not policy enforcement/);
});
test("neutralizes formula-like CSV cells and escapes quotes", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('hello "world"'), '"hello ""world"""');
});


test("rejects imported policies whose content is invalid even when the outer shape is valid", () => {
  assert.equal(
    validatePolicy({ id: "a", name: "A", mode: "json", content: "{broken", enabled: true }),
    false,
  );
  assert.equal(
    validatePolicy({ id: "a", name: "A", mode: "natural", content: "short", enabled: true }),
    false,
  );
});

test("rejects whitespace-only policy identifiers and names", () => {
  assert.equal(
    validatePolicy({ id: "   ", name: "A", mode: "json", content: valid, enabled: true }),
    false,
  );
  assert.equal(
    validatePolicy({ id: "a", name: "   ", mode: "json", content: valid, enabled: true }),
    false,
  );
});


test("normalizes valid policy imports atomically and rejects duplicate identifiers", async () => {
  const { normalizeImportedPolicies } = await import("../src/lib/guardrail-policy.mjs");
  const result = normalizeImportedPolicies([
    { id: " policy-a ", name: " Policy A ", mode: "json", content: valid, enabled: true },
  ]);
  assert.equal(result[0].id, "policy-a");
  assert.equal(result[0].name, "Policy A");
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => normalizeImportedPolicies([
    { id: "Policy-A", name: "A", mode: "json", content: valid, enabled: true },
    { id: " policy-a ", name: "B", mode: "json", content: valid, enabled: false },
  ]), /Duplicate policy id/);
});

test("rejects oversized or partly invalid imports without returning partial data", async () => {
  const { normalizeImportedPolicies } = await import("../src/lib/guardrail-policy.mjs");
  assert.throws(() => normalizeImportedPolicies([]), /non-empty/);
  assert.throws(() => normalizeImportedPolicies(Array(101).fill({
    id: "a", name: "A", mode: "json", content: valid, enabled: true,
  })), /At most 100/);
  assert.throws(() => normalizeImportedPolicies([
    { id: "a", name: "A", mode: "json", content: valid, enabled: true },
    { id: "b", name: "B", mode: "json", content: "{broken", enabled: true },
  ]), /valid shape and content/);
});
