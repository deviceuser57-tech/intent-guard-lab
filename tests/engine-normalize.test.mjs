import test from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/lib/engine.mjs";

test("normalizes case, punctuation, and repeated whitespace", () => {
  assert.equal(normalize("  Prompt,   ENGINE!  "), "prompt engine");
});
test("preserves Arabic words and removes vowel marks/tatweel", () => {
  assert.equal(normalize("اَلْعَرَبِيَّةُ ـ اختبار"), "العربية اختبار");
});
test("preserves digits and letters from mixed-language input", () => {
  assert.equal(normalize("Model v2: إصدار ٣"), "model v2 إصدار ٣");
});
