import { BookOpen, CheckCircle2, CircleHelp, ClipboardCheck, ShieldCheck, Sparkles } from "lucide-react";
import type { Lang } from "@/lib/i18n";

type Props = { lang: Lang };

const guideSections = {
  en: {
    eyebrow: "HELP CENTER",
    title: "Help & User Guide",
    intro: "A practical walkthrough for turning a task description into a reviewed, reusable prompt.",
    noteTitle: "Before you start",
    note: "The walkthrough below describes the current application controls. It is not a substitute for running the prompt against your target model and testing real edge cases.",
    steps: [
      { n: "01", title: "Describe the task", body: "Enter the outcome you want in the main description box. Choose an Archetype if you want to guide classification, or leave Auto-detect selected. Select Generate prompt." },
      { n: "02", title: "Review Intent Analysis", body: "Check the inferred task type, risk level, complexity, confidence and matched signals. Correct the original request if the classification does not fit." },
      { n: "03", title: "Edit Specification", body: "Review Goal, Audience, Tone, Constraints and Output format. Add an Output schema or examples when the result needs a strict structure." },
      { n: "04", title: "Inspect the compiled prompt", body: "Open Compiled Prompts and read both System instructions and User message. Copy or export only after checking that the instructions match your intended use." },
      { n: "05", title: "Use Playground and governance checks", body: "Playground includes Decision Engine, Prompt Linter and Readiness results for the current specification. Read the reason behind each decision and address high-severity findings." },
      { n: "06", title: "Validate and save", body: "Review Security / Validation and Guardrails. Use Prompt Registry to save a named asset and track versions. Local browser storage is not an enterprise backup." },
    ],
    visualsTitle: "Screen-by-screen map",
    visualsIntro: "Captured screenshots from the running application. Select each image to inspect the relevant screen."
    visualCards: [
      { label: "START HERE", title: "Task input", desc: "Description → Archetype → Generate prompt", src: "/guide-screenshots/01-task-input.png" },
      { label: "UNDERSTAND", title: "Intent Analysis", desc: "Task type · Risk · Confidence · Signals", src: "/guide-screenshots/02-intent-analysis.png" },
      { label: "SHAPE", title: "Specification", desc: "Goal · Audience · Tone · Constraints · Output format", src: "/guide-screenshots/03-specification.png" },
      { label: "REVIEW", title: "Playground", desc: "Decision Engine · Prompt Linter · Readiness", src: "/guide-screenshots/04-playground.png" },
    ],
    checklistTitle: "Before using a prompt",
    checklist: [
      "Confirm Goal and Constraints are specific and testable.",
      "Check Output format and Output schema against the consumer of the result.",
      "Resolve critical and high-severity Prompt Linter findings.",
      "Treat not_tested readiness dimensions as unverified.",
      "Test realistic inputs, boundary cases and adversarial inputs.",
      "Do not enter secrets or sensitive data unless your environment and policies permit it.",
    ],
    enginesTitle: "What the governance results mean",
    engines: [
      { title: "Decision Engine", body: "Explains which prompt components are required, recommended or optional, and why." },
      { title: "Prompt Linter", body: "Reports structural, semantic, security and operational findings with severity and possible remediation." },
      { title: "Readiness", body: "Summarizes available readiness evidence and the release gate. READY does not mean production-tested or certified safe." },
    ],
    tipTitle: "Language and terminology",
    tip: "Use the language switch for explanatory copy. The tab and field names remain in English in both languages so the guide matches the interface.",
  },
  ar: {
    eyebrow: "مركز المساعدة",
    title: "Help & User Guide",
    intro: "دليل عملي لتحويل وصف المهمة إلى Prompt قابل للمراجعة وإعادة الاستخدام.",
    noteTitle: "قبل أن تبدأ",
    note: "يوضح الدليل عناصر التحكم الموجودة في التطبيق. ولا يغني عن تشغيل الموجّه على النموذج المستهدف واختبار الحالات الواقعية والحدّية.",
    steps: [
      { n: "01", title: "اكتب وصف المهمة", body: "اكتب النتيجة المطلوبة في حقل الوصف الرئيسي. اختر Archetype لتوجيه التصنيف يدويًا، أو اترك Auto-detect. اضغط Generate prompt." },
      { n: "02", title: "راجع Intent Analysis", body: "تحقق من نوع المهمة ومستوى المخاطر والتعقيد والثقة ومؤشرات النية. إذا لم يناسبك التصنيف، حسّن وصف المهمة ثم أعد التوليد." },
      { n: "03", title: "راجع Specification", body: "راجع Goal وAudience وTone وConstraints وOutput format. أضف Output schema أو أمثلة عندما تحتاج إلى مخرجات ذات بنية محددة." },
      { n: "04", title: "افحص Compiled Prompts", body: "اقرأ System instructions وUser message. لا تنسخ الموجّه أو تصدّره قبل التأكد من توافق التعليمات مع الاستخدام المقصود." },
      { n: "05", title: "استخدم Playground وفحوص الحوكمة", body: "يعرض Playground نتائج Decision Engine وPrompt Linter وReadiness للمواصفات الحالية. اقرأ سبب كل قرار وعالج الملاحظات عالية الخطورة." },
      { n: "06", title: "تحقق واحفظ", body: "راجع Security / Validation وGuardrails. استخدم Prompt Registry لحفظ الأصل باسمه ومتابعة إصداراته. التخزين المحلي في المتصفح ليس نسخة احتياطية مؤسسية." },
    ],
    visualsTitle: "خريطة التنقل بين الشاشات",
    visualsIntro: "لقطات شاشة فعلية من التطبيق أثناء تشغيله. افتح كل صورة لمعاينة الشاشة المرتبطة بالخطوة."
    visualCards: [
      { label: "ابدأ هنا", title: "Task input", desc: "Description → Archetype → Generate prompt", src: "/guide-screenshots/01-task-input.png" },
      { label: "افهم الطلب", title: "Intent Analysis", desc: "Task type · Risk · Confidence · Signals", src: "/guide-screenshots/02-intent-analysis.png" },
      { label: "اضبط المواصفات", title: "Specification", desc: "Goal · Audience · Tone · Constraints · Output format", src: "/guide-screenshots/03-specification.png" },
      { label: "راجع النتائج", title: "Playground", desc: "Decision Engine · Prompt Linter · Readiness", src: "/guide-screenshots/04-playground.png" },
    ],
    checklistTitle: "قائمة المراجعة قبل الاستخدام",
    checklist: [
      "تأكد أن Goal وConstraints محددان ويمكن اختبارهُما.",
      "طابق Output format وOutput schema مع الجهة التي ستستهلك النتيجة.",
      "عالج ملاحظات Prompt Linter الحرجة والعالية.",
      "اعتبر أبعاد Readiness بحالة not_tested غير متحققة.",
      "اختبر مدخلات واقعية وحالات حدّية ومدخلات عدائية.",
      "لا تدخل أسرارًا أو بيانات حساسة إلا إذا كانت بيئة الاستخدام والسياسات تسمح بذلك.",
    ],
    enginesTitle: "كيف تقرأ نتائج الحوكمة؟",
    engines: [
      { title: "Decision Engine", body: "يوضح مكونات الموجّه المطلوبة أو الموصى بها أو الاختيارية، مع سبب القرار." },
      { title: "Prompt Linter", body: "يعرض ملاحظات البنية والمعنى والأمان والتشغيل، مع مستوى الخطورة والمعالجة المقترحة عند توفرها." },
      { title: "Readiness", body: "يلخص أدلة الجاهزية المتاحة وحالة بوابة الإصدار. ظهور READY لا يعني اجتياز اختبارات الإنتاج أو الحصول على شهادة أمان." },
    ],
    tipTitle: "اللغة والمصطلحات",
    tip: "يغيّر زر اللغة النصوص التوضيحية، بينما تبقى أسماء التبويبات والحقول باللغة الإنجليزية في الوضعين حتى يطابق الدليل واجهة التطبيق.",
  },
} as const;

