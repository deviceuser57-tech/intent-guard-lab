/**
 * Client-side guard for the demo webhook sender.
 * This is defense-in-depth only; production destinations must be validated
 * and allowlisted by a trusted server to prevent SSRF and DNS rebinding.
 */
export function validateWebhookTarget(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { valid: false, reason: "Enter a webhook URL." };
  }
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return { valid: false, reason: "Enter a valid absolute URL." };
  }
  if (url.protocol !== "https:") {
    return { valid: false, reason: "Webhook URLs must use HTTPS." };
  }
  if (url.username || url.password) {
    return { valid: false, reason: "Embedded URL credentials are not allowed." };
  }
  if (url.hash) {
    return { valid: false, reason: "URL fragments are not allowed." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateHostname =
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  const parts = host.split(".");
  const ipv4 = parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  const privateIPv4 = ipv4 && (
    Number(parts[0]) === 10 ||
    Number(parts[0]) === 127 ||
    (Number(parts[0]) === 192 && Number(parts[1]) === 168) ||
    (Number(parts[0]) === 172 && Number(parts[1]) >= 16 && Number(parts[1]) <= 31) ||
    (Number(parts[0]) === 169 && Number(parts[1]) === 254) ||
    Number(parts[0]) === 0
  );
  if (privateHostname || privateIPv4) {
    return { valid: false, reason: "Local and private-network destinations are blocked by the demo client." };
  }
  url.username = "";
  url.password = "";
  return { valid: true, url };
}
