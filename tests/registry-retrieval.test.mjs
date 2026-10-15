import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("registry retrieval returns relevant published examples only", async () => {
  const root = new URL("../", import.meta.url);
  const engine = await import(new URL("src/lib/engine.mjs", root));
  globalThis.__intentGuardRegistryTestEngine = engine;
  const file = new URL("../src/lib/prompt/registry.ts", import.meta.url);
  const source = (await readFile(fileURLToPath(file), "utf8")).replace(
    'import { normalize } from "../engine.mjs";',
    "const { normalize } = globalThis.__intentGuardRegistryTestEngine;",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const registryModule = await import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
  const asset = (id, name, status, archetype, system, securityScore) => ({
    id,
    name,
    status,
    archetype,
    versions: [
      {
        version: "1.0.0",
        createdAt: "2026-01-01T00:00:00.000Z",
        prompt: {
          system,
          user: "Analyze vessel maintenance records.",
          outputContract: "Markdown",
          variables: [],
        },
        note: "Approved maintenance example",
        securityScore,
      },
    ],
  });
  const assets = [
    asset(
      "published-1",
      "Vessel maintenance analysis",
      "published",
      "research",
      "Analyze vessel maintenance records and flag overdue inspection.",
      90,
    ),
    asset(
      "published-2",
      "Vessel safety checklist",
      "published",
      "research",
      "Review vessel safety records and identify missing checks.",
      80,
    ),
    asset(
      "draft-1",
      "Vessel maintenance draft",
      "draft",
      "research",
      "Analyze vessel maintenance records.",
      99,
    ),
    asset(
      "other-1",
      "Vessel maintenance software",
      "published",
      "software",
      "Write vessel maintenance code.",
      95,
    ),
  ];

  const results = registryModule.searchPublishedAssets(
    assets,
    "vessel maintenance inspection",
    "research",
    3,
  );
  assert.deepEqual(
    results.map((result) => result.assetId),
    ["published-1", "published-2"],
  );
  assert.equal(results[0].version, "1.0.0");
  assert.equal(results[0].relevance, 1);
  assert.equal(results[1].relevance, 2 / 3);
  assert.deepEqual(results[0].matchedTerms, ["vessel", "maintenance", "inspection"]);
});
