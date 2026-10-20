import type { Archetype } from "./types";

export type Bilingual = { ar: string; en: string };
export interface RequestTemplate {
  id: string;
  archetype: Archetype;
  title: Bilingual;
  task: Bilingual;
  terms: string[];
}

export const REQUEST_TEMPLATES: RequestTemplate[] = [
  { id: "excel", archetype: "software", title: { ar: "مراجعة Excel وإصلاحه", en: "Excel audit & repair" }, task: { ar: "أريد كود VBA يراجع جميع أوراق ملف Excel الذي سأرفعه ويقرأ ورقة REV3_AUDIT_LOG ثم يقترح إصلاح المعادلات المكسورة والروابط غير الصالحة بناءً على الأدلة، مع نسخة احتياطية ومعاينة التغييرات قبل تنفيذها.", en: "Create VBA code to audit every worksheet in the Excel workbook I will upload, read REV3_AUDIT_LOG, and propose evidence-backed repairs for broken formulas and invalid links. Include a backup and a change preview before applying repairs." }, terms: ["excel", "vba", "xlsx", "xlsm", "اكسيل", "إكسيل", "أكسيل", "شيت", "معادلات", "workbook"] },
  { id: "strategy", archetype: "business", title: { ar: "خطة إطلاق منتج", en: "Product launch plan" }, task: { ar: "أريد خطة إطلاق منتج SaaS للشركات الناشئة تشمل الجمهور المستهدف والتموضع وخطة التنفيذ ومؤشرات الأداء؛ ميّز المعلومات المؤكدة عن الافتراضات ولا تختلق ميزانية أو أرقامًا.", en: "Create a SaaS product launch plan for startups, covering audience, positioning, execution and KPIs. Separate facts from assumptions; do not invent budgets or numbers." }, terms: ["saas", "launch", "strategy", "إطلاق", "استراتيجية", "منتج", "startup"] },
  { id: "data", archetype: "analytics", title: { ar: "تحليل بيانات المبيعات", en: "Sales data analysis" }, task: { ar: "حلّل بيانات المبيعات التي سأرفقها لاستخراج الاتجاهات والقيم المفقودة والتوصيات، مع توضيح طريقة الحساب وربط كل نتيجة بالبيانات الأصلية.", en: "Analyze my attached sales data for trends, missing values and recommendations. Explain calculations and trace every conclusion to the supplied data." }, terms: ["sales", "analysis", "csv", "مبيعات", "بيانات", "تحليل"] },
  { id: "copy", archetype: "copywriting", title: { ar: "محتوى تسويقي", en: "Marketing content" }, task: { ar: "اكتب ثلاث صيغ تسويقية لمنتجي بناءً على الوصف الذي أقدمه، تناسب جمهوري ونبرة علامتي، دون ادعاءات أو مزايا غير موثقة.", en: "Write three marketing variants for my product based on my supplied description, audience and brand voice. Do not invent benefits or unsupported claims." }, terms: ["marketing", "copy", "محتوى", "تسويقي", "إعلان"] },
  { id: "research", archetype: "research", title: { ar: "مراجعة مستندات", en: "Document review" }, task: { ar: "راجع المستندات التي سأرفعها، واستخرج ملخصًا والاختلافات والثغرات مع ذكر اسم المستند لكل استنتاج، وصرّح بما لا تتضمنه المصادر.", en: "Review my uploaded documents. Summarize findings, differences and gaps, cite the document behind each conclusion, and state what the sources do not establish." }, terms: ["research", "review", "document", "مستند", "وثائق", "بحث", "مراجعة"] },
  { id: "agent", archetype: "agents", title: { ar: "مساعد خدمة العملاء", en: "Customer support agent" }, task: { ar: "صمّم تعليمات مساعد لخدمة العملاء يعتمد على سياسات الشركة المرفقة، يصعّد الحالات غير المحسومة ولا يخترع أسعارًا أو وعودًا أو صلاحيات.", en: "Design instructions for a customer support agent grounded in attached company policies. Escalate unresolved cases and never invent prices, promises or permissions." }, terms: ["agent", "support", "خدمة", "عملاء", "وكيل", "مساعد"] },
  { id: "creative", archetype: "creative", title: { ar: "وصف تصميم بصري", en: "Visual design brief" }, task: { ar: "صغ وصفًا لتصميم بصري لمنتجي يحدد التكوين والألوان والإضاءة والأسلوب وفق تفاصيل المنتج التي أقدمها.", en: "Create a visual design brief for my product with composition, palette, lighting and style based on the product details I supply." }, terms: ["visual", "design", "صورة", "تصميم", "بصري"] },
  { id: "general", archetype: "general", title: { ar: "شرح مبسّط", en: "Clear explanation" }, task: { ar: "اشرح الموضوع الذي أحدده بطريقة تناسب مستوى معرفتي، مع أمثلة واضحة وذكر حدود المعلومات دون تخمين.", en: "Explain my chosen topic at my knowledge level with clear examples. State information limits rather than guessing." }, terms: ["explain", "شرح", "تعليم", "تبسيط"] },
];

export function matchTemplates(input: string): RequestTemplate[] {
  const text = input.toLowerCase().normalize("NFKC");
  return REQUEST_TEMPLATES.map(template => ({ template, score: template.terms.filter(term => text.includes(term)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.template);
}