// Pure, deterministic derivation of an Excel output contract from a request and
// locally extracted workbook text (see assistantFiles.ts extract format).

export interface WorkbookInsights {
  sheets: string[];
  formulaCount: number;
  errorCells: string[];
  externalLinks: string[];
  auditSheets: string[];
  requestedSheets: string[];
}

const ERROR_RE = /#(REF!|VALUE!|NAME\?|DIV\/0!|N\/A|NULL!|NUM!)/;
const SHEET_TOKEN_RE = /\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/g;

export function analyzeWorkbookExtract(request: string, documents: { name: string; content: string }[]): WorkbookInsights {
  const sheets: string[] = [];
  const errorCells: string[] = [];
  const externalLinks: string[] = [];
  let formulaCount = 0;
  for (const doc of documents) {
    let sheet = "";
    for (const line of doc.content.split("\n")) {
      const header = /^Worksheet: (.+?) \| Rows:/.exec(line);
      if (header) { sheet = header[1] ?? ""; sheets.push(sheet); continue; }
      if (!sheet) continue;
      let last = "";
      for (const cell of line.split(" | ")) {
        if (cell.startsWith("cached: ")) {
          if (last && ERROR_RE.test(cell)) errorCells.push(last);
          continue;
        }
        const m = /^([A-Z]+\d+): (.*)$/.exec(cell);
        if (!m) continue;
        const address = m[1] ?? "", value = m[2] ?? "";
        last = `${sheet}!${address}`;
        if (value.startsWith("=")) {
          formulaCount++;
          if (/\[[^\]]+\]/.test(value) || /\.xls[xmb]?/i.test(value)) externalLinks.push(last);
        }
        if (ERROR_RE.test(value)) errorCells.push(last);
      }
    }
  }
  const requestedSheets = [...new Set(request.match(SHEET_TOKEN_RE) ?? [])];
  const auditSheets = [...new Set([
    ...sheets.filter(s => /audit|log|rev\d/i.test(s)),
    ...requestedSheets.filter(s => /audit|log|rev\d/i.test(s)),
  ])];
  return { sheets: [...new Set(sheets)], formulaCount, errorCells: [...new Set(errorCells)], externalLinks: [...new Set(externalLinks)], auditSheets, requestedSheets };
}

const list = (items: string[], max = 12) => items.slice(0, max).join(", ") + (items.length > max ? ` (+${items.length - max})` : "");

export function workbookContractConstraints(ins: WorkbookInsights, ar: boolean): string[] {
  const out: string[] = [];
  for (const s of ins.auditSheets) {
    const present = ins.sheets.includes(s);
    out.push(ar
      ? `اقرأ ورقة «${s}» أولًا واعتبر صفوفها مصدر قائمة الإصلاحات المعتمدة${present ? "" : "؛ الورقة غير موجودة في الملف المرفق، فتحقّق من وجودها وأبلغ بخطأ واضح إن غابت"}.`
      : `Read sheet "${s}" first and treat its rows as the approved repair list${present ? "" : "; it was not found in the attached file, so check it exists and fail with a clear message if missing"}.`);
  }
  if (ins.sheets.length) out.push(ar ? `أوراق العمل المكتشفة في الملف: ${list(ins.sheets)}. لا تفترض أوراقًا أخرى.` : `Worksheets detected in the file: ${list(ins.sheets)}. Do not assume other sheets.`);
  if (ins.formulaCount) out.push(ar ? `يحتوي الملف على ${ins.formulaCount} معادلة؛ سجّل كل معادلة تُعدّل (الأصلية والجديدة) في تقرير التغييرات.` : `The file contains ${ins.formulaCount} formulas; log every changed formula (original and replacement) in the change report.`);
  if (ins.errorCells.length) out.push(ar ? `خلايا بها أخطاء معادلات يجب معالجتها أو الإبلاغ عنها: ${list(ins.errorCells)}.` : `Cells with formula errors to repair or report: ${list(ins.errorCells)}.`);
  if (ins.externalLinks.length) out.push(ar ? `معادلات تشير إلى ملفات خارجية (روابط محتملة الانقطاع): ${list(ins.externalLinks)}. لا تحوّلها لقيم ثابتة دون موافقة.` : `Formulas referencing external workbooks (possibly broken links): ${list(ins.externalLinks)}. Do not convert them to static values without approval.`);
  return out;
}

export function workbookOutputSchema(ar: boolean): string {
  return ar
    ? "1) وحدة VBA كاملة قابلة للتشغيل. 2) جدول التغييرات: الورقة | الخلية | المعادلة الأصلية | المعادلة الجديدة | سبب الإصلاح من سجل المراجعة. 3) قائمة ما لم يُصلح ولماذا."
    : "1) Complete runnable VBA module. 2) Change table: Sheet | Cell | Original formula | New formula | Audit-log reason. 3) List of items not repaired and why.";
}
