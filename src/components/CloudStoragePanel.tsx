import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { readCloudRegistry, writeCloudRegistry } from "@/lib/cloudRegistry";
import { registry } from "@/lib/prompt/registry";

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const btn = "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";
const btn2 = "rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50";

export function CloudStoragePanel({ lang }: { lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const syncAfterLogin = async () => {
    const remote = await readCloudRegistry();
    const local = registry.read();
    if (remote && (remote.assets.length || remote.audit.length)) {
      const useRemote =
        !local.assets.length ||
        window.confirm(
          ar
            ? "هل تريد استبدال المكتبة المحلية بنسخة السحابة؟ اختر إلغاء لرفع المحلية."
            : "Replace the local library with the cloud copy? Cancel uploads local instead.",
        );
      if (useRemote) registry.replaceState(remote as Parameters<typeof registry.replaceState>[0]);
      else await writeCloudRegistry(local);
    } else await writeCloudRegistry(local);
    setStatus(ar ? "تمت المزامنة مع السحابة." : "Synced with the cloud.");
  };

  const signIn = () =>
    wrap(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(ar ? "فشل تسجيل الدخول. تحقق من البريد وكلمة المرور." : error.message);
      setPassword("");
      await syncAfterLogin();
    });

  const signUp = () =>
    wrap(async () => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw new Error(error.message);
      if (!data.session)
        setStatus(ar ? "تحقق من بريدك لتأكيد الحساب ثم سجّل الدخول." : "Check your email to confirm, then sign in.");
      else await syncAfterLogin();
    });

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-5" dir={ar ? "rtl" : "ltr"}>
        <h3 className="text-lg font-semibold">{ar ? "التخزين المحلي" : "Local storage"}</h3>
        <p className="text-sm text-muted-foreground">{ar ? "المكتبة تعمل محليًا. خدمة المزامنة السحابية غير متاحة في بيئة التشغيل الحالية؛ لن يتعطل التطبيق بسببها." : "Your library remains available locally. Cloud sync is unavailable in this runtime, and the app will continue working without it."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5" dir={ar ? "rtl" : "ltr"}>
      <div>
        <h3 className="text-lg font-semibold">{ar ? "التخزين السحابي المدمج" : "Built-in cloud storage"}</h3>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "سجّل الدخول لحفظ مكتبة البرومبتات وجميع نسخها وسجل التدقيق تلقائيًا في السحابة — بدون أي إعداد أو مفاتيح."
            : "Sign in to save your prompt library, every version and the audit log to the cloud automatically — no setup or keys."}
        </p>
      </div>

      {user ? (
        <div className="space-y-3">
          <p className="text-sm">
            {ar ? "متصل كـ" : "Signed in as"} <b>{user.email}</b> ·{" "}
            <span className="text-primary">{ar ? "المزامنة التلقائية مفعّلة" : "Auto-sync on"}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy} onClick={() => wrap(async () => { await writeCloudRegistry(registry.read()); setStatus(ar ? "تم الرفع." : "Uploaded."); })}>
              {ar ? "رفع الآن" : "Upload now"}
            </button>
            <button className={btn2} disabled={busy} onClick={() => wrap(async () => { const r = await readCloudRegistry(); if (r) registry.replaceState(r as Parameters<typeof registry.replaceState>[0]); setStatus(ar ? "تم التحميل من السحابة." : "Loaded from cloud."); })}>
              {ar ? "تحميل من السحابة" : "Load from cloud"}
            </button>
            <button className={btn2} disabled={busy} onClick={() => wrap(async () => { await supabase.auth.signOut(); })}>
              {ar ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:max-w-sm">
          <input className={field} type="email" placeholder={ar ? "البريد الإلكتروني" : "Email"} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" placeholder={ar ? "كلمة المرور" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className={btn} disabled={busy || !email || password.length < 6} onClick={signIn}>
              {ar ? "تسجيل الدخول" : "Sign in"}
            </button>
            <button className={btn2} disabled={busy || !email || password.length < 6} onClick={signUp}>
              {ar ? "إنشاء حساب" : "Create account"}
            </button>
          </div>
        </div>
      )}
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
