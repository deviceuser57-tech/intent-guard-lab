/**
 * Shared lexical normalization for deterministic prompt-intent matching.
 * Preserves letters and digits across scripts (including Arabic), removes
 * Arabic vowel marks/tatweel, normalizes common Arabic alef variants, and
 * collapses punctuation and whitespace. This is not stemming or translation.
 */
export function normalize(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
