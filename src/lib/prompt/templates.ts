import type { Archetype, Specification } from "./types";

export type Bilingual = { ar: string; en: string };
export type TemplateCategory = "commercial" | "legal" | "analytics" | "technical" | "content";

export interface TemplateDefaults {
  deliverable: Bilingual;
  audience: Bilingual;
  constraints: Bilingual;
  format: Specification["outputFormat"];
  sources: "documents" | "mixed" | "general";
}

export interface RequestTemplate {
  id: string;
  category: TemplateCategory;
  archetype: Archetype;
  title: Bilingual;
  summary: Bilingual;
  task: Bilingual;
  defaults: TemplateDefaults;
  terms: string[];
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: Bilingual }[] = [
  { id: "commercial", label: { ar: "تجاري", en: "Commercial" } },
  { id: "legal", label: { ar: "قانوني", en: "Legal" } },
  { id: "analytics", label: { ar: "تحليلي", en: "Analytics" } },
  { id: "technical", label: { ar: "تقني", en: "Technical" } },
  { id: "content", label: { ar: "محتوى وبحث", en: "Content & research" } },
];

const t = (ar: string, en: string): Bilingual => ({ ar, en });

export const REQUEST_TEMPLATES: RequestTemplate[] = [
  // Commercial
  { id: "b2b-proposal", category: "commercial", archetype: "business", title: t("عرض تجاري B2B", "B2B sales proposal"),
    summary: t("عرض سعر وقيمة مقترحة لعميل مؤسسي.", "Pricing and value proposal for an enterprise client."),
    task: t("أعدّ عرضًا تجاريًا لعميل مؤسسي بناءً على وصف الخدمة والأسعار التي سأقدمها، يشمل المشكلة والحل والقيمة المتوقعة والتسعير وشروط الدفع والخطوات التالية؛ لا تختلق أرقامًا أو عملاء مرجعيين.", "Prepare a B2B proposal for an enterprise client from the service description and prices I provide: problem, solution, expected value, pricing, payment terms and next steps. Do not invent numbers or reference customers."),
    defaults: { deliverable: t("عرض تجاري منظم مع جدول تسعير وملخص تنفيذي", "Structured proposal with pricing table and executive summary"), audience: t("صناع القرار والمشتريات لدى العميل", "Client decision makers and procurement"), constraints: t("استخدم الأسعار المقدمة فقط\nميّز الافتراضات بوضوح", "Use only supplied prices\nLabel assumptions clearly"), format: "markdown", sources: "mixed" },
    terms: ["عرض", "سعر", "proposal", "b2b", "quote", "عميل", "تسعير", "pricing"] },
  { id: "unit-economics", category: "commercial", archetype: "business", title: t("اقتصاديات الوحدة والتسعير", "Unit economics & pricing"),
    summary: t("حساب CAC وLTV وهامش الربح وخيارات التسعير.", "CAC, LTV, margin and pricing options."),
    task: t("احسب اقتصاديات الوحدة لمنتجي (تكلفة الاستحواذ، القيمة الدائمة للعميل، الهامش، فترة الاسترداد) من الأرقام التي سأقدمها، واقترح ثلاث استراتيجيات تسعير مع أثر كل منها؛ أظهر المعادلات ولا تفترض أرقامًا ناقصة.", "Calculate my product's unit economics (CAC, LTV, margin, payback) from the figures I provide and propose three pricing strategies with their impact. Show formulas and do not assume missing figures."),
    defaults: { deliverable: t("جدول مؤشرات مع المعادلات ومقارنة ثلاث استراتيجيات تسعير", "Metrics table with formulas and three pricing scenarios"), audience: t("المؤسسون والإدارة المالية", "Founders and finance"), constraints: t("أظهر كل معادلة\nاطلب أي رقم ناقص بدل تقديره", "Show each formula\nAsk for missing figures instead of estimating"), format: "table", sources: "mixed" },
    terms: ["cac", "ltv", "هامش", "تسعير", "pricing", "economics", "اقتصاديات", "ربحية"] },
  { id: "gtm", category: "commercial", archetype: "business", title: t("خطة دخول السوق والمنافسة", "Go-to-market & competition"),
    summary: t("تموضع، مصفوفة منافسين، قنوات ومؤشرات.", "Positioning, competitor matrix, channels and KPIs."),
    task: t("أريد خطة دخول السوق لمنتجي تشمل الجمهور المستهدف والتموضع ومصفوفة مقارنة بالمنافسين الذين سأذكرهم وقنوات التسويق ومؤشرات الأداء؛ ميّز الحقائق المؤكدة عن الافتراضات ولا تختلق ميزانيات.", "Create a go-to-market plan for my product: target audience, positioning, a competitor matrix for the competitors I name, channels and KPIs. Separate facts from assumptions; do not invent budgets."),
    defaults: { deliverable: t("خطة مرحلية ومصفوفة منافسين ومؤشرات أداء", "Phased plan, competitor matrix and KPIs"), audience: t("فريق الإدارة والتسويق", "Leadership and marketing"), constraints: t("لا تختلق حصصًا سوقية أو ميزانيات", "Do not invent market share or budgets"), format: "markdown", sources: "mixed" },
    terms: ["saas", "launch", "strategy", "إطلاق", "استراتيجية", "منتج", "منافس", "سوق", "market", "gtm"] },
  { id: "support-agent", category: "commercial", archetype: "agents", title: t("مساعد خدمة العملاء", "Customer support agent"),
    summary: t("وكيل يعتمد سياسات الشركة ويصعّد الحالات.", "Policy-grounded agent with escalation."),
    task: t("صمّم تعليمات مساعد لخدمة العملاء يعتمد على سياسات الشركة المرفقة، يصعّد الحالات غير المحسومة ولا يخترع أسعارًا أو وعودًا أو صلاحيات.", "Design instructions for a customer support agent grounded in attached company policies. Escalate unresolved cases and never invent prices, promises or permissions."),
    defaults: { deliverable: t("تعليمات نظام للوكيل وقواعد تصعيد", "Agent system instructions and escalation rules"), audience: t("عملاء الشركة", "Company customers"), constraints: t("التزم بالسياسات المرفقة فقط\nصعّد عند عدم اليقين", "Follow attached policies only\nEscalate when uncertain"), format: "markdown", sources: "documents" },
    terms: ["agent", "support", "خدمة", "عملاء", "وكيل", "دعم"] },
  // Legal
  { id: "nda-review", category: "legal", archetype: "research", title: t("مراجعة اتفاقية عدم إفشاء", "NDA review"),
    summary: t("بنود السرية والمدة والاستثناءات والمخاطر.", "Confidentiality, term, exclusions and risks."),
    task: t("راجع اتفاقية عدم الإفشاء التي سأرفعها واستخرج تعريف المعلومات السرية والمدة والاستثناءات والالتزامات والجزاءات، وصنّف كل بند حسب المخاطر مع اقتباس النص الأصلي؛ هذا تحليل مساعد وليس استشارة قانونية.", "Review the NDA I upload. Extract the confidentiality definition, term, exclusions, obligations and remedies, rate each clause by risk and quote the original text. This is assistive analysis, not legal advice."),
    defaults: { deliverable: t("جدول بنود: البند | الاقتباس | المخاطر | التوصية", "Clause table: clause | quote | risk | recommendation"), audience: t("المستشار القانوني ومدير العقود", "Legal counsel and contract manager"), constraints: t("اقتبس النص لكل استنتاج\nلا تقدّم حكمًا قانونيًا نهائيًا", "Quote text for every conclusion\nNo definitive legal judgement"), format: "table", sources: "documents" },
    terms: ["nda", "سرية", "إفشاء", "confidential", "اتفاقية"] },
  { id: "contract-risk", category: "legal", archetype: "research", title: t("تحليل مخاطر العقد وSLA", "Contract & SLA risk review"),
    summary: t("المسؤولية والإنهاء ومستوى الخدمة والغرامات.", "Liability, termination, SLA and penalties."),
    task: t("حلّل العقد المرفق لاستخراج حدود المسؤولية وشروط الإنهاء والتجديد ومستويات الخدمة والغرامات والالتزامات غير المتوازنة، مع ذكر رقم البند لكل ملاحظة وتحديد البنود المفقودة مقارنة بالممارسات المعتادة.", "Analyze the attached contract for liability caps, termination and renewal, service levels, penalties and unbalanced obligations. Cite the clause number for every note and flag clauses missing versus common practice."),
    defaults: { deliverable: t("تقرير مخاطر مرتب حسب الأولوية مع أرقام البنود", "Prioritized risk report with clause references"), audience: t("الإدارة القانونية والتنفيذية", "Legal and executive leadership"), constraints: t("اذكر رقم البند لكل ملاحظة\nافصل الملاحظات عن التوصيات", "Cite clause numbers\nSeparate findings from recommendations"), format: "markdown", sources: "documents" },
    terms: ["عقد", "contract", "sla", "مسؤولية", "liability", "إنهاء", "بند", "قانوني", "legal"] },
  { id: "privacy-compliance", category: "legal", archetype: "research", title: t("تدقيق الخصوصية والامتثال", "Privacy & compliance audit"),
    summary: t("فجوات سياسة البيانات مقابل الإطار المختار.", "Data-policy gaps against a chosen framework."),
    task: t("قارن سياسة الخصوصية ومعالجة البيانات المرفقة بمتطلبات الإطار التنظيمي الذي سأحدده (مثل GDPR أو نظام حماية البيانات المحلي)، وحدّد الفجوات والأدلة والإجراءات التصحيحية؛ صرّح بما لا يمكن تأكيده من المستندات.", "Compare the attached privacy and data-processing policy with the regulatory framework I specify (e.g. GDPR or a local data-protection law). Identify gaps, evidence and corrective actions; state what the documents cannot confirm."),
    defaults: { deliverable: t("مصفوفة امتثال: المتطلب | الحالة | الدليل | الإجراء", "Compliance matrix: requirement | status | evidence | action"), audience: t("مسؤول حماية البيانات", "Data protection officer"), constraints: t("لا تفترض ممارسات غير موثقة", "Do not assume undocumented practices"), format: "table", sources: "documents" },
    terms: ["gdpr", "خصوصية", "privacy", "امتثال", "compliance", "بيانات شخصية"] },
  // Analytics
  { id: "financial-analysis", category: "analytics", archetype: "analytics", title: t("تحليل القوائم المالية", "Financial statement analysis"),
    summary: t("نسب الربحية والسيولة وتحليل الفروقات.", "Profitability, liquidity and variance analysis."),
    task: t("حلّل القوائم المالية التي سأرفقها: نسب الربحية والسيولة والمديونية، وفروقات الفعلي مقابل الموازنة، مع إظهار المعادلات وربط كل رقم بمصدره وتحديد البيانات الناقصة.", "Analyze the financial statements I attach: profitability, liquidity and leverage ratios and actual-versus-budget variances. Show formulas, trace each number to its source and list missing data."),
    defaults: { deliverable: t("جدول نسب ومعادلات وملخص تنفيذي للفروقات", "Ratio table with formulas and variance summary"), audience: t("المدير المالي والإدارة", "CFO and management"), constraints: t("كل رقم مرتبط بمصدره\nلا توقعات دون أساس", "Trace each number\nNo unsupported forecasts"), format: "table", sources: "documents" },
    terms: ["مالي", "financial", "قوائم", "ميزانية", "p&l", "ربحية", "سيولة", "budget"] },
  { id: "sales-analysis", category: "analytics", archetype: "analytics", title: t("تحليل بيانات المبيعات", "Sales data analysis"),
    summary: t("اتجاهات وقيم مفقودة وتوصيات.", "Trends, missing values and recommendations."),
    task: t("حلّل بيانات المبيعات التي سأرفقها لاستخراج الاتجاهات والقيم المفقودة والتوصيات، مع توضيح طريقة الحساب وربط كل نتيجة بالبيانات الأصلية.", "Analyze my attached sales data for trends, missing values and recommendations. Explain calculations and trace every conclusion to the supplied data."),
    defaults: { deliverable: t("ملخص اتجاهات وجدول مؤشرات وتوصيات", "Trend summary, KPI table and recommendations"), audience: t("مدير المبيعات", "Sales manager"), constraints: t("وضّح طريقة كل حساب", "Explain every calculation"), format: "markdown", sources: "documents" },
    terms: ["sales", "csv", "مبيعات", "بيانات", "تحليل"] },
  { id: "churn-cohort", category: "analytics", archetype: "analytics", title: t("تحليل الاحتفاظ وتسرب العملاء", "Retention & churn cohorts"),
    summary: t("شرائح العملاء ومعدلات التسرب وإجراءات التحسين.", "Cohorts, churn rates and improvement actions."),
    task: t("حلّل بيانات العملاء المرفقة حسب شرائح تاريخ الانضمام لحساب معدلات الاحتفاظ والتسرب، وحدد الشرائح الأعلى خطورة واقترح إجراءات قابلة للقياس؛ اذكر حدود البيانات.", "Analyze the attached customer data by signup cohort to compute retention and churn, identify the riskiest segments and propose measurable actions. State data limitations."),
    defaults: { deliverable: t("جدول شرائح ومعدلات وتوصيات قابلة للقياس", "Cohort table, rates and measurable actions"), audience: t("فريق النمو والمنتج", "Growth and product team"), constraints: t("لا تستنتج سببية دون دليل", "No causal claims without evidence"), format: "table", sources: "documents" },
    terms: ["churn", "retention", "تسرب", "احتفاظ", "cohort", "شرائح"] },
  // Technical
  { id: "excel", category: "technical", archetype: "software", title: t("مراجعة Excel وإصلاحه", "Excel audit & repair"),
    summary: t("فحص الأوراق والمعادلات المكسورة والروابط.", "Audit sheets, broken formulas and links."),
    task: t("أريد كود VBA يراجع جميع أوراق ملف Excel الذي سأرفعه ويقرأ ورقة سجل المراجعة الموجودة فيه، ثم يقترح إصلاح المعادلات المكسورة والروابط غير الصالحة بناءً على الأدلة، مع نسخة احتياطية ومعاينة التغييرات قبل تنفيذها.", "Create VBA code to audit every worksheet in the Excel workbook I will upload, read its audit log sheet, and propose evidence-backed repairs for broken formulas and invalid links. Include a backup and a change preview before applying repairs."),
    defaults: { deliverable: t("وحدة VBA كاملة ومعاينة الإصلاحات وتقرير مراجعة", "Complete VBA module, repair preview and audit report"), audience: t("محلل Excel متوسط الخبرة", "Intermediate Excel analyst"), constraints: t("نسخة احتياطية قبل أي تعديل\nلا إصلاح دون موافقة", "Backup before any change\nNo repair without approval"), format: "code", sources: "documents" },
    terms: ["excel", "vba", "xlsx", "xlsm", "اكسيل", "إكسيل", "أكسيل", "شيت", "معادلات", "workbook"] },
  { id: "code-review", category: "technical", archetype: "software", title: t("مراجعة كود وأمان", "Code & security review"),
    summary: t("أخطاء وثغرات وتحسينات مع أمثلة إصلاح.", "Bugs, vulnerabilities and fixes."),
    task: t("راجع الكود الذي سأرفقه لاكتشاف الأخطاء المنطقية والثغرات الأمنية ومشكلات الأداء، مع ذكر السطر والخطورة واقتراح إصلاح؛ لا تفترض سلوك ملفات غير مرفقة.", "Review the code I attach for logic bugs, security vulnerabilities and performance issues, citing line, severity and a suggested fix. Do not assume behavior of files not provided."),
    defaults: { deliverable: t("قائمة ملاحظات مرتبة بالخطورة مع إصلاحات", "Severity-ranked findings with fixes"), audience: t("فريق التطوير", "Engineering team"), constraints: t("اذكر السطر لكل ملاحظة", "Cite the line for every finding"), format: "markdown", sources: "documents" },
    terms: ["code", "كود", "review", "ثغرة", "security", "bug", "برمجة"] },
  // Content & research
  { id: "document-review", category: "content", archetype: "research", title: t("مراجعة مستندات", "Document review"),
    summary: t("ملخص واختلافات وثغرات مع الاستشهاد.", "Summary, differences and gaps with citations."),
    task: t("راجع المستندات التي سأرفعها، واستخرج ملخصًا والاختلافات والثغرات مع ذكر اسم المستند لكل استنتاج، وصرّح بما لا تتضمنه المصادر.", "Review my uploaded documents. Summarize findings, differences and gaps, cite the document behind each conclusion, and state what the sources do not establish."),
    defaults: { deliverable: t("ملخص منظم مع الاستشهادات", "Structured summary with citations"), audience: t("فريق العمل", "Working team"), constraints: t("استشهد بالمستند لكل استنتاج", "Cite the document for each conclusion"), format: "markdown", sources: "documents" },
    terms: ["research", "document", "مستند", "وثائق", "بحث"] },
  { id: "marketing", category: "content", archetype: "copywriting", title: t("محتوى تسويقي", "Marketing content"),
    summary: t("صيغ إعلانية بنبرة العلامة دون ادعاءات.", "Brand-voice variants without unsupported claims."),
    task: t("اكتب ثلاث صيغ تسويقية لمنتجي بناءً على الوصف الذي أقدمه، تناسب جمهوري ونبرة علامتي، دون ادعاءات أو مزايا غير موثقة.", "Write three marketing variants for my product based on my supplied description, audience and brand voice. Do not invent benefits or unsupported claims."),
    defaults: { deliverable: t("ثلاث صيغ مع عنوان ودعوة لاتخاذ إجراء", "Three variants with headline and call to action"), audience: t("العملاء المستهدفون", "Target customers"), constraints: t("لا مزايا غير موثقة", "No unverified benefits"), format: "markdown", sources: "mixed" },
    terms: ["marketing", "copy", "محتوى", "تسويقي", "إعلان"] },
  { id: "visual-brief", category: "content", archetype: "creative", title: t("وصف تصميم بصري", "Visual design brief"),
    summary: t("تكوين وألوان وإضاءة وأسلوب.", "Composition, palette, lighting and style."),
    task: t("صغ وصفًا لتصميم بصري لمنتجي يحدد التكوين والألوان والإضاءة والأسلوب وفق تفاصيل المنتج التي أقدمها.", "Create a visual design brief for my product with composition, palette, lighting and style based on the product details I supply."),
    defaults: { deliverable: t("وصف تصميم مفصل جاهز لمولد الصور", "Detailed brief ready for an image generator"), audience: t("المصمم أو نموذج توليد الصور", "Designer or image model"), constraints: t("التزم بهوية العلامة", "Respect brand identity"), format: "plain", sources: "general" },
    terms: ["visual", "design", "صورة", "تصميم", "بصري"] },
  { id: "explain", category: "content", archetype: "general", title: t("شرح مبسّط", "Clear explanation"),
    summary: t("شرح بحسب مستوى المعرفة مع أمثلة.", "Level-appropriate explanation with examples."),
    task: t("اشرح الموضوع الذي أحدده بطريقة تناسب مستوى معرفتي، مع أمثلة واضحة وذكر حدود المعلومات دون تخمين.", "Explain my chosen topic at my knowledge level with clear examples. State information limits rather than guessing."),
    defaults: { deliverable: t("شرح متدرج مع أمثلة", "Stepwise explanation with examples"), audience: t("مبتدئ", "Beginner"), constraints: t("صرّح بحدود المعلومات", "State information limits"), format: "markdown", sources: "general" },
    terms: ["explain", "شرح", "تعليم", "تبسيط"] },
];

const normalize = (s: string) => s.toLowerCase().normalize("NFKC");

export function matchTemplates(input: string): RequestTemplate[] {
  const text = normalize(input);
  return REQUEST_TEMPLATES.map(template => ({ template, score: template.terms.filter(term => text.includes(term)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.template);
}

export function searchTemplates(query: string, category: TemplateCategory | "all"): RequestTemplate[] {
  const q = normalize(query.trim());
  return REQUEST_TEMPLATES.filter(tpl => category === "all" || tpl.category === category).filter(tpl => !q ||
    [tpl.title.ar, tpl.title.en, tpl.summary.ar, tpl.summary.en, ...tpl.terms].some(s => normalize(s).includes(q)));
}

export function templateAnswers(tpl: RequestTemplate, lang: "ar" | "en") {
  const d = tpl.defaults;
  return { deliverable: d.deliverable[lang], audience: d.audience[lang], constraints: d.constraints[lang], details: "", format: d.format, sources: d.sources };
}
