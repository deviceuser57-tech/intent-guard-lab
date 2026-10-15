export interface RegistrySnapshot {
  assets: unknown[];
  audit: unknown[];
}
export interface CloudConnection {
  url: string;
  anonKey: string;
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email?: string;
}
const SESSION_KEY = "intent-guard.cloud-session.v1";

// Registry changes trigger best-effort cloud persistence only after the user connects.
if (typeof window !== "undefined") {
  window.addEventListener("intent-guard:registry-changed", (event: Event) => {
    const connection = getCloudConnection();
    if (!connection) return;
    const detail = (event as CustomEvent<RegistrySnapshot>).detail;
    if (detail) void writeCloudRegistry(detail).catch(() => {
      // Local persistence remains the source of continuity when the cloud is temporarily unavailable.
    });
  });
}

export function getCloudConnection(): CloudConnection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CloudConnection;
    return parsed.url && parsed.anonKey && parsed.accessToken && parsed.userId ? parsed : null;
  } catch { return null; }
}
function saveConnection(connection: CloudConnection) {
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, JSON.stringify(connection));
}
export function disconnectCloud() {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
}

async function authRequest(url: string, anonKey: string, path: string, body: unknown) {
  const response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 400 || response.status === 401
    ? "Sign-in failed. Check the email, password, and Supabase Auth configuration."
    : `Supabase authentication failed (HTTP ${response.status}).`);
  return result;
}

export async function signInCloud(url: string, anonKey: string, email: string, password: string): Promise<CloudConnection> {
  const cleanUrl = url.trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-zA-Z0-9.-]+$/.test(cleanUrl)) throw new Error("Enter a valid Supabase project URL (https://...).");
  if (!anonKey.trim() || !email.trim() || !password) throw new Error("Supabase URL, anon key, email and password are required.");
  const result = await authRequest(cleanUrl, anonKey.trim(), "token?grant_type=password", { email: email.trim(), password });
  if (!result.access_token || !result.user?.id) throw new Error("Supabase did not return a valid authenticated session.");
  const connection: CloudConnection = {
    url: cleanUrl, anonKey: anonKey.trim(), accessToken: result.access_token,
    ...(result.refresh_token ? { refreshToken: result.refresh_token } : {}),
    userId: result.user.id, ...(result.user.email ? { email: result.user.email } : {}),
  };
  saveConnection(connection);
  return connection;
}

async function authorizedRequest(connection: CloudConnection, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", connection.anonKey);
  headers.set("Authorization", `Bearer ${connection.accessToken}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${connection.url.replace(/\/+$/, "")}${path}`, { ...init, headers });
}

export async function readCloudRegistry(): Promise<RegistrySnapshot | null> {
  const connection = getCloudConnection();
  if (!connection) return null;
  const response = await authorizedRequest(connection,
    `/rest/v1/intent_guard_registry?select=registry&user_id=eq.${encodeURIComponent(connection.userId)}&limit=1`);
  if (!response.ok) throw new Error(response.status === 404
    ? "Cloud table not found. Run docs/supabase-cloud-storage.sql in the Supabase SQL editor."
    : `Could not read cloud registry (HTTP ${response.status}). Check the SQL migration and RLS policies.`);
  const rows = await response.json() as Array<{ registry: RegistrySnapshot }>;
  return rows[0]?.registry ?? null;
}

export async function writeCloudRegistry(snapshot: RegistrySnapshot): Promise<void> {
  const connection = getCloudConnection();
  if (!connection) return;
  const response = await authorizedRequest(connection,
    "/rest/v1/intent_guard_registry?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: connection.userId, registry: snapshot, updated_at: new Date().toISOString() }),
    });
  if (!response.ok) throw new Error(response.status === 404
    ? "Cloud table not found. Run docs/supabase-cloud-storage.sql in Supabase first."
    : `Could not save cloud registry (HTTP ${response.status}). Check the table grants and RLS policies.`);
}
