import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const rootPath = new URL("../", import.meta.url).pathname;
const git = (...args) => execFileSync("git", args, { cwd: rootPath, encoding: "utf8" }).trim();

test("tracked tree contains no environment or private-key files", () => {
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
  const forbidden = tracked.filter((path) =>
    /(^|\/)\.env(?:\..*)?$/.test(path) && !/(^|\/)\.env(?:\.[^/]+)?\.example$/.test(path) ||
    /\.(?:pem|key|p12|pfx)$/i.test(path)
  );
  assert.deepEqual(forbidden, [], `Potential secret-bearing files are tracked: ${forbidden.join(", ")}`);
});

test("gitignore excludes environment files and private key containers", async () => {
  const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  for (const rule of [" .env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx"]) {
    assert.ok(ignore.split(/\r?\n/).some((line) => line.trim() === rule.trim()), `Missing .gitignore rule: ${rule.trim()}`);
  }
  assert.match(ignore, /!\.env\.example/);
});

test("example environment file is present and contains no populated secret assignments", async () => {
  await stat(join(rootPath, ".env.example"));
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const populatedSecret = /^[ \t]*(?:[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*)[ \t]*=[ \t]*(?!$|#|\$\{)[^\r\n]+/gim;
  assert.equal([...example.matchAll(populatedSecret)].length, 0, ".env.example must use empty values or placeholders, not credentials");
});

test("tracked text files do not contain common high-confidence token formats", () => {
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
  const candidates = tracked.filter((path) =>
    /\.(?:mjs|cjs|js|jsx|ts|tsx|json|ya?ml|toml|env|example|md|txt)$/i.test(path) &&
    !/^tests\/secret-boundaries\.test\.mjs$/.test(path)
  );
  const patterns = [
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  ];
  const findings = [];
  for (const path of candidates) {
    const content = await readFile(join(rootPath, path), "utf8").catch(() => "");
    for (const pattern of patterns) if (pattern.test(content)) findings.push(path);
  }
  assert.deepEqual([...new Set(findings)], [], `Possible hard-coded credential pattern in: ${[...new Set(findings)].join(", ")}`);
});
