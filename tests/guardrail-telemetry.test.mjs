import test from "node:test";
import assert from "node:assert/strict";
import { parseTelemetryEvent } from "../src/lib/guardrail-telemetry.mjs";

test("accepts valid structured telemetry and preserves an allowed level", () => {
  assert.deepEqual(
    parseTelemetryEvent(JSON.stringify({ level: "intent-drift", message: "Mismatch detected", source: "policy-service" })),
    { level: "intent-drift", message: "Mismatch detected", source: "policy-service" },
  );
});

test("supports plain-text SSE messages", () => {
  assert.deepEqual(parseTelemetryEvent("  stream connected  "), {
    level: "info",
    message: "stream connected",
    source: "SSE",
  });
});

test("rejects oversized, empty, and malformed structured events", () => {
  assert.equal(parseTelemetryEvent(""), null);
  assert.equal(parseTelemetryEvent("x".repeat(20_001)), null);
  assert.equal(parseTelemetryEvent('{"message":42}'), null);
  assert.equal(parseTelemetryEvent("null"), null);
  assert.equal(parseTelemetryEvent("[]"), null);
});

test("defaults unknown levels and bounds attacker-controlled fields", () => {
  const result = parseTelemetryEvent(JSON.stringify({
    level: "unexpected",
    message: "m".repeat(12_000),
    source: "s".repeat(300),
  }));
  assert.equal(result.level, "info");
  assert.equal(result.message.length, 10_000);
  assert.equal(result.source.length, 200);
});

test("strips unsafe control characters from plain-text events", () => {
  assert.deepEqual(parseTelemetryEvent("hello\\u0000world"), {
    level: "info",
    message: "helloworld",
    source: "SSE",
  });
});
