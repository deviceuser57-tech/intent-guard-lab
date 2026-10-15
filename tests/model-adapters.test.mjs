import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

async function loadTs(relativePath) {
  const file = new URL(relativePath, import.meta.url);
  const source = await readFile(fileURLToPath(file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("model adapters preserve prompt content and apply provider conventions", async () => {
  const { adaptPromptForModel } = await loadTs("../src/lib/prompt/modelAdapters.ts");
  const prompt = {
    system: "Act as an expert.\n## Constraints\nBe accurate.",
    user: "Review {{code}}.",
  };

  const claude = adaptPromptForModel(prompt, {
    provider: "anthropic",
    model: "claude-3-7-sonnet",
  });
  assert.match(claude.system, /<instructions>/);
  assert.match(claude.user, /<task>/);
  assert.match(claude.user, /\{\{code\}\}/);

  const reasoning = adaptPromptForModel(prompt, {
    provider: "deepseek",
    model: "deepseek-reasoner",
  });
  assert.match(reasoning.system, /Do not reveal private chain-of-thought/);
  assert.match(reasoning.user, /Review \{\{code\}\}/);

  const compatible = adaptPromptForModel(prompt, {
    provider: "openai-compatible",
    model: "custom-model-v1",
  });
  assert.equal(compatible.system, prompt.system);
  assert.equal(compatible.user, prompt.user);
});

test("persisted model settings deliberately exclude API secrets", async () => {
  const { safePersistedConfig } = await loadTs("../src/lib/prompt/providerTypes.ts");
  const persisted = safePersistedConfig({
    provider: "openai",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "never-persist-this",
  });
  assert.deepEqual(persisted, {
    provider: "openai",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
  });
  assert.equal("apiKey" in persisted, false);
});
