/* ============================================================================
 * DECISION ENGINE
 * ============================================================================
 * Analyzes user intent and determines which prompt components are
 * required, recommended, optional, or not applicable.
 * 
 * This is the "intelligence" layer that prevents over-engineering simple
 * prompts while ensuring complex tasks get proper structure.
 * ============================================================================ */

import type {
  IntentAnalysis,
  PromptComponentDecision,
  ComponentStatus,
  TaskType,
  RiskLevel,
  PersonaSpec,
  Bi,
  EvidenceScore,
} from "./specification";
import { createEvidenceScore } from "./specification";
import { normalize } from "../engine";

/* ============================================================================
 * INTENT ANALYSIS
 * ============================================================================ */

const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  visual_generation: ["image", "picture", "photo", "visual", "render", "illustration", "صورة", "رسم", "تصميم"],
  visual_editing: ["edit", "modify", "enhance", "restore", "remove", "عدل", "حسن", "رمم"],
  text_generation: ["write", "create", "draft", "compose", "اكتب", "انشئ", "صاغ"],
  text_analysis: ["analyze", "review", "evaluate", "assess", "حلل", "راجع", "قيّم"],
  code_generation: ["code", "program", "script", "function", "class", "برمج", "كود", "سكريبت"],
  code_analysis: ["debug", "refactor", "optimize", "review code", "صلح", "حسّن"],
  research: ["research", "investigate", "study", "survey", "ابحث", "ادرس", "تحقق"],
  translation: ["translate", "localize", "ترجم", "حوّل"],
  summarization: ["summarize", "condense", "abstract", "لخص", "اختصر"],
  data_analysis: ["data", "analyze data", "statistics", "chart", "بيانات", "احصائيات", "رسم بياني"],
  creative_writing: ["story", "poem", "novel", "fiction", "قصة", "شعر", "رواية"],
  technical_writing: ["documentation", "manual", "spec", "guide", "توثيق", "دليل", "مواصفة"],
  business_analysis: ["business", "strategy", "market", "financial", "أعمال", "استراتيجية", "سوق"],
  education: ["teach", "learn", "explain", "tutorial", "علّم", "اشرح", "درس"],
  other: [],
};

const RISK_INDICATORS = {
  critical: ["medical", "legal", "financial advice", "safety", "طبي", "قانوني", "مالي", "سلامة"],
  high: ["contract", "compliance", "regulation", "security", "عقد", "امتثال", "تنظيم", "أمن"],
  medium: ["business", "professional", "technical", "أعمال", "مهني", "تقني"],
  low: ["creative", "casual", "personal", "إبداعي", "عادي", "شخصي"],
} as const;

