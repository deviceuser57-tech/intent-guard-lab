import { useMemo, useState, type ChangeEvent } from "react";
import { Bot, Check, ChevronLeft, ChevronRight, FileSpreadsheet, Paperclip, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeIntent } from "@/lib/prompt/intentAnalyzer";
import { defaultSpec } from "@/lib/prompt/compiler";
import { REQUEST_TEMPLATES, matchTemplates, type RequestTemplate } from "@/lib/prompt/templates";
import { synthesizeRequest, type AssistantAnswers, type AssistantDraft } from "@/lib/prompt/requestAssistant";
import { readAssistantFile } from "@/lib/prompt/assistantFiles";
import type { AdvancedControls, Archetype, Specification } from "@/lib/prompt/types";

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  lang: "ar" | "en";
  input: string;
  override: Archetype | "";
  onInput: (input: string) => void;
  onAdopt: (draft: AssistantDraft) => void;
}

export function RequestAssistant({ lang, input, override, onInput, onAdopt }: Props) {
  const ar = lang === "ar";
  const [stage, setStage] = useState<"idle" | "suggest" | "dialogue" | "review" | "adopted">("idle");
  const [source, setSource] = useState("");
  const [answers, setAnswers] = useState<AssistantAnswers>({ deliverable: "", audience: "", constraints: "", details: "", format: "markdown", sources: "mixed" });
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState<AdvancedControls["documents"]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const matches = useMemo(() => matchTemplates(source || input), [source, input]);
  const text = (en: string, arabic: string) => ar ? arabic : en;
  const questionLabels = [text("What should the finished result contain?", "ما الذي تريد استلامه في النهاية؟"), text("Who is the result for, and what must be preserved?", "لمن النتيجة، وما الشروط التي يجب الالتزام بها؟"), text("Which inputs and output style should be used?", "ما المدخلات وشكل النتيجة المطلوب؟")];

  function start(nextSource: string, suggest = true) {
    if (!nextSource.trim()) return;
    const initial = defaultSpec(nextSource, analyzeIntent(nextSource, override || null));
    setSource(nextSource);
    setAnswers({ deliverable: "", audience: "", constraints: "", details: "", format: initial.outputFormat, sources: documents.length ? "documents" : "mixed" });
    setStep(0); setDraft(null); setError("");
    setStage(suggest && matchTemplates(nextSource).length ? "suggest" : "dialogue");
  }

  function chooseTemplate(template: RequestTemplate, preserveIdea = false) {
    const task = preserveIdea ? `${source}\n\n${template.task[lang]}` : template.task[lang];
    onInput(task); start(task, false);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setBusy(true); setError("");
    const loaded: AdvancedControls["documents"] = [];
    const errors: string[] = [];
    for (const file of files) {
      try { loaded.push(await readAssistantFile(file)); }
      catch (e) { errors.push(e instanceof Error ? e.message : text("Could not read file.", "تعذّرت قراءة الملف.")); }
    }
    setDocuments(current => [...current.filter(d => !loaded.some(f => f.name === d.name)), ...loaded]);
    if (loaded.length) setAnswers(current => ({ ...current, sources: "documents" }));
    setError(errors.join("\n")); setBusy(false);
  }

  function review() {
    try { setDraft(synthesizeRequest(source, answers, documents, lang, override || undefined)); setStage("review"); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  function updateSpec<K extends keyof Specification>(key: K, value: Specification[K]) {
    setDraft(current => current ? { ...current, specification: { ...current.specification, [key]: value } } : current);
  }

  const uploadField = (
    <div className="space-y-2">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Paperclip className="h-4 w-4 text-primary" aria-hidden="true" />
        {text("Attach inputs", "إرفاق المدخلات")}
        <input type="file" multiple accept=".docx,.xlsx,.xlsm,.txt,.md,.csv,.json" aria-label={text("Assistant reference files", "ملفات المساعد المرجعية")} disabled={busy} onChange={upload} className="min-w-0 max-w-full text-xs" />
      </label>
      <p className="text-xs text-muted-foreground">
        {text(
          "Files are read locally in this browser. Their extracted content is sent to a model provider only if you later run the prompt live.",
          "تُقرأ الملفات محليًا في هذا المتصفح. ولا يُرسل محتواها المستخرج إلى مزود نموذج إلا إذا شغّلت المطالبة لاحقًا على نموذج حي.",
        )}
      </p>
      {busy && <p role="status" className="text-sm text-muted-foreground">{text("Reading files…", "جارٍ قراءة الملفات…")}</p>}
      <ul className="space-y-1">
        {documents.map(d => <li key={d.name} className="flex items-center gap-2 border-b py-2 text-xs"><FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 break-all">{d.name}</span><Button size="icon" variant="ghost" aria-label={`${text("Remove", "حذف")} ${d.name}`} onClick={() => setDocuments(current => current.filter(f => f.name !== d.name))}><X className="h-4 w-4" /></Button></li>)}
      </ul>
      {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
    </div>
  );

  return (
    <div className="request-assistant mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />{text("Start with an example", "ابدأ بمثال جاهز")}</h3>
        <span className="text-xs font-medium text-success">{text("Free · local guidance · no credits", "مجاني · إرشاد محلي · دون كريدت")}</span>
      </div>
      <div className="assistant-template-strip flex gap-2 overflow-x-auto pb-3" aria-label={text("Request templates", "قوالب الطلبات")}>
        {REQUEST_TEMPLATES.map(template => <Button key={template.id} variant="outline" onClick={() => chooseTemplate(template)} className="h-auto min-h-10 shrink-0 gap-2 whitespace-normal text-start"><FileSpreadsheet className="h-4 w-4 text-primary" />{template.title[lang]}</Button>)}
      </div>
      <div className="assistant-workspace border-y py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold text-primary"><Bot className="h-5 w-5" />{text("Request assistant", "مساعد صياغة الطلب")}</h3>
          {(stage === "idle" || stage === "adopted") && <Button variant="secondary" disabled={!input.trim() || busy} onClick={() => start(input)}><Sparkles className="h-4 w-4" />{text(stage === "adopted" ? "Refine again" : "Refine my request", stage === "adopted" ? "تحسين الطلب مجددًا" : "تحسين طلبي")}</Button>}
          {stage !== "idle" && stage !== "adopted" && <Button size="icon" variant="ghost" aria-label={text("Close assistant", "إغلاق المساعد")} onClick={() => setStage("idle")}><X className="h-4 w-4" /></Button>}
        </div>
        {(stage === "idle" || stage === "adopted") && <div className="mt-3">{uploadField}</div>}
        {stage === "adopted" && <p role="status" className="mt-3 flex gap-2 text-sm text-success"><Check className="h-4 w-4 shrink-0" />{text("Request and settings adopted. Ready to generate.", "تم اعتماد الطلب وإعداداته، وأصبح جاهزًا للتوليد.")}</p>}
        {stage === "suggest" && <div className="mt-4 space-y-3">
          <p className="text-sm">{text("These examples match your idea. Keep your idea and add one, or continue without a template.", "هذه أمثلة قريبة من فكرتك؛ يمكنك إضافة أحدها إلى طلبك أو متابعة الحوار دون قالب.")}</p>
          <div className="flex flex-wrap gap-2">{matches.map(template => <Button key={template.id} variant="outline" onClick={() => chooseTemplate(template, true)}>{template.title[lang]}</Button>)}</div>
          <Button onClick={() => setStage("dialogue")}>{text("Continue with my idea", "متابعة فكرتي دون قالب")}<ChevronLeft className="h-4 w-4 ltr:rotate-180" /></Button>
        </div>}
        {stage === "dialogue" && <div className="mt-4 space-y-4">
          <p className="whitespace-pre-wrap border-s-2 border-primary ps-3 text-sm text-muted-foreground">{source}</p>
          <div role="log" aria-live="polite" className="space-y-3">
            {step > 0 && <p className="text-sm text-muted-foreground">{questionLabels[0]} <span className="font-medium text-foreground">{answers.deliverable || text("Not specified", "لم يُحدد")}</span></p>}
            {step > 1 && <p className="text-sm text-muted-foreground">{questionLabels[1]} <span className="font-medium text-foreground">{[answers.audience, answers.constraints].filter(Boolean).join(" · ") || text("Not specified", "لم يُحدد")}</span></p>}
          </div>
          <div className="flex items-center justify-between gap-2"><h4 className="text-base font-semibold">{questionLabels[step]}</h4><span className="shrink-0 text-xs text-muted-foreground">{step + 1} / 3</span></div>
          {step === 0 && <label className="block space-y-2 text-sm"><span>{text("Deliverable", "النتيجة المطلوبة")}</span><textarea className={field} rows={3} value={answers.deliverable} onChange={e => setAnswers({ ...answers, deliverable: e.target.value })} placeholder={text("e.g. VBA module, repair preview and audit report", "مثال: كود VBA، معاينة الإصلاحات، وتقرير مراجعة")} /></label>}
          {step === 1 && <div className="space-y-3">
            <label className="block space-y-2 text-sm"><span>{text("Audience / experience", "الجمهور / مستوى الخبرة")}</span><input className={field} value={answers.audience} onChange={e => setAnswers({ ...answers, audience: e.target.value })} /></label>
            <label className="block space-y-2 text-sm"><span>{text("Constraints and approvals", "الشروط والموافقات المطلوبة")}</span><textarea rows={3} className={field} value={answers.constraints} onChange={e => setAnswers({ ...answers, constraints: e.target.value })} placeholder={text("e.g. preserve sheets, require approval before repairs", "مثال: الحفاظ على الأوراق، وعدم الإصلاح قبل الموافقة")} /></label>
          </div>}
          {step === 2 && <div className="space-y-3">
            {uploadField}
            <label className="block space-y-2 text-sm"><span>{text("Result format", "شكل النتيجة")}</span><select className={field} value={answers.format} onChange={e => setAnswers({ ...answers, format: e.target.value as AssistantAnswers["format"] })}>{["markdown", "json", "plain", "code", "table"].map(f => <option key={f} value={f}>{ar ? ({ markdown: "نص بعناوين — Markdown", json: "بيانات منظمة — JSON", plain: "نص عادي", code: "كود برمجي", table: "جدول" } as Record<string, string>)[f] : f}</option>)}</select></label>
            <fieldset><legend className="mb-2 text-sm">{text("Source policy", "مصادر الإجابة")}</legend><div className="flex flex-wrap gap-3">{(["documents", "mixed", "general"] as const).map(s => <label key={s} className="flex items-center gap-2 text-sm"><input type="radio" name="assistant-sources" checked={answers.sources === s} onChange={() => setAnswers({ ...answers, sources: s })} className="accent-primary" />{s === "documents" ? text("Files only", "الملفات فقط") : s === "mixed" ? text("Files + general knowledge", "الملفات والمعرفة العامة") : text("General knowledge", "المعرفة العامة")}</label>)}</div></fieldset>
            <label className="block space-y-2 text-sm"><span>{text("Extra details / a real example (optional)", "تفاصيل إضافية / مثال حقيقي (اختياري)")}</span><textarea rows={2} className={field} value={answers.details} onChange={e => setAnswers({ ...answers, details: e.target.value })} /></label>
          </div>}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}><ChevronRight className="h-4 w-4 ltr:rotate-180" />{text("Back", "السابق")}</Button>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={review}>{text("Review now", "مراجعة الطلب الآن")}</Button><Button disabled={busy} onClick={() => step < 2 ? setStep(step + 1) : review()}>{text(step < 2 ? "Next" : "Prepare request", step < 2 ? "التالي" : "تجهيز الطلب")}<Send className="h-4 w-4" /></Button></div>
          </div>
        </div>}
        {stage === "review" && draft && <div className="mt-4 space-y-4">
          <h4 className="font-semibold">{text("Completed request", "الطلب المتكامل")}</h4>
          <textarea rows={5} className={field} aria-label={text("Completed request", "الطلب المتكامل")} value={draft.specification.goal} onChange={e => updateSpec("goal", e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>{text("Specialist role", "دور الخبير")}</span><input className={field} value={draft.specification.persona} onChange={e => updateSpec("persona", e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>{text("Audience", "الجمهور")}</span><input className={field} value={draft.specification.audience} onChange={e => updateSpec("audience", e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span>{text("Maximum words", "الحد الأقصى للكلمات")}</span><input className={field} type="number" min={1} value={draft.specification.maxWords} onChange={e => updateSpec("maxWords", Math.max(1, Number(e.target.value) || 1))} /></label>
            <label className="space-y-1 text-sm"><span>{text("Reasoning summary", "شرح طريقة الحل")}</span><select className={field} value={draft.specification.reasoning} onChange={e => updateSpec("reasoning", e.target.value as Specification["reasoning"])}><option value="none">{text("No summary", "دون شرح")}</option><option value="brief">{text("Brief rationale", "شرح مختصر")}</option><option value="step_by_step">{text("Internal stepwise verification", "تحقق داخلي على خطوات")}</option></select></label>
          </div>
          <label className="block space-y-1 text-sm"><span>{text("Output schema", "بنية المخرجات المطلوبة")}</span><textarea rows={2} className={field} value={draft.specification.outputSchema} onChange={e => updateSpec("outputSchema", e.target.value)} /></label>
          <label className="block space-y-1 text-sm"><span>{text("Examples", "أمثلة")}</span><textarea rows={2} className={field} value={draft.specification.examples} onChange={e => updateSpec("examples", e.target.value)} /></label>
          <label className="block space-y-1 text-sm"><span>{text("Agreed constraints", "الشروط المعتمدة")}</span><textarea rows={4} className={field} value={draft.specification.constraints.join("\n")} onChange={e => updateSpec("constraints", e.target.value.split("\n").filter(Boolean))} /></label>
          <dl className="assistant-summary grid gap-2 border-y py-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{text("Output format", "شكل المخرجات")}</dt><dd>{draft.specification.outputFormat}</dd></div>
            <div><dt className="text-muted-foreground">{text("Document commitment", "الالتزام بالملفات")}</dt><dd>{draft.specification.advanced?.docsWeight}%</dd></div>
            <div><dt className="text-muted-foreground">{text("Input files", "ملفات المدخلات")}</dt><dd className="break-all">{documents.map(d => d.name).join("، ") || text("None attached", "لا توجد ملفات مرفقة")}</dd></div>
            <div><dt className="text-muted-foreground">{text("Pre-answer self-check", "مراجعة الرد قبل إصداره")}</dt><dd>{text("Enabled in generated instructions; not an executed security test", "مفعّلة ضمن التعليمات؛ ليست اختبارًا أمنيًا منفّذًا")}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setStage("dialogue"); setStep(2); }}>{text("Edit answers", "تعديل الإجابات")}</Button><Button disabled={!draft.specification.goal.trim() || busy} onClick={() => { onAdopt(draft); setStage("adopted"); }}><Check className="h-4 w-4" />{text("Adopt request and settings", "اعتماد الطلب والإعدادات")}</Button></div>
        </div>}
      </div>
    </div>
  );
}
