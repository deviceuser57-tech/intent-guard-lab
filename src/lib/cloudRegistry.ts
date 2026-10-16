export interface RegistrySnapshot {
  assets: unknown[];
  audit: unknown[];
}

export interface CloudWorkspace {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "editor";
}

export interface CloudConnection {
  url: string;
  anonKey: string;
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email?: string;
  activeWorkspaceId?: string;
}

const SESSION_KEY = "intent-guard.cloud-session.v1";

if (typeof window !== "undefined") {
  window.addEventListener("intent-guard:registry-changed", (event: Event) => {
    if (!getCloudConnection()) return;
    const detail = (event as CustomEvent<RegistrySnapshot>).detail;
    if (detail)
      void writeCloudRegistry(detail).catch(() => {
        // Local persistence remains available if cloud sync is temporarily unavailable.
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
  } catch {
    return null;
  }
}

function saveConnection(connection: CloudConnection) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(connection));
  }
}

export function setActiveCloudWorkspace(workspaceId?: string) {
  const connection = getCloudConnection();
  if (!connection) throw new Error("Connect to Supabase first.");
  const next = { ...connection };
  if (workspaceId) next.activeWorkspaceId = workspaceId;
  else delete next.activeWorkspaceId;
  saveConnection(next);
  return next;
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
  if (!response.ok) {
    throw new Error(
      response.status === 400 || response.status === 401
        ? "Sign-in failed. Check the email, password, and Supabase Auth configuration."
        : `Supabase authentication failed (HTTP ${response.status}).`,
    );
  }
  return result as Record<string, unknown>;
}

export async function signInCloud(
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<CloudConnection> {
  const cleanUrl = url.trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-zA-Z0-9.-]+$/.test(cleanUrl)) {
    throw new Error("Enter a valid Supabase project URL (https://...).");
  }
  if (!anonKey.trim() || !email.trim() || !password) {
    throw new Error("Supabase URL, anon key, email and password are required.");
  }
  const result = await authRequest(cleanUrl, anonKey.trim(), "token?grant_type=password", {
    email: email.trim(),
    password,
  });
  const user = (result["user"] ?? {}) as Record<string, unknown>;
  if (typeof result["access_token"] !== "string" || typeof user["id"] !== "string") {
    throw new Error("Supabase did not return a valid authenticated session.");
  }
  const connection: CloudConnection = {
    url: cleanUrl,
    anonKey: anonKey.trim(),
    accessToken: result["access_token"],
    ...(typeof result["refresh_token"] === "string"
      ? { refreshToken: result["refresh_token"] }
      : {}),
    userId: user["id"],
    ...(typeof user["email"] === "string" ? { email: user["email"] } : {}),
  };
  saveConnection(connection);
  return connection;
}

async function authorizedRequest(
  connection: CloudConnection,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("apikey", connection.anonKey);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");
    return fetch(`${connection.url.replace(/\/+$/, "")}${path}`, { ...init, headers });
  };

  let response = await send(connection.accessToken);
  if (response.status === 401 && connection.refreshToken) {
    try {
      const refreshed = await authRequest(
        connection.url,
        connection.anonKey,
        "token?grant_type=refresh_token",
        { refresh_token: connection.refreshToken },
      );
      if (typeof refreshed["access_token"] === "string") {
        const next: CloudConnection = {
          ...connection,
          accessToken: refreshed["access_token"],
          ...(typeof refreshed["refresh_token"] === "string"
            ? { refreshToken: refreshed["refresh_token"] }
            : {}),
        };
        saveConnection(next);
        response = await send(next.accessToken);
      }
    } catch {
      // The caller receives the original unauthorized response and can reconnect.
    }
  }
  return response;
}

export async function readCloudRegistry(): Promise<RegistrySnapshot | null> {
  const connection = getCloudConnection();
  if (!connection) return null;

  const path = connection.activeWorkspaceId
    ? `/rest/v1/intent_guard_workspace_registry?select=registry&workspace_id=eq.${encodeURIComponent(connection.activeWorkspaceId)}&limit=1`
    : `/rest/v1/intent_guard_registry?select=registry&user_id=eq.${encodeURIComponent(connection.userId)}&limit=1`;
  const response = await authorizedRequest(connection, path);
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Cloud table not found. Run docs/supabase-cloud-storage.sql in the Supabase SQL editor."
        : `Could not read cloud registry (HTTP ${response.status}). Check the SQL migration and RLS policies.`,
    );
  }
  const rows = (await response.json()) as Array<{ registry: RegistrySnapshot }>;
  return rows[0]?.registry ?? null;
}

export async function writeCloudRegistry(snapshot: RegistrySnapshot): Promise<void> {
  const connection = getCloudConnection();
  if (!connection) return;

  const workspaceId = connection.activeWorkspaceId;
  const path = workspaceId
    ? "/rest/v1/intent_guard_workspace_registry?on_conflict=workspace_id"
    : "/rest/v1/intent_guard_registry?on_conflict=user_id";
  const body = workspaceId
    ? {
        workspace_id: workspaceId,
        registry: snapshot,
        updated_by: connection.userId,
        updated_at: new Date().toISOString(),
      }
    : {
        user_id: connection.userId,
        registry: snapshot,
        updated_at: new Date().toISOString(),
      };
  const response = await authorizedRequest(connection, path, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Cloud table not found. Run docs/supabase-cloud-storage.sql in Supabase first."
        : `Could not save cloud registry (HTTP ${response.status}). Check the table grants and RLS policies.`,
    );
  }
}

export async function listCloudWorkspaces(): Promise<CloudWorkspace[]> {
  const connection = getCloudConnection();
  if (!connection) return [];
  const path = `/rest/v1/intent_guard_workspace_members?select=workspace_id,role,workspace:intent_guard_workspaces(id,name,owner_id)&user_id=eq.${encodeURIComponent(connection.userId)}`;
  const response = await authorizedRequest(connection, path);
  if (!response.ok) {
    throw new Error("Could not list workspaces. Run the updated SQL migration and check RLS.");
  }
  const rows = (await response.json()) as Array<{
    role: "owner" | "editor";
    workspace: { id: string; name: string; owner_id: string } | null;
  }>;
  return rows.flatMap((row) => (row.workspace ? [{ ...row.workspace, role: row.role }] : []));
}

export async function createCloudWorkspace(name: string): Promise<string> {
  const connection = getCloudConnection();
  if (!connection) throw new Error("Connect to Supabase first.");
  const response = await authorizedRequest(
    connection,
    "/rest/v1/rpc/create_intent_guard_workspace",
    { method: "POST", body: JSON.stringify({ workspace_name: name }) },
  );
  if (!response.ok) throw new Error("Could not create workspace. Run the updated SQL migration.");
  const id = await response.json();
  if (typeof id !== "string") throw new Error("Supabase returned an invalid workspace ID.");
  return id;
}

export async function inviteCloudWorkspaceMember(
  workspaceId: string,
  email: string,
): Promise<void> {
  const connection = getCloudConnection();
  if (!connection) throw new Error("Connect to Supabase first.");
  const response = await authorizedRequest(
    connection,
    "/rest/v1/rpc/invite_intent_guard_workspace_member",
    {
      method: "POST",
      body: JSON.stringify({
        target_workspace: workspaceId,
        member_email: email.trim(),
        member_role: "editor",
      }),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(
      typeof body["message"] === "string"
        ? body["message"]
        : "Could not invite this user. They must have a Supabase account and you must be a workspace member.",
    );
  }
}
