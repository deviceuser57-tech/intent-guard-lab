import type { AdvancedControls } from "./types";

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_CONTENT = 80000;

async function readDocx(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let entryOffset = -1;

  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      entryOffset = view.getUint32(i + 16, true);
      break;
    }
  }
  if (entryOffset < 0 || entryOffset >= bytes.length) {
    throw new Error(file.name + ": Invalid or unsupported DOCX archive");
  }

  let documentXml: string | null = null;
  let offset = entryOffset;
  while (offset + 46 <= bytes.length && view.getUint32(offset, true) === 0x02014b50) {
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (name === "word/document.xml") {
      if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error(file.name + ": Invalid DOCX document entry");
      }
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) {
        documentXml = new TextDecoder().decode(compressed);
      } else if (method === 8) {
        if (typeof DecompressionStream === "undefined") {
          throw new Error(file.name + ": This browser cannot extract DOCX files");
        }
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        documentXml = await new Response(stream).text();
      } else {
        throw new Error(file.name + ": Unsupported DOCX compression method");
      }
      break;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }

  if (!documentXml) throw new Error(file.name + ": No Word document content found");
  const xml = new DOMParser().parseFromString(documentXml, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error(file.name + ": Could not parse Word document content");

  const paragraphs: string[] = [];
  const visit = (node: Node, current: { text: string }) => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "p") {
      const paragraph = { text: "" };
      for (const child of Array.from(node.childNodes)) visit(child, paragraph);
      if (paragraph.text.trim()) paragraphs.push(paragraph.text);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "t") {
      current.text += node.textContent ?? "";
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === "tab") {
      current.text += "\t";
      return;
    }
    for (const child of Array.from(node.childNodes)) visit(child, current);
  };
  visit(xml.documentElement, { text: "" });
  const extracted = paragraphs.join("\n");
  if (!extracted.trim()) throw new Error(file.name + ": No readable text found in DOCX");
  return "Word document text extract only; embedded images, tracked changes and document formatting are not analyzed. / استخراج النص فقط؛ لا يتم تحليل الصور المضمنة أو تعقّب التغييرات أو تنسيق المستند.\n" + extracted;
}

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
  } else if (extension === "docx") {
    content = await readDocx(file);
  } else if (["txt", "md", "csv", "json"].includes(extension ?? "")) {
    content = await file.text();
  } else throw new Error(file.name + ": Supported: .docx .xlsx .xlsm .txt .md .csv .json / صيغة غير مدعومة");
  return { name: file.name, content: content.length > MAX_CONTENT ? content.slice(0, MAX_CONTENT) + "\n[EXTRACT TRUNCATED / تم اقتطاع المحتوى]" : content };
}