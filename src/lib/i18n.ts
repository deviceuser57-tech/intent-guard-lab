export type Lang = "en" | "ar";

const en = {
  appTitle: "Prompt Engineering Workbench", appSub: "Enterprise-grade prompt design, security & governance",
  quick: "Quick", expert: "Expert", enterprise: "Enterprise",
  describe: "Describe what you need the prompt to do", placeholder: "e.g. Write a TypeScript function that validates IBAN numbers, with unit tests. Use {{country}} as input.",
  generate: "Generate prompt", archetype: "Archetype", auto: "Auto-detect",
  tabIntent: "Intent Analysis", tabSpec: "Specification", tabCompiled: "Compiled Prompts", tabSecurity: "Security / Validation", tabRegistry: "Prompt Registry",
  taskType: "Task type", risk: "Risk level", complexity: "Complexity", confidence: "Confidence", persona: "Persona", components: "Required components", signals: "Risk signals", keywords: "Matched keywords", none: "None",
  goal: "Goal", audience: "Audience", tone: "Tone", constraints: "Constraints (one per line)", outputFormat: "Output format", schema: "Output schema", examples: "Few-shot examples", reasoning: "Reasoning", maxWords: "Max words", variables: "Variables",
  system: "System instructions", user: "User message", contract: "Output contract", copy: "Copy", copied: "Copied", raw: "Raw text", valid: "Payload valid", invalid: "Payload invalid",
  securityScore: "Security score", evalScore: "Evaluation score", findings: "Findings", mitigation: "Mitigation", tests: "Test cases", tokens: "Token usage", noFindings: "No findings.",
  saveNew: "Save as new asset", saveVersion: "Save new version", assetName: "Asset name", note: "Change note", audit: "Audit log (immutable)", empty: "No assets yet. Generate a prompt and save it.", compare: "Compare with latest", versions: "Versions",
  emptyState: "Describe a task and generate to see results.", enterpriseOnly: "Switch to Enterprise mode to access the registry.", lang: "العربية",
  correctness: "Correctness", coverage: "Coverage", specificity: "Specificity", groundedness: "Groundedness", citationPrecision: "Citation precision", tokenEfficiency: "Token efficiency",
  low: "Low", medium: "Medium", high: "High", critical: "Critical", simple: "Simple", moderate: "Moderate", complex: "Complex",
  software: "Software / Code", business: "Business Strategy", copywriting: "Copy & Content", analytics: "Data Analytics", agents: "Agents / System", research: "Deep Research", creative: "Creative / Visual", general: "General Inquiry",
  draft: "Draft", review: "Review", published: "Published", deprecated: "Deprecated", passed: "Passed", failed: "Failed",
};
type Dict = typeof en;
const ar: Dict = {
  appTitle: "منصة هندسة الأوامر", appSub: "تصميم أوامر وأمنها وحوكمتها على مستوى المؤسسات",
  quick: "سريع", expert: "خبير", enterprise: "مؤسسي",
  describe: "صف ما تريد أن يفعله الأمر", placeholder: "مثال: اكتب دالة TypeScript للتحقق من أرقام IBAN مع اختبارات. استخدم {{country}} كمدخل.",
  generate: "إنشاء الأمر", archetype: "النمط", auto: "اكتشاف تلقائي",
  tabIntent: "تحليل النية", tabSpec: "المواصفات", tabCompiled: "الأوامر المُجمَّعة", tabSecurity: "الأمان / التحقق", tabRegistry: "سجل الأوامر",
  taskType: "نوع المهمة", risk: "مستوى المخاطر", complexity: "التعقيد", confidence: "الثقة", persona: "الشخصية", components: "المكونات المطلوبة", signals: "مؤشرات المخاطر", keywords: "الكلمات المطابقة", none: "لا يوجد",
  goal: "الهدف", audience: "الجمهور", tone: "النبرة", constraints: "القيود (سطر لكل قيد)", outputFormat: "صيغة المخرجات", schema: "مخطط المخرجات", examples: "أمثلة", reasoning: "الاستدلال", maxWords: "أقصى عدد كلمات", variables: "المتغيرات",
  system: "تعليمات النظام", user: "رسالة المستخدم", contract: "عقد المخرجات", copy: "نسخ", copied: "تم النسخ", raw: "نص خام", valid: "الحمولة صالحة", invalid: "الحمولة غير صالحة",
  securityScore: "درجة الأمان", evalScore: "درجة التقييم", findings: "النتائج", mitigation: "المعالجة", tests: "حالات الاختبار", tokens: "استهلاك الرموز", noFindings: "لا توجد نتائج.",
  saveNew: "حفظ كأصل جديد", saveVersion: "حفظ إصدار جديد", assetName: "اسم الأصل", note: "ملاحظة التغيير", audit: "سجل التدقيق (غير قابل للتعديل)", empty: "لا توجد أصول بعد. أنشئ أمرًا واحفظه.", compare: "مقارنة بالأحدث", versions: "الإصدارات",
  emptyState: "صف مهمة واضغط إنشاء لرؤية النتائج.", enterpriseOnly: "انتقل إلى الوضع المؤسسي للوصول إلى السجل.", lang: "English",
  correctness: "الصحة", coverage: "التغطية", specificity: "الدقة", groundedness: "الاستناد", citationPrecision: "دقة الاستشهاد", tokenEfficiency: "كفاءة الرموز",
  low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج", simple: "بسيط", moderate: "متوسط", complex: "معقد",
  software: "البرمجيات", business: "استراتيجية الأعمال", copywriting: "الكتابة والمحتوى", analytics: "تحليل البيانات", agents: "الوكلاء / النظام", research: "البحث المعمق", creative: "إبداعي / بصري", general: "استفسار عام",
  draft: "مسودة", review: "مراجعة", published: "منشور", deprecated: "متقادم", passed: "نجح", failed: "فشل",
};
export const dicts = { en, ar };
export type TKey = keyof Dict;
export const makeT = (l: Lang) => (k: string) => (dicts[l] as Record<string, string>)[k] ?? k;
