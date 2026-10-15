import { useState } from "react";
import { disconnectCloud, getCloudConnection, readCloudRegistry, signInCloud, writeCloudRegistry } from "@/lib/cloudRegistry";
import { registry } from "@/lib/prompt/registry";

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
export function CloudStoragePanel({ lang }: { lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connection, setConnection] = useState(() => getCloudConnection());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const connect = async () => {
    setBusy(true); setStatus("");
    try {
      const session = await signInCloud(url, anonKey, email, password);
      setConnection(session); setPassword("");
      const remote = await readCloudRegistry();
      if (remote && (remote.assets.length || remote.audit.length)) {
        const useRemote = window.confirm(ar
          ? "هل تريد استبدال السجل المحلي بنسخة السحابة؟ اختر إلغاء للاحتفاظ بالمحلي ورفعه إلى السحابة."
          : "Replace the local registry with the cloud copy? Choose Cancel to keep local data and upload it to the cloud.");
        if (useRemote) registry.replaceState(remote as Parameters<typeof registry.replaceState>[0]);
        else await writeCloudRegistry(registry.read());
      } else {
        await writeCloudRegistry(registry.read());
      }
      setStatus(ar ? "تم الاتصال ومزامنة السجل." : "Connected and registry synced.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cloud connection failed.");
    } finally { setBusy(false); }
  };
  const syncNow = async () => {
    setBusy(true); setStatus("");
    try {
      await writeCloudRegistry(registry.read());
      setStatus(ar ? "تم رفع السجل إلى السحابة." : "Registry uploaded to cloud.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Cloud sync failed."); }
    finally { setBusy(false); }
  };
  const disconnect = () => { disconnectCloud(); setConnection(null); setStatus(ar ? "تم قطع الاتصال." : "Disconnected."); };
  return <section className="space-y-5 rounded-lg border bg-card p-6">
    <div>
      <h3 className="text-lg font-semibold text-primary">{ar ? "التخزين السحابي" : "Cloud Storage"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{ar ? "مزامنة سجل الموجّهات المنشورة والإصدارات وسجل التدقيق إلى مشروع Supabase خاص بالمستخدم." : "Sync published prompts, versions and audit history to your own Supabase project."}</p>
    </div>
    {connection ? <div className="space-y-3">
      <p className="text-sm">{ar ? "متصل" : "Connected"}: <strong>{connection.email ?? connection.userId}</strong></p>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy} onClick={syncNow}>{ar ? "مزامنة الآن" : "Sync now"}</button>
        <button className="rounded-md border px-4 py-2 text-sm" disabled={busy} onClick={disconnect}>{ar ? "قطع الاتصال" : "Disconnect"}</button>
      </div>
    </div> : <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm md:col-span-2"><span>Supabase project URL</span><input className={field} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" dir="ltr" /></label>
      <label className="space-y-1 text-sm md:col-span-2"><span>Supabase anon / publishable key</span><input className={field} type="password" autoComplete="off" value={anonKey} onChange={e => setAnonKey(e.target.value)} dir="ltr" /></label>
      <label className="space-y-1 text-sm"><span>{ar ? "البريد الإلكتروني" : "Account email"}</span><input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" /></label>
      <label className="space-y-1 text-sm"><span>{ar ? "كلمة مرور حساب Supabase" : "Supabase account password"}</span><input className={field} type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <div className="md:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy || !url || !anonKey || !email || !password} onClick={connect}>{busy ? (ar ? "جارٍ الاتصال…" : "Connecting…") : (ar ? "اتصال ومزامنة" : "Connect & sync")}</button></div>
    </div>}
    {status && <p role="status" className="text-sm">{status}</p>}
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      <p><strong>{ar ? "الإعداد المطلوب" : "Required setup"}:</strong> {ar ? "أنشئ مشروع Supabase، فعّل Email/Password Auth، ثم نفّذ ملف docs/supabase-cloud-storage.sql في SQL Editor قبل الاتصال." : "Create a Supabase project, enable Email/Password Auth, then run docs/supabase-cloud-storage.sql in its SQL Editor before connecting."}</p>
      <p className="mt-2">{ar ? "سياسة RLS تحصر كل سجل في المستخدم المصادق عليه. هذه النسخة توفر مزامنة صريحة؛ لا تدّعي مزامنة فورية متعددة المستخدمين." : "RLS scopes each snapshot to the authenticated user. This version provides explicit snapshot sync; it does not claim real-time multi-user collaboration."}</p>
    </div>
  </section>;
}
