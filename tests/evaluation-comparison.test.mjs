import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("evaluation comparison reports score deltas and token cost", async () => {
  const file = new URL("../src/lib/prompt/evaluation.ts", import.meta.url);
  const source = await readFile(fileURLToPath(file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const evaluation = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const baseline = {
    metrics: [{ key: "coverage", value: 80 }, { key: "correctness", value: 90 }],
    tokens: { system: 100, user: 50, total: 150 },
    overall: 85,
    tests: [],
  };
  const candidate = {
    metrics: [{ key: "coverage", value: 95 }, { key: "correctness", value: 70 }],
    tokens: { system: 100, user: 60, total: 160 },
    overall: 82,
    tests: [],
  };

  const comparison = evaluation.compareEvaluations(baseline, candidate);
  assert.equal(comparison.overallDelta, -3);
  assert.equal(comparison.tokenDelta, 10);
  assert.deepEqual(comparison.improvements, ["coverage"]);
  assert.deepEqual(comparison.regressions, ["correctness"]);
});
