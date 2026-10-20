import { analyzeIntent } from "./intentAnalyzer";
import { defaultSpec, DEFAULT_ADV } from "./compiler";
import type { Archetype, Specification, AdvancedControls } from "./types";

export interface AssistantAnswers {
  deliverable: string;
  audience: string;
  constraints: string;
  format: Specification["outputFormat"];
  sources: "documents" | "mixed" | "general";
  details: string;
}
export interface AssistantDraft {
  source: string;
  specification: Specification;
  inputValues: Record<string, string>;
}

export function synthesizeRequest(source: string, answers: AssistantAnswers, documents: AdvancedControls["documents"], language: "ar" | "en", override?: Archetype): AssistantDraft {
  if (!source.trim()) throw new Error(language === "ar" ? "اكتب طلبك أولًا." : "Enter a request first.");
  const ar = language === "ar";
  const goal = [source.trim(),
    answers.deliverable.trim() && `${ar ? "النتيجة المطلوبة" : "Deliverable"}: ${answers.deliverable.trim()}`,
    answers.audience.trim() && `${ar ? "الجمهور" : "Audience"}: ${answers.audience.trim()}`,
    answers.constraints.trim() && `${ar ? "الشروط المتفق عليها" : "Agreed constraints"}: ${answers.constraints.trim()}`,
    answers.details.trim() && `${ar ? "تفاصيل وأمثلة المستخدم" : "User details and examples"}: ${answers.details.trim()}`,
    documents.length > 0 && `${ar ? "المدخلات المرفقة" : "Attached inputs"}: ${documents.map(d => d.name).join(", ")}`,
  ].filter(Boolean).join("\n\n");
  const analysis = analyzeIntent(goal, override ?? null);
  const spec = defaultSpec(goal, analysis);
  const excel = /excel|vba|workbook|اكسيل|إكسيل|أكسيل|شيت/i.test(source);
  const constraints = [...spec.constraints, ...answers.constraints.split("\n").map(s => s.trim()).filter(Boolean),
    ar ? "اكتب الشرح باللغة العربية؛ احتفظ بأسماء الملفات والحقول والكود كما هي." : "Write explanations in English; preserve file names, field names and code identifiers.",
    ar ? "لا تفترض محتوى ملف غير مرفق أو بيانات لم يذكرها المستخدم. صرّح بالمدخلات الناقصة." : "Do not assume unprovided file contents or user facts. State missing inputs.",
  ];
  if (excel) constraints.push(...(ar ? [
    "استخدم VBA لبرنامج Excel، واقرأ كل أوراق العمل ذات الصلة وسجل المراجعة المسمّى في الطلب.",
    "أنشئ نسخة احتياطية واعرض التغييرات المقترحة قبل أي إصلاح يحتاج موافقة؛ سجّل القيم والمعادلات الأصلية والجديدة.",
    "لا تخفِ أخطاء المعادلات بإضافة IFERROR أو تحويل الروابط إلى قيم ثابتة كإصلاح افتراضي. لا تصلح مرجعًا دون دليل.",
    "لا تفترض أسماء أعمدة سجل المراجعة؛ تحقّق من بنيته الفعلية، وإن تعذر ذلك اطلب المعلومات الناقصة.",
  ] : [
    "Use Excel VBA; inspect relevant worksheets and the audit sheet named in the request.",
    "Create a backup and preview proposed changes before repairs requiring approval; log original and replacement formulas and values.",
    "Never hide formula errors with IFERROR or turn links into static values as a default repair. Repair references only with evidence.",
    "Do not assume audit log column names. Validate the actual structure or request missing information.",
  ]));
  const docsWeight = answers.sources === "documents" ? 100 : answers.sources === "mixed" ? 70 : 0;
  const advanced: AdvancedControls = { ...DEFAULT_ADV, documents: documents.map(d => ({ ...d })), docsWeight,
    selfRedTeam: true, confidence: answers.format === "json" || answers.format === "code" ? "off" : "evidence_weighted",
  };
  if (answers.sources === "documents") constraints.push(ar ? "اعتمد فقط على الملفات المقدمة؛ إذا لم تتوفر، اطلبها ولا تستبدلها بمعرفة عامة." : "Use only provided files. If unavailable, request them; do not substitute general knowledge.");
  const components = [...new Set([...spec.components, "role", "context", "task", "constraints", "output_contract", "variables", "safety", "reasoning", "examples"] as Specification["components"])];
  const specification: Specification = { ...spec, goal, constraints, components, advanced,
    persona: excel ? (ar ? "خبير Excel وVBA ومراجعة سلامة المصنفات" : "Excel VBA and workbook integrity specialist") : spec.persona,
    audience: answers.audience.trim(), outputFormat: answers.format,
    outputSchema: answers.format === "json" ? '{"summary":"string","findings":[],"missing_inputs":[]}' : "",
    examples: answers.details.trim(), variables: [{ name: "input", description: ar ? "المدخلات والملفات المتاحة" : "Available inputs and files", example: documents.map(d => d.name).join(", ") }],
  };
  return { source: source.trim(), specification, inputValues: assistantInputValues(specification) };
}

export function assistantInputValues(spec: Specification): Record<string, string> {
  const documents = spec.advanced?.documents ?? [];
  return { user_request: spec.goal, input: documents.length ? documents.map(d => `${d.name}\n${d.content}`).join("\n\n") : spec.goal };
}