export function HelpUserGuide({ lang }: Props) {
  const content = guideSections[lang];

  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 sm:p-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-primary">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {content.eyebrow}
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{content.intro}</p>
        </div>
        <div className="grid gap-3 border-t p-5 sm:grid-cols-3">
          {content.engines.map((engine) => (
            <div key={engine.title} className="rounded-lg border bg-background p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                {engine.title}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{engine.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <CircleHelp className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-semibold">{content.noteTitle}</h3>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{content.note}</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold">{lang === "ar" ? "خطوات الاستخدام" : "How to use the workbench"}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {content.steps.map((step) => (
            <article key={step.n} className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-10 items-center justify-center rounded-md bg-primary/10 font-mono text-sm font-bold text-primary">{step.n}</span>
                <h4 className="font-semibold">{step.title}</h4>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-xl font-bold">{content.visualsTitle}</h3>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{content.visualsIntro}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {content.visualCards.map((card, index) => (
            <article key={card.title} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-2">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground">{card.label}</span>
                <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              </div>
              <a href={card.src} target="_blank" rel="noreferrer" className="block bg-muted/40">
                <img src={card.src} alt={card.title} loading="lazy" className="aspect-video w-full object-cover object-top" />
              </a>
              <div className="space-y-2 p-4">
                <h4 className="font-semibold">{card.title}</h4>
                <p className="text-xs leading-5 text-muted-foreground">{card.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-semibold">{content.checklistTitle}</h3>
        </div>
        <ul className="space-y-3">
          {content.checklist.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm leading-6">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="font-semibold">{content.tipTitle}</h3>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{content.tip}</p>
      </section>
    </div>
  );
}
