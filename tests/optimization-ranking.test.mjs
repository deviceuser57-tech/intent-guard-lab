import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("candidate ranking prioritizes severe-risk reduction before scores", async () => {
  const file = new URL("../src/lib/prompt/optimization.ts", import.meta.url);
  const source = await readFile(fileURLToPath(file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const optimization = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const candidates = [
    { index: 1, highRiskFindings: 1, judgeScore: 99, securityScore: 90, evaluationScore: 90, tokens: 100 },
    { index: 2, highRiskFindings: 0, judgeScore: 70, securityScore: 75, evaluationScore: 70, tokens: 250 },
    { index: 3, highRiskFindings: 0, judgeScore: 80, securityScore: 75, evaluationScore: 80, tokens: 100 },
    { index: 4, highRiskFindings: 0, judgeScore: 80, securityScore: 90, evaluationScore: 75, tokens: 300 },
  ];

  const ranked = optimization.rankCandidates(candidates);
  assert.deepEqual(ranked.map((candidate) => candidate.index), [2, 4, 3, 1]);
  assert.deepEqual(candidates.map((candidate) => candidate.index), [1, 2, 3, 4]);
});
