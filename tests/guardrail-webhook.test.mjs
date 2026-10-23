import test from "node:test";
import assert from "node:assert/strict";
import { validateWebhookTarget } from "../src/lib/guardrail-webhook.mjs";

test("accepts a public HTTPS webhook URL", () => {
  const result = validateWebhookTarget("https://hooks.example.com/events");
  assert.equal(result.valid, true);
  assert.equal(result.url.hostname, "hooks.example.com");
});

test("rejects HTTP, malformed URLs, and embedded credentials", () => {
  assert.match(validateWebhookTarget("http://hooks.example.com").reason, /HTTPS/);
  assert.match(validateWebhookTarget("https://user:pass@hooks.example.com").reason, /credentials/);
  assert.equal(validateWebhookTarget("not a url").valid, false);
  assert.equal(validateWebhookTarget("").valid, false);
});

test("blocks common localhost and private IPv4 destinations", () => {
  for (const url of [
    "https://localhost/hook",
    "https://service.local/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.8/hook",
    "https://172.20.0.5/hook",
    "https://192.168.1.4/hook",
    "https://169.254.1.2/hook",
  ]) {
    assert.equal(validateWebhookTarget(url).valid, false, url);
  }
});

test("rejects URL fragments and IPv6 loopback", () => {
  assert.equal(validateWebhookTarget("https://hooks.example.com/hook#secret").valid, false);
  assert.equal(validateWebhookTarget("https://[::1]/hook").valid, false);
});

test("blocks IPv6 unspecified, link-local, unique-local, multicast, and IPv4-mapped literals", () => {
  for (const url of [
    "https://[::]/hook",
    "https://[fc00::1]/hook",
    "https://[fd12::1]/hook",
    "https://[fe90::1]/hook",
    "https://[febf::1]/hook",
    "https://[ff02::1]/hook",
    "https://[::ffff:127.0.0.1]/hook",
  ]) {
    assert.equal(validateWebhookTarget(url).valid, false, url);
  }
});
