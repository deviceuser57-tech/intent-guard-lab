import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("provider exporters preserve existing adapters and validate Gemini payloads", async () => {
  const file = new URL("../src/lib/prompt/exporters.ts", import.meta.url);
  const source = await readFile(fileURLToPath(file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exporters = await import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
  const prompt = {
    system: "Act as a careful assistant.",
    user: "Summarize the supplied content.",
    outputContract: "Markdown",
    variables: [],
  };

  assert.equal(exporters.validateOpenAI(exporters.toOpenAI(prompt)).valid, true);
  assert.equal(exporters.validateAnthropic(exporters.toAnthropic(prompt)).valid, true);
  const gemini = exporters.toGemini(prompt);
  assert.match(gemini.endpoint, /models\/gemini-2\.5-pro:generateContent$/);
  assert.deepEqual(gemini.body.systemInstruction.parts, [{ text: prompt.system }]);
  assert.deepEqual(gemini.body.contents, [{ role: "user", parts: [{ text: prompt.user }] }]);
  assert.equal(exporters.validateGemini(gemini).valid, true);

  const invalid = { ...gemini, body: { ...gemini.body, contents: [] } };
  assert.equal(exporters.validateGemini(invalid).valid, false);
});
