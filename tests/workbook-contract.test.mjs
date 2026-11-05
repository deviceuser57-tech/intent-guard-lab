import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const src = await readFile(fileURLToPath(new URL("../src/lib/prompt/workbookContract.ts", import.meta.url)), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const extract = [
  "Workbook cell/formula extract only",
  "Worksheet: Data | Rows: 3 | Columns: 2",
  "A1: =SUM(B1:B2) | cached: 5 | A2: =Missing!A1 | cached: #REF!",
  "A3: ='[Old.xlsx]Sheet1'!A1 | cached: 1",
  "Worksheet: REV3_AUDIT_LOG | Rows: 2 | Columns: 2",
  "A1: Cell | B1: Fix",
].join("\n");

test("detects sheets, formulas, error cells and external links", () => {
  const r = mod.analyzeWorkbookExtract("راجع REV3_AUDIT_LOG", [{ name: "f.xlsx", content: extract }]);
  assert.deepEqual(r.sheets, ["Data", "REV3_AUDIT_LOG"]);
  assert.equal(r.formulaCount, 3);
  assert.deepEqual(r.errorCells, ["Data!A2"]);
  assert.deepEqual(r.externalLinks, ["Data!A3"]);
  assert.deepEqual(r.auditSheets, ["REV3_AUDIT_LOG"]);
});

test("audit sheet named only in the request still becomes a contract rule", () => {
  const r = mod.analyzeWorkbookExtract("كود إكسيل يراجع ملف REV3_AUDIT_LOG", []);
  assert.deepEqual(r.auditSheets, ["REV3_AUDIT_LOG"]);
  const rules = mod.workbookContractConstraints(r, true);
  assert.ok(rules[0].includes("REV3_AUDIT_LOG"));
  assert.ok(rules[0].includes("غير موجودة"));
});
