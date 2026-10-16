import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface RegistrySnapshot {
  assets: unknown[];
  audit: unknown[];
}

let currentUserId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: RegistrySnapshot | null = null;

if (typeof window !== "undefined") {
  void supabase.auth.getSession().then(({ data }) => {
    currentUserId = data.session?.user.id ?? null;
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    currentUserId = session?.user.id ?? null;
  });
  window.addEventListener("intent-guard:registry-changed", (event: Event) => {
    if (!currentUserId) return;
    const detail = (event as CustomEvent<RegistrySnapshot>).detail;
    if (!detail) return;
    pending = detail;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const snap = pending;
      pending = null;
      if (snap) void writeCloudRegistry(snap).catch(() => {});
    }, 800);
  });
}

export async function readCloudRegistry(): Promise<RegistrySnapshot | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("prompt_registries")
    .select("registry")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw new Error("Could not read the cloud library.");
  return (data?.registry as unknown as RegistrySnapshot) ?? null;
}

export async function writeCloudRegistry(snapshot: RegistrySnapshot): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from("prompt_registries").upsert({
    user_id: u.user.id,
    registry: snapshot as unknown as Json,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not save the cloud library.");
}
