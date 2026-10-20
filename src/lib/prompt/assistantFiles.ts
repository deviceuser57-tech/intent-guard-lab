import type { AdvancedControls } from "./types";

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_CONTENT = 80000;
export async function readAssistantFile(file: File): Promise<AdvancedControls["documents"][number]> {
  if (file.size > MAX_SIZE) throw new Error(`${file.name}: ${"الحد الأقصى 10 MB / Maximum 10 MB"}`);
  const extension = file.name.split(".").pop()?.toLowerCase();
  let content: string;
  if (extension === "xlsx" || extension === "xlsm") {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const lines: string[] = [];
    workbook.eachSheet(sheet => {
      lines.push(`Worksheet: ${sheet.name} | Rows: ${sheet.rowCount} | Columns: ${sheet.columnCount}`);
      sheet.eachRow(row => {
        if (lines.join("\n").length > MAX_CONTENT) return;
        const cells: string[] = [];
        row.eachCell(cell => {
          const formula = cell.formula;
          cells.push(`${cell.address}: ${formula ? `=${formula} | cached: ` : ""}${cell.text}`);
        });
        lines.push(cells.join(" | "));
      });
    });
    content = lines.join("\n");
    if (!content.trim()) throw new Error(`${file.name}: Empty workbook / مصنف فارغ`);
    content = "Workbook cell/formula extract only; VBA macros and external-link metadata are not analyzed or executed. / مقتطف الخلايا والمعادلات فقط؛ لا يتم تحليل أو تنفيذ الماكرو أو بيانات الروابط الخارجية.\n" + content;
  } else if (["txt", "md", "csv", "json"].includes(extension ?? "")) {
    content = await file.text();
  } else throw new Error(`${file.name}: Supported: .xlsx .xlsm .txt .md .csv .json / صيغة غير مدعومة`);
  return { name: file.name, content: content.length > MAX_CONTENT ? content.slice(0, MAX_CONTENT) + "\n[EXTRACT TRUNCATED / تم اقتطاع المحتوى]" : content };
}