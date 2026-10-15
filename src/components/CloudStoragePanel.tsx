import { useEffect, useState } from "react";
import {
  createCloudWorkspace,
  disconnectCloud,
  getCloudConnection,
  inviteCloudWorkspaceMember,
  listCloudWorkspaces,
  readCloudRegistry,
  setActiveCloudWorkspace,
  signInCloud,
  writeCloudRegistry,
  type CloudWorkspace,
} from "@/lib/cloudRegistry";
import { registry } from "@/lib/prompt/registry";

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function CloudStoragePanel({ lang }: { lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connection, setConnection] = useState(() => getCloudConnection());
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState(
    () => getCloudConnection()?.activeWorkspaceId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!connection) {
      setWorkspaces([]);
      return;
    }
    let active = true;
    void listCloudWorkspaces()
      .then((items) => {
        if (!active) return;
        setWorkspaces(items);
        setSelectedWorkspace(connection.activeWorkspaceId ?? "");
      })
      .catch((error: unknown) => {
        if (active)
          setStatus(error instanceof Error ? error.message : "Could not load workspaces.");
      });
    return () => {
      active = false;
    };
  }, [connection]);

  const connect = async () => {
    setBusy(true);
    setStatus("");
    try {
      const session = await signInCloud(url, anonKey, email, password);
      setConnection(session);
      setSelectedWorkspace("");
      setPassword("");
      const remote = await readCloudRegistry();
      if (remote && (remote.assets.length || remote.audit.length)) {
        const useRemote = window.confirm(
          ar
            ? "هل تريد استبدال السجل المحلي بنسخة السحابة؟ اختر إلغاء للاحتفاظ بالمحلي ورفعه إلى السحابة."
            : "Replace the local registry with the cloud copy? Choose Cancel to keep local data and upload it to the cloud.",
        );
        if (useRemote) registry.replaceState(remote as Parameters<typeof registry.replaceState>[0]);
        else await writeCloudRegistry(registry.read());
      } else {
        await writeCloudRegistry(registry.read());
      }
      setStatus(
        ar ? "تم الاتصال ومزامنة السجل الشخصي." : "Connected and personal registry synced.",
      );
      setWorkspaces(await listCloudWorkspaces());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cloud connection failed.");
    } finally {
      setBusy(false);
    }
  };

  const activateWorkspace = async (workspaceId: string) => {
    setBusy(true);
    setStatus("");
    try {
      const session = setActiveCloudWorkspace(workspaceId || undefined);
      setConnection(session);
      setSelectedWorkspace(workspaceId);
      const remote = await readCloudRegistry();
      if (remote && (remote.assets.length || remote.audit.length)) {
        const useRemote = window.confirm(
          ar
            ? "هل تريد تحميل سجل مساحة العمل واستبدال السجل المحلي؟ اختر إلغاء لرفع السجل المحلي إلى مساحة العمل."
            : "Load the selected workspace snapshot and replace local registry data? Choose Cancel to upload the local registry to this workspace.",
        );
        if (useRemote) registry.replaceState(remote as Parameters<typeof registry.replaceState>[0]);
        else await writeCloudRegistry(registry.read());
      } else {
        await writeCloudRegistry(registry.read());
      }
      setStatus(
        workspaceId
          ? ar
            ? "تم تفعيل مساحة العمل ومزامنة السجل."
            : "Workspace activated and registry synced."
          : ar
            ? "تم تفعيل السجل الشخصي."
            : "Personal registry activated.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workspace sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = async () => {
    setBusy(true);
    setStatus("");
    try {
      const id = await createCloudWorkspace(workspaceName);
      const items = await listCloudWorkspaces();
      setWorkspaces(items);
      setWorkspaceName("");
      await activateWorkspace(id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create workspace.");
    } finally {
      setBusy(false);
    }
  };

  const inviteMember = async () => {
    if (!selectedWorkspace) return;
    setBusy(true);
    setStatus("");
    try {
      await inviteCloudWorkspaceMember(selectedWorkspace, inviteEmail);
      setInviteEmail("");
      setStatus(
        ar
          ? "تمت إضافة المستخدم. يجب أن يكون لديه حساب Supabase بالفعل."
          : "Member invited. The person must already have a Supabase account.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not invite member.");
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setStatus("");
    try {
      await writeCloudRegistry(registry.read());
      setStatus(
        selectedWorkspace
          ? ar
            ? "تم رفع السجل المشترك إلى مساحة العمل."
            : "Shared registry uploaded to workspace."
          : ar
            ? "تم رفع السجل الشخصي إلى السحابة."
            : "Personal registry uploaded to cloud.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Cloud sync failed.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    disconnectCloud();
    setConnection(null);
    setWorkspaces([]);
    setSelectedWorkspace("");
    setStatus(ar ? "تم قطع الاتصال." : "Disconnected.");
  };

  return (
    <section className="space-y-5 rounded-lg border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">
          {ar ? "التخزين السحابي ومساحات الفريق" : "Cloud Storage & Team Workspaces"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "احفظ سجل الموجّهات والإصدارات وسجل التدقيق في السحابة، أو شاركه داخل مساحة عمل."
            : "Persist prompts, versions and audit history in the cloud, or share a registry snapshot with a workspace."}
        </p>
      </div>
      {connection ? (
        <div className="space-y-4">
          <p className="text-sm">
            {ar ? "متصل" : "Connected"}: <strong>{connection.email ?? connection.userId}</strong>
          </p>
          <label className="block space-y-1 text-sm">
            <span>{ar ? "السجل السحابي النشط" : "Active cloud registry"}</span>
            <select
              className={field}
              value={selectedWorkspace}
              disabled={busy}
              onChange={(event) => void activateWorkspace(event.target.value)}
            >
              <option value="">{ar ? "السجل الشخصي" : "Personal registry"}</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} · {workspace.role}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={busy}
              onClick={syncNow}
            >
              {ar ? "مزامنة الآن" : "Sync now"}
            </button>
            <button
              className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => void activateWorkspace(selectedWorkspace)}
            >
              {ar ? "تحميل نسخة السحابة" : "Load cloud snapshot"}
            </button>
            <button
              className="rounded-md border px-4 py-2 text-sm"
              disabled={busy}
              onClick={disconnect}
            >
              {ar ? "قطع الاتصال" : "Disconnect"}
            </button>
          </div>
          <div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>{ar ? "اسم مساحة العمل" : "New workspace name"}</span>
              <input
                className={field}
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                maxLength={120}
              />
            </label>
            <div className="flex items-end">
              <button
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                disabled={busy || !workspaceName.trim()}
                onClick={createWorkspace}
              >
                {ar ? "إنشاء مساحة عمل" : "Create workspace"}
              </button>
            </div>
            <label className="space-y-1 text-sm">
              <span>{ar ? "بريد عضو الفريق" : "Team member email"}</span>
              <input
                className={field}
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="colleague@example.com"
                dir="ltr"
              />
            </label>
            <div className="flex items-end">
              <button
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                disabled={busy || !selectedWorkspace || !inviteEmail.trim()}
                onClick={inviteMember}
              >
                {ar ? "إضافة محرر" : "Invite editor"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              {ar
                ? "يمكن دعوة مستخدم لديه حساب Supabase بالفعل. أعضاء مساحة العمل يشاركون سجلًا واحدًا؛ آخر مزامنة ناجحة هي النسخة المشتركة."
                : "Invitees must already have a Supabase Auth account. Workspace members share one registry snapshot; the latest successful sync becomes the shared copy."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Supabase project URL</span>
            <input
              className={field}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://your-project.supabase.co"
              dir="ltr"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>Supabase anon / publishable key</span>
            <input
              className={field}
              type="password"
              autoComplete="off"
              value={anonKey}
              onChange={(event) => setAnonKey(event.target.value)}
              dir="ltr"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{ar ? "البريد الإلكتروني" : "Account email"}</span>
            <input
              className={field}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              dir="ltr"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{ar ? "كلمة مرور حساب Supabase" : "Supabase account password"}</span>
            <input
              className={field}
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={busy || !url || !anonKey || !email || !password}
              onClick={connect}
            >
              {busy
                ? ar
                  ? "جارٍ الاتصال…"
                  : "Connecting…"
                : ar
                  ? "اتصال ومزامنة"
                  : "Connect & sync"}
            </button>
          </div>
        </div>
      )}
      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <p>
          <strong>{ar ? "الإعداد المطلوب" : "Required setup"}:</strong>{" "}
          {ar
            ? "أنشئ مشروع Supabase، فعّل Email/Password Auth، ثم نفّذ ملف docs/supabase-cloud-storage.sql في SQL Editor قبل الاتصال."
            : "Create a Supabase project, enable Email/Password Auth, then run docs/supabase-cloud-storage.sql in its SQL Editor before connecting."}
        </p>
        <p className="mt-2">
          {ar
            ? "تضمن سياسات RLS وصول كل مستخدم إلى السجلات التي يملكها أو يشارك فيها. المزامنة مشتركة على مستوى مساحة العمل وليست تحريرًا لحظيًا؛ قد تتعارض التعديلات المتزامنة."
            : "RLS restricts users to personal data and workspaces they belong to. Workspace sync shares snapshots, not real-time collaborative editing; simultaneous edits may conflict."}
        </p>
      </div>
    </section>
  );
}
