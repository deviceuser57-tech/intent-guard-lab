import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

function keysInObject(source, declaration) {
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `Missing dictionary declaration: ${declaration}`);
  const open = source.indexOf("{", start);
  let depth = 1;
  let end = open + 1;
  while (end < source.length && depth > 0) {
    if (source[end] === "{") depth++;
    if (source[end] === "}") depth--;
    end++;
  }
  assert.equal(depth, 0, `Unclosed dictionary: ${declaration}`);
  return [...source.slice(open + 1, end - 1).matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]).sort();
}

test("English and Arabic dictionaries expose the same UI key contract", async () => {
  const source = await readFile(fileURLToPath(new URL("src/lib/i18n.ts", root)), "utf8");
  const english = keysInObject(source, "const en = {");
  const arabic = keysInObject(source, "const ar: Dict = {");
  assert.deepEqual(arabic, english);
  assert.ok(english.length > 50, "dictionary key extraction should cover the visible UI contract");
});
