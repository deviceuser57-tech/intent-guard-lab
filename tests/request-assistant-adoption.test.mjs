import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);
async function loadTypeScript(path, transform = (source) => source) {
  const filePath = new URL(path, root);
  const source = transform(await readFile(fileURLToPath(filePath), "utf8"));
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const analyzer = await loadTypeScript("src/lib/prompt/intentAnalyzer.ts");
globalThis.__requestAssistantTestAnalyzer = analyzer;
const assistant = await loadTypeScript("src/lib/prompt/requestAssistant.ts", (source) =>
  source
    .replace(
      'import { analyzeIntent } from "./intentAnalyzer";',
      "const { analyzeIntent } = globalThis.__requestAssistantTestAnalyzer;",
    )
    .replace(
      'import { defaultSpec, DEFAULT_ADV } from "./compiler";',
      "const { defaultSpec, DEFAULT_ADV } = {};",
    ),
);

test("adoption preserves the reviewed specification and source", () => {
  const specification = {
    goal: "Prepare a market strategy with documented assumptions.",
    archetype: "software",
    persona: "User-selected specialist",
    audience: "Executive team",
    tone: "professional",
    constraints: ["Do not invent market data", "Show assumptions"],
    outputFormat: "json",
    outputSchema: '{"summary":"string"}',
    components: ["task", "constraints", "output_contract"],
    variables: [{ name: "input", description: "Source data", example: "" }],
    examples: "",
    reasoning: "brief",
    maxWords: 700,
    advanced: {
      executiveDoc: true,
      confidence: "evidence_weighted",
      selfRedTeam: true,
      brutalTruth: false,
      documents: [],
      docsWeight: 100,
    },
  };
  const draft = {
    source: "Create a market strategy",
    specification,
    inputValues: { input: "Synthetic test data", user_request: "Review this request" },
  };

  const adopted = assistant.prepareAssistantAdoption(draft);

  assert.equal(adopted.source, draft.source);
  assert.equal(adopted.specification, specification);
  assert.deepEqual(adopted.specification.constraints, specification.constraints);
  assert.deepEqual(adopted.specification.advanced, specification.advanced);
  assert.equal(adopted.analysis.archetype, "software");
});

test("adoption copies variable values for the Playground", () => {
  const draftValues = { input: "Synthetic content", user_request: "Synthetic request" };
  const adopted = assistant.prepareAssistantAdoption({
    source: "Build an analysis prompt",
    specification: { goal: "Analyze a supplied dataset", archetype: "analytics" },
    inputValues: draftValues,
  });

  assert.deepEqual(adopted.inputValues, draftValues);
  assert.notEqual(adopted.inputValues, draftValues);
  adopted.inputValues.input = "edited value";
  assert.equal(draftValues.input, "Synthetic content");
});
