export const TELEMETRY_LEVELS = ["info", "high-risk", "intent-drift", "policy-violation"];

/**
 * Parse an untrusted SSE message into a bounded audit event.
 * Plain-text SSE is supported; malformed structured JSON is not silently accepted.
 */
export function parseTelemetryEvent(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 20_000) return null;

  let payload;
  let isJson = false;
  try {
    payload = JSON.parse(raw);
    isJson = true;
  } catch {
    payload = null;
  }

  if (!isJson) {
    const message = cleanText(raw, 10_000);
    return message ? { level: "info", message, source: "SSE" } : null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const level = TELEMETRY_LEVELS.includes(payload.level) ? payload.level : "info";
  if (payload.message !== undefined && typeof payload.message !== "string") return null;
  if (payload.source !== undefined && typeof payload.source !== "string") return null;

  const message = cleanText(payload.message ?? "", 10_000);
  const source = cleanText(payload.source ?? "SSE", 200);
  if (!message || !source) return null;
  return { level, message, source };
}

function cleanText(value, maxLength) {
  return value
    .replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}
