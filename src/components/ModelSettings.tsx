import { useState } from "react";
import { testModelProvider } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  providerDefaults,
  type ModelProviderConfig,
  type ModelProvider,
} from "@/lib/prompt/providerTypes";

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
export function ModelSettings({
  config,
  onChange,
  lang,
}: {
  config: ModelProviderConfig;
  onChange: (config: ModelProviderConfig) => void;
  lang: "ar" | "en";
}) {
  const test = useServerFn(testModelProvider);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const ar = lang === "ar";
  const set = (patch: Partial<ModelProviderConfig>) => onChange({ ...config, ...patch });
  const changeProvider = (provider: ModelProvider) =>
    set({ provider, ...providerDefaults[provider], apiKey: "" });
  const check = async () => {
    setBusy(true);
    setStatus("");
    try {
      const result = await test({ data: { providerConfig: config } });
      setStatus(result.ok ? (ar ? "تم الاتصال بنجاح." : "Connection succeeded.") : result.error);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5 rounded-lg border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-primary">
          {ar ? "إعدادات النماذج ومفاتيح API" : "Model & API Settings"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "اختر مزودًا جاهزًا أو أدخل عنوان أي واجهة متوافقة مع OpenAI."
            : "Choose a built-in provider or enter any OpenAI-compatible API endpoint."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>{ar ? "مزود النموذج" : "Provider"}</span>
          <select
            className={field}
            value={config.provider}
            onChange={(e) => changeProvider(e.target.value as ModelProvider)}
          >
            <option value="openai">OpenAI (GPT / o1 / o3)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek (including R1)</option>
            <option value="openai-compatible">Custom OpenAI-compatible endpoint</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{ar ? "معرّف النموذج" : "Model ID"}</span>
          <input
            className={field}
            value={config.model}
            onChange={(e) => set({ model: e.target.value })}
            placeholder="e.g. deepseek-reasoner"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>{ar ? "عنوان API الأساسي" : "API base URL"}</span>
          <input
            className={field}
            value={config.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            dir="ltr"
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>{ar ? "مفتاح API" : "API key"}</span>
          <input
            className={field}
            type="password"
            autoComplete="off"
            value={config.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            placeholder={
              ar
                ? "أدخل المفتاح — لن يُحفظ بعد إعادة التحميل"
                : "Enter key — it is not saved after reload"
            }
            dir="ltr"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={busy || !config.apiKey.trim() || !config.model.trim()}
          onClick={check}
        >
          {busy ? (ar ? "جارٍ الاختبار…" : "Testing…") : ar ? "اختبار الاتصال" : "Test connection"}
        </button>
        {status && (
          <p role="status" className="text-sm">
            {status}
          </p>
        )}
      </div>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <strong>{ar ? "حماية المفتاح" : "Key handling"}:</strong>{" "}
        {ar
          ? "مفتاح API يبقى في ذاكرة الجلسة ويُرسل إلى وظيفة الخادم عند الطلب؛ لا يُخزّن في localStorage أو المستودع. لا تستخدم مفاتيح ذات صلاحيات واسعة على جهاز مشترك."
          : "The API key stays in in-memory UI state and is sent to the server function only for requests; it is not written to localStorage or source control. Avoid broad-scope keys on shared devices."}
      </div>
      {config.provider === "openai-compatible" && (
        <p className="text-sm text-muted-foreground">
          {ar
            ? "يجب أن يدعم الطرف الآخر واجهة /chat/completions المتوافقة مع OpenAI. قد تختلف النماذج التي تستخدم واجهات خاصة."
            : "The endpoint must support the OpenAI-compatible /chat/completions API. Providers with proprietary APIs may require a dedicated adapter."}
        </p>
      )}
    </section>
  );
}