export function analyzeIntent(input: string, language: "ar" | "en" = "ar"): IntentAnalysis {
  const normalized = normalize(input);
  const tokens = new Set(normalized.split(/\s+/));
  
  // Detect task type
  let taskType: TaskType = "other";
  let maxScore = 0;
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (type === "other") continue;
    let score = 0;
    for (const kw of keywords) {
      const normKw = normalize(kw);
      if (normalized.includes(normKw) || tokens.has(normKw)) {
        score += kw.length > 3 ? 2 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      taskType = type as TaskType;
    }
  }
  
  // Detect risk level
  let riskLevel: RiskLevel = "low";
  
  // Check critical first
  for (const ind of RISK_INDICATORS.critical) {
    if (normalized.includes(normalize(ind))) {
      riskLevel = "critical";
      break;
    }
  }
  
  // Check high if not already critical
  if (riskLevel !== "critical") {
    for (const ind of RISK_INDICATORS.high) {
      if (normalized.includes(normalize(ind))) {
        riskLevel = "high";
        break;
      }
    }
  }
  
  // Check medium if still low
  if (riskLevel === "low") {
    for (const ind of RISK_INDICATORS.medium) {
      if (normalized.includes(normalize(ind))) {
        riskLevel = "medium";
        break;
      }
    }
  }
  
  // Detect complexity
  const complexity: "simple" | "moderate" | "complex" = 
    input.length > 500 ? "complex" :
    input.length > 150 ? "moderate" : "simple";
  
  // Detect language
  const hasArabic = /[\u0600-\u06FF]/.test(input);
  const hasLatin = /[a-zA-Z]/.test(input);
  const detectedLanguage: "ar" | "en" | "mixed" = 
    hasArabic && hasLatin ? "mixed" :
    hasArabic ? "ar" : "en";
  
  // Detect ambiguity
  const ambiguityFlags: string[] = [];
  if (input.length < 20) ambiguityFlags.push("very_short_input");
  if (!input.includes("?") && !input.includes("؟") && input.length > 50) {
    ambiguityFlags.push("no_clear_question_or_instruction");
  }
  if (normalized.includes("شيء") || normalized.includes("something")) {
    ambiguityFlags.push("vague_subject");
  }
  
  // Extract objective (simplified)
  const objective = input.length > 200 ? input.slice(0, 200) + "..." : input;
  
  // Determine required components based on task type and risk
  const requiredComponents: string[] = ["objective", "output"];
  const recommendedComponents: string[] = ["persona"];
  
  if (riskLevel === "high" || riskLevel === "critical") {
    requiredComponents.push("constraints", "failureHandling", "security");
    recommendedComponents.push("grounding", "evidencePolicy");
  }
  
  if (taskType === "research" || taskType === "text_analysis") {
    requiredComponents.push("grounding", "evidencePolicy");
    recommendedComponents.push("context", "examples");
  }
  
  if (taskType === "code_generation" || taskType === "code_analysis") {
    requiredComponents.push("output");
    recommendedComponents.push("constraints", "examples");
  }
  
  if (taskType === "visual_generation" || taskType === "visual_editing") {
    requiredComponents.push("output");
    recommendedComponents.push("constraints", "examples");
  }
  
  if (complexity === "complex") {
    recommendedComponents.push("workflow", "qualityCriteria");
  }
  
  return {
    originalInput: input,
    normalizedIntent: normalized,
    taskType,
    objective,
    riskLevel,
    complexity,
    detectedLanguage,
    ambiguityFlags,
    suggestedCommands: [], // Will be populated by command engine
    requiredComponents,
    recommendedComponents,
    executionStatus: "measured",
  };
}

/* ============================================================================
 * COMPONENT DECISION ENGINE
 * ============================================================================ */

