export function csvCell(value) {
  // Neutralize spreadsheet formula injection while preserving CSV quoting.
  const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function validatePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return false;
  const candidate = policy;
  return (
    typeof candidate.id === "string" &&
    Boolean(candidate.id.trim()) &&
    typeof candidate.name === "string" &&
    Boolean(candidate.name.trim()) &&
    (candidate.mode === "json" || candidate.mode === "natural") &&
    typeof candidate.content === "string" &&
    Boolean(candidate.content.trim()) &&
    typeof candidate.enabled === "boolean"
  );
}

export function validatePolicyContent(mode, content) {
  if (typeof content !== "string" || !content.trim()) return "Policy content is required.";
  if (mode === "natural")
    return content.trim().length < 12
      ? "Describe the policy in at least 12 characters."
      : null;
  if (mode !== "json") return "Unsupported policy mode.";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON.";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return "JSON root must be an object.";
  const doc = parsed;
  if (doc.name !== undefined && typeof doc.name !== "string")
    return 'Optional "name" must be a string.';
  if (!Array.isArray(doc.rules) || doc.rules.length === 0)
    return 'Policy JSON must contain a non-empty "rules" array.';
  const ids = new Set();
  for (let i = 0; i < doc.rules.length; i++) {
    const rule = doc.rules[i];
    if (!rule || typeof rule !== "object" || Array.isArray(rule))
      return `Rule ${i + 1} must be an object.`;
    const item = rule;
    if (typeof item.id !== "string" || !item.id.trim())
      return `Rule ${i + 1} needs a non-empty string "id".`;
    if (ids.has(item.id)) return `Duplicate rule id: ${item.id}.`;
    ids.add(item.id);
    if (
      ![item.description, item.term, item.pattern].some(
        (v) => typeof v === "string" && v.trim(),
      )
    )
      return `Rule "${item.id}" needs a description, term, or pattern.`;
    if (!["block", "review", "allow", "log"].includes(String(item.action)))
      return `Rule "${item.id}" action must be block, review, allow, or log.`;
  }
  return null;
}

export function scoreOutput(value, policyText) {
  const text = value.toLowerCase();
  let terms = [];
  try {
    const parsed = JSON.parse(policyText);
    terms = (parsed.rules ?? []).flatMap((rule) =>
      [rule.description, rule.term, rule.pattern].filter(
        (v) => typeof v === "string" && Boolean(v.trim()),
      ),
    );
  } catch {
    // Natural-language policy is not machine-enforceable by this phrase matcher.
  }
  const matched = terms.filter((term) => text.includes(term.toLowerCase()));
  const score = Math.max(
    0,
    Math.min(
      100,
      70 +
        Math.min(20, Math.floor(value.length / 120)) -
        matched.length * 25 -
        (value.trim() ? 0 : 70),
    ),
  );
  return {
    score,
    matched,
    verdict: matched.length
      ? "Review required: configured phrase matched."
      : value.trim()
        ? "No exact configured phrase matched; this is not policy enforcement or a safety certification."
        : "No output provided.",
  };
}
