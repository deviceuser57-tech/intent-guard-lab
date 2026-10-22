import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const source = await readFile(fileURLToPath(new URL("src/lib/prompt/assistantFiles.ts", root)), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

function parseXml(xml) {
  const documentElement = { nodeType: 1, localName: "#document", childNodes: [] };
  const stack = [documentElement];
  for (const token of xml.matchAll(/<([^>]+)>|([^<]+)/g)) {
    if (token[2]) {
      stack.at(-1).childNodes.push({ nodeType: 3, textContent: token[2], childNodes: [] });
      continue;
    }
    const raw = token[1].trim();
    if (raw.startsWith("?") || raw.startsWith("!")) continue;
    if (raw.startsWith("/")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const qualifiedName = raw.replace(/\/$/, "").split(/\s/, 1)[0];
    const node = {
      nodeType: 1,
      localName: qualifiedName.split(":").at(-1),
      childNodes: [],
      get textContent() { return this.childNodes.map(child => child.textContent ?? "").join(""); },
    };
    stack.at(-1).childNodes.push(node);
    if (!selfClosing) stack.push(node);
  }
  return documentElement.childNodes[0];
}

globalThis.DOMParser = class {
  parseFromString(xml) {
    const documentElement = parseXml(xml);
    return {
      documentElement,
      querySelector: selector => selector === "parsererror" ? null : null,
    };
  }
};

const { readAssistantFile } = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);

function makeStoredDocx(xml) {
  const name = Buffer.from("word/document.xml");
  const data = Buffer.from(xml, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const localEntry = Buffer.concat([local, name, data]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const centralEntry = Buffer.concat([central, name]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralEntry.length, 12);
  end.writeUInt32LE(localEntry.length, 16);
  return Buffer.concat([localEntry, centralEntry, end]);
}

function fileFromBytes(name, bytes) {
  const exact = Uint8Array.from(bytes);
  return {
    name,
    size: exact.length,
    arrayBuffer: async () => exact.buffer.slice(exact.byteOffset, exact.byteOffset + exact.byteLength),
    text: async () => new TextDecoder().decode(exact),
  };
}

test("reads paragraphs from a valid DOCX document", async () => {
  const bytes = makeStoredDocx(
    '<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>First paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t><w:tab/><w:t>line</w:t></w:r></w:p></w:body></w:document>',
  );
  const result = await readAssistantFile(fileFromBytes("sample.docx", bytes));

  assert.equal(result.name, "sample.docx");
  assert.match(result.content, /First paragraph/);
  assert.match(result.content, /Second\tline/);
  assert.match(result.content, /embedded images, tracked changes/);
});

test("rejects a malformed DOCX archive with a useful error", async () => {
  await assert.rejects(
    readAssistantFile(fileFromBytes("broken.docx", Buffer.from("not a zip archive"))),
    /Invalid or unsupported DOCX archive/,
  );
});

test("reports DOCX as supported and rejects unsupported extensions", async () => {
  await assert.rejects(
    readAssistantFile(fileFromBytes("legacy.doc", Buffer.from("text"))),
    /Supported: \.docx \.xlsx \.xlsm \.txt \.md \.csv \.json/,
  );
});