export function decideComponents(intent: IntentAnalysis): PromptComponentDecision[] {
  const decisions: PromptComponentDecision[] = [];
  
  const makeDecision = (
    component: string,
    status: ComponentStatus,
    reason: string,
    source: PromptComponentDecision["source"],
    confidenceValue?: number,
    dependencies?: string[],
    trace?: PromptComponentDecision["trace"]
  ): PromptComponentDecision => {
    // Convert naked confidence to EvidenceScore
    const evidence: EvidenceScore | undefined = confidenceValue !== undefined
      ? createEvidenceScore(
          confidenceValue >= 0.9 ? "measured" : confidenceValue >= 0.7 ? "inferred" : "estimated",
          `Confidence ${Math.round(confidenceValue * 100)}% based on ${source}`,
          Math.round(confidenceValue * 100),
          [{ source, observation: reason }]
        )
      : undefined;
    
    return {
      component,
      status,
      reason,
      evidence,
      dependencies,
      source,
      trace,
    };
  };
  
  // Core components
  decisions.push(makeDecision(
    "objective",
    "required",
    "Every prompt must have a clear objective",
    "system_safeguard",
    1.0
  ));
  
  decisions.push(makeDecision(
    "output",
    "required",
    "Every prompt must specify expected output format",
    "system_safeguard",
    1.0
  ));
  
  // Role/Persona
  if (intent.taskType === "creative_writing" || intent.taskType === "technical_writing") {
    decisions.push(makeDecision(
      "role",
      "recommended",
      `Writing tasks benefit from a defined persona (${intent.taskType})`,
      "task_analysis",
      0.8
    ));
  } else if (intent.riskLevel === "high" || intent.riskLevel === "critical") {
    decisions.push(makeDecision(
      "role",
      "required",
      "High-risk tasks require explicit role definition for accountability",
      "risk_policy",
      0.95
    ));
  } else {
    decisions.push(makeDecision(
      "role",
      "optional",
      "Persona is optional for this task type and risk level",
      "task_analysis",
      0.6
    ));
  }
  
  // Context
  if (intent.taskType === "research" || intent.taskType === "text_analysis" || intent.taskType === "data_analysis") {
    decisions.push(makeDecision(
      "context",
      "recommended",
      "Analytical tasks benefit from explicit context",
      "task_analysis",
      0.85
    ));
  } else {
    decisions.push(makeDecision(
      "context",
      "optional",
      "Context is optional for this task type",
      "task_analysis",
      0.5
    ));
  }
  
  // Constraints
  if (intent.riskLevel === "high" || intent.riskLevel === "critical") {
    decisions.push(makeDecision(
      "constraints",
      "required",
      "High-risk tasks require explicit constraints",
      "risk_policy",
      0.95
    ));
  } else if (intent.taskType === "code_generation" || intent.taskType === "visual_generation") {
    decisions.push(makeDecision(
      "constraints",
      "recommended",
      "Technical/creative tasks benefit from constraints",
      "task_analysis",
      0.75
    ));
  } else {
    decisions.push(makeDecision(
      "constraints",
      "optional",
      "Constraints are optional for this task",
      "task_analysis",
      0.5
    ));
  }
  
  // Grounding & Evidence
  if (intent.taskType === "research" || intent.taskType === "text_analysis") {
    decisions.push(makeDecision(
      "grounding",
      "required",
      "Research/analysis tasks require evidence grounding",
      "task_analysis",
      0.95
    ));
    decisions.push(makeDecision(
      "evidencePolicy",
      "required",
      "Research/analysis tasks require explicit evidence policy",
      "task_analysis",
      0.95
    ));
  } else if (intent.riskLevel === "high" || intent.riskLevel === "critical") {
    decisions.push(makeDecision(
      "grounding",
      "recommended",
      "High-risk tasks benefit from grounding",
      "risk_policy",
      0.8
    ));
    decisions.push(makeDecision(
      "evidencePolicy",
      "recommended",
      "High-risk tasks benefit from explicit evidence policy",
      "risk_policy",
      0.8
    ));
  } else {
    decisions.push(makeDecision(
      "grounding",
      "not_applicable",
      "Grounding not required for this task type and risk level",
      "task_analysis",
      0.7
    ));
    decisions.push(makeDecision(
      "evidencePolicy",
      "not_applicable",
      "Evidence policy not required for this task type and risk level",
      "task_analysis",
      0.7
    ));
  }
  
  // Reasoning
  if (intent.taskType === "code_analysis" || intent.taskType === "text_analysis") {
    decisions.push(makeDecision(
      "reasoningApproach",
      "recommended",
      "Analytical tasks benefit from structured reasoning",
      "task_analysis",
      0.8
    ));
  } else {
    decisions.push(makeDecision(
      "reasoningApproach",
      "not_applicable",
      "Reasoning approach not needed for this task type",
      "task_analysis",
      0.6
    ));
  }
  
  // Failure Handling
  if (intent.riskLevel === "high" || intent.riskLevel === "critical") {
    decisions.push(makeDecision(
      "failureHandling",
      "required",
      "High-risk tasks require explicit failure handling",
      "risk_policy",
      0.95
    ));
  } else {
    decisions.push(makeDecision(
      "failureHandling",
      "optional",
      "Failure handling is optional for this risk level",
      "task_analysis",
      0.5
    ));
  }
  
  // Security
  if (intent.riskLevel === "critical") {
    decisions.push(makeDecision(
      "security",
      "required",
      "Critical-risk tasks require explicit security specification",
      "risk_policy",
      1.0,
      undefined,
      { policyId: "SEC-001", ruleId: "RISK_CRITICAL_SECURITY" }
    ));
  } else if (intent.riskLevel === "high") {
    decisions.push(makeDecision(
      "security",
      "recommended",
      "High-risk tasks benefit from security specification",
      "risk_policy",
      0.85,
      undefined,
      { policyId: "SEC-002", ruleId: "RISK_HIGH_SECURITY" }
    ));
  } else {
    decisions.push(makeDecision(
      "security",
      "not_applicable",
      "Security specification not required for this risk level",
      "task_analysis",
      0.6
    ));
  }
  
  // Tools
  decisions.push(makeDecision(
    "tools",
    "not_applicable",
    "Tool policy not applicable in current execution environment",
    "system_safeguard",
    1.0
  ));
  
  // RAG
  decisions.push(makeDecision(
    "rag",
    "not_applicable",
    "RAG not available in current execution environment",
    "system_safeguard",
    1.0
  ));
  
  // Workflow
  if (intent.complexity === "complex") {
    decisions.push(makeDecision(
      "workflow",
      "recommended",
      "Complex tasks benefit from explicit workflow",
      "task_analysis",
      0.75
    ));
  } else {
    decisions.push(makeDecision(
      "workflow",
      "not_applicable",
      "Workflow not needed for simple/moderate tasks",
      "task_analysis",
      0.6
    ));
  }
  
  // Quality Criteria
  if (intent.riskLevel === "high" || intent.riskLevel === "critical" || intent.complexity === "complex") {
    decisions.push(makeDecision(
      "qualityCriteria",
      "recommended",
      "Complex/high-risk tasks benefit from quality criteria",
      "task_analysis",
      0.8
    ));
  } else {
    decisions.push(makeDecision(
      "qualityCriteria",
      "optional",
      "Quality criteria are optional for this task",
      "task_analysis",
      0.5
    ));
  }
  
  // Examples
  if (intent.taskType === "code_generation" || intent.taskType === "visual_generation") {
    decisions.push(makeDecision(
      "examples",
      "recommended",
      "Technical/creative tasks benefit from examples",
      "task_analysis",
      0.75
    ));
  } else {
    decisions.push(makeDecision(
      "examples",
      "optional",
      "Examples are optional for this task type",
      "task_analysis",
      0.5
    ));
  }
  
  // Evaluation (always recommended for governance)
  decisions.push(makeDecision(
    "evaluation",
    "recommended",
    "Evaluation is recommended for governance and traceability",
    "system_safeguard",
    0.9
  ));
  
  return decisions;
}

