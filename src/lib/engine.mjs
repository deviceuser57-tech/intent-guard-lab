/**
 * Shared lexical normalization for deterministic prompt-intent matching.
 * Preserves letters and digits across scripts (including Arabic), removes
 * Arabic vowel marks/tatweel, and collapses punctuation and whitespace.
 */
export function normalize(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