/* ============================================================================
 * PERSONA SUGGESTION
 * ============================================================================ */

const PERSONA_SUGGESTIONS: Record<TaskType, PersonaSpec> = {
  visual_generation: {
    id: "visual_artist",
    name: { ar: "فنان بصري محترف", en: "Professional Visual Artist" },
    description: { ar: "خبير في التوليد البصري والتصميم", en: "Expert in visual generation and design" },
    domain: "visual",
    expertise: ["composition", "color_theory", "lighting", "style"],
    tone: "creative",
    source: "system",
  },
  visual_editing: {
    id: "photo_editor",
    name: { ar: "محرر صور محترف", en: "Professional Photo Editor" },
    description: { ar: "خبير في تحرير وتحسين الصور", en: "Expert in photo editing and enhancement" },
    domain: "visual",
    expertise: ["retouching", "color_correction", "restoration"],
    tone: "technical",
    source: "system",
  },
  text_generation: {
    id: "professional_writer",
    name: { ar: "كاتب محترف", en: "Professional Writer" },
    description: { ar: "خبير في الكتابة الإبداعية والتقنية", en: "Expert in creative and technical writing" },
    domain: "writing",
    expertise: ["storytelling", "editing", "style"],
    tone: "professional",
    source: "system",
  },
  text_analysis: {
    id: "analyst",
    name: { ar: "محلل نصوص", en: "Text Analyst" },
    description: { ar: "خبير في تحليل النصوص واستخراج المعاني", en: "Expert in text analysis and meaning extraction" },
    domain: "analysis",
    expertise: ["critical_thinking", "pattern_recognition", "synthesis"],
    tone: "academic",
    source: "system",
  },
  code_generation: {
    id: "software_engineer",
    name: { ar: "مهندس برمجيات", en: "Software Engineer" },
    description: { ar: "خبير في تطوير البرمجيات وكتابة الكود", en: "Expert in software development and coding" },
    domain: "technology",
    expertise: ["algorithms", "design_patterns", "best_practices"],
    tone: "technical",
    source: "system",
  },
  code_analysis: {
    id: "code_reviewer",
    name: { ar: "مراجع كود", en: "Code Reviewer" },
    description: { ar: "خبير في مراجعة وتحليل الكود", en: "Expert in code review and analysis" },
    domain: "technology",
    expertise: ["debugging", "optimization", "security"],
    tone: "technical",
    source: "system",
  },
  research: {
    id: "researcher",
    name: { ar: "باحث أكاديمي", en: "Academic Researcher" },
    description: { ar: "خبير في البحث العلمي والتحليل الأكاديمي", en: "Expert in scientific research and academic analysis" },
    domain: "research",
    expertise: ["methodology", "citation", "critical_analysis"],
    tone: "academic",
    source: "system",
  },
  translation: {
    id: "translator",
    name: { ar: "مترجم محترف", en: "Professional Translator" },
    description: { ar: "خبير في الترجمة والتوطين", en: "Expert in translation and localization" },
    domain: "languages",
    expertise: ["bilingual", "cultural_context", "terminology"],
    tone: "professional",
    source: "system",
  },
  summarization: {
    id: "summarizer",
    name: { ar: "ملخص نصوص", en: "Text Summarizer" },
    description: { ar: "خبير في تلخيص النصوص واستخراج النقاط الرئيسية", en: "Expert in text summarization and key point extraction" },
    domain: "writing",
    expertise: ["conciseness", "clarity", "hierarchy"],
    tone: "concise",
    source: "system",
  },
  data_analysis: {
    id: "data_scientist",
    name: { ar: "عالم بيانات", en: "Data Scientist" },
    description: { ar: "خبير في تحليل البيانات والإحصاء", en: "Expert in data analysis and statistics" },
    domain: "data",
    expertise: ["statistics", "visualization", "insights"],
    tone: "technical",
    source: "system",
  },
  creative_writing: {
    id: "creative_writer",
    name: { ar: "كاتب إبداعي", en: "Creative Writer" },
    description: { ar: "خبير في الكتابة الإبداعية والسرد", en: "Expert in creative writing and storytelling" },
    domain: "creative",
    expertise: ["narrative", "character", "style"],
    tone: "creative",
    source: "system",
  },
  technical_writing: {
    id: "technical_writer",
    name: { ar: "كاتب تقني", en: "Technical Writer" },
    description: { ar: "خبير في الكتابة التقنية والتوثيق", en: "Expert in technical writing and documentation" },
    domain: "technical",
    expertise: ["clarity", "structure", "accuracy"],
    tone: "technical",
    source: "system",
  },
  business_analysis: {
    id: "business_analyst",
    name: { ar: "محلل أعمال", en: "Business Analyst" },
    description: { ar: "خبير في تحليل الأعمال والاستراتيجية", en: "Expert in business analysis and strategy" },
    domain: "business",
    expertise: ["strategy", "market_analysis", "financial_modeling"],
    tone: "executive",
    source: "system",
  },
  education: {
    id: "educator",
    name: { ar: "معلم خبير", en: "Expert Educator" },
    description: { ar: "خبير في التعليم والتدريب", en: "Expert in education and training" },
    domain: "education",
    expertise: ["pedagogy", "clarity", "engagement"],
    tone: "professional",
    source: "system",
  },
  other: {
    id: "general_assistant",
    name: { ar: "مساعد عام", en: "General Assistant" },
    description: { ar: "مساعد متعدد المهارات", en: "Versatile general assistant" },
    domain: "general",
    expertise: ["adaptability", "clarity"],
    tone: "professional",
    source: "system",
  },
};

export function suggestPersona(intent: IntentAnalysis): PersonaSpec {
  return PERSONA_SUGGESTIONS[intent.taskType] || PERSONA_SUGGESTIONS.other;
}
