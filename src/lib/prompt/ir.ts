import { analyzeIntent, decideComponents } from "./decisionEngine";
import { auditIntentAnalyzers, type AnalyzerAudit } from "./analyzerAudit";
import { lintPrompt } from "./linter";
import { assessReadiness } from "./readiness";
import type { Specification as WorkbenchSpecification } from "./types";
import type {
  PromptSpecification,
  TaskType as IRTaskType,
  IntentAnalysis as IRIntentAnalysis,
  ValidationFinding,
  ReadinessAssessment,
  PromptComponentDecision,
} from "./specification";

const TASK_TYPE_MAP: Record<WorkbenchSpecification["archetype"], IRTaskType> = {
  software: "code_generation",
  business: "business_analysis",
  copywriting: "text_generation",
  analytics: "data_analysis",
  agents: "other",
  research: "research",
  creative: "creative_writing",
  general: "other",
};

function mapTaskType(type: string, archetype: WorkbenchSpecification["archetype"]): IRTaskType {
  const direct: Record<string, IRTaskType> = {
    code_generation: "code_generation",
    code_review: "code_analysis",
    debugging: "code_analysis",
    business_strategy: "business_analysis",
    copywriting: "text_generation",
    content_marketing: "text_generation",
    data_analysis: "data_analysis",
    data_extraction: "text_analysis",
    agent_system: "other",
    deep_research: "research",
    creative_visual: "visual_generation",
    education: "education",
    legal_compliance: "business_analysis",
    customer_support: "text_generation",
    general_inquiry: "other",
  };
  return direct[type] ?? TASK_TYPE_MAP[archetype] ?? "other";
}

export interface PromptIRResult {
  specification: PromptSpecification;
  intent: IRIntentAnalysis;
  decisions: PromptComponentDecision[];
  findings: ValidationFinding[];
  readiness: ReadinessAssessment;
  analyzerAudit: AnalyzerAudit;
}

export function buildPromptIR(
  sourceText: string,
  uiSpec: WorkbenchSpecification,
  language: "ar" | "en" = "en",
): PromptIRResult {
  const intent = analyzeIntent(sourceText, language);
  const decisions = decideComponents(intent);
  const analyzerAudit = auditIntentAnalyzers(sourceText, language, intent);
  const now = new Date().toISOString();
  const constraints = uiSpec.constraints.map((description, index) => ({
    id: `constraint-${index + 1}`,
    type: "custom" as const,
    description,
    enforced: true,
  }));
  const isResearch = intent.taskType === "research" || intent.taskType === "text_analysis";
  const isHighRisk = intent.riskLevel === "high" || intent.riskLevel === "critical";

  const specification: PromptSpecification = {
    intent: sourceText,
    objective: uiSpec.goal.trim() || sourceText,
    domain: uiSpec.archetype,
    taskType: mapTaskType(intent.taskType, uiSpec.archetype),
    role: {
      id: "workbench-persona",
      name: { ar: uiSpec.persona || "مساعد متخصص", en: uiSpec.persona || "Specialized assistant" },
      description: {
        ar: `موجّه للجمهور المحدد: ${uiSpec.audience || "غير محدد"}`,
        en: `Tailored to the specified audience: ${uiSpec.audience || "unspecified"}`,
      },
      domain: uiSpec.archetype,
      tone: "professional",
      source: "user",
    },
    context: { available: [], selected: [], actuallyUsed: [] },
    inputs: [
      {
        id: "user-request",
        name: "User request",
        type: "text",
        required: true,
        description: "Prompt text entered in the Workbench",
        value: sourceText,
      },
    ],
    constraints,
    reasoningApproach: {
      approach:
        uiSpec.reasoning === "step_by_step"
          ? "step_by_step"
          : uiSpec.reasoning === "brief"
            ? "concise"
            : "none",
      exposeReasoning: false,
    },
    ...(isResearch || isHighRisk
      ? {
          grounding: {
            required: isResearch,
            sourcePolicy: "mixed" as const,
            citationRequired: isResearch,
            missingEvidenceHandling: "state_uncertainty" as const,
          },
          evidencePolicy: {
            levels: ["direct", "contextual", "referenced", "inferred"] as (
              "direct" | "contextual" | "referenced" | "inferred" | "analogical"
            )[],
            minimumLevel: isResearch ? "referenced" : "contextual",
            requireCitation: isResearch,
          },
        }
      : {}),
    output: {
      format: uiSpec.outputFormat,
      language: language === "ar" ? "ar" : "en",
      length: { max: uiSpec.maxWords, unit: "words" },
      ...(uiSpec.outputSchema.trim()
        ? {
            validationRules: [
              `Output schema supplied: ${uiSpec.outputSchema.trim().slice(0, 500)}`,
            ],
          }
        : {}),
    },
    qualityCriteria: [],
    ...(uiSpec.examples.trim()
      ? {
          examples: [
            {
              id: "workbench-example",
              input: "Representative input",
              output: uiSpec.examples,
              description: "Example supplied in Workbench",
            },
          ],
        }
      : {}),
    failureHandling: {
      onMissingInput: "ask_user",
      onAmbiguity: "clarify",
      onSecurityViolation: "refuse",
      onToolFailure: "ask_user",
      maxRetries: 1,
    },
    security: {
      trustHierarchy: ["system", "application", "user", "file", "rag", "tool", "model"],
      injectionProtection: false,
      dataLeakageProtection: false,
      sensitiveDataPolicy: "warn",
    },
    tools: {
      enabled: false,
      allowedTools: [],
      allowedOperations: [],
      requireApprovalFor: [],
      maxCallsPerRun: 0,
      inputValidation: true,
      outputValidation: true,
      failureBehavior: "stop",
    },
    rag: { enabled: false, executionStatus: "unavailable" },
    evaluation: {
      functionalTests: [],
      adversarialTests: [],
      regressionTests: [],
      redTeamRuns: [],
      executionStatus: "not_executed",
    },
    metadata: {
      assetId: "workbench-active-prompt",
      version: "0.1.0",
      author: "Workbench",
      createdAt: now,
      updatedAt: now,
      lifecycleState: "draft",
      tags: [language, uiSpec.archetype],
      domain: uiSpec.archetype,
      category: uiSpec.outputFormat,
      changeSummary:
        "Generated from the active Workbench specification; execution tests have not been run.",
    },
  };
  const findings = lintPrompt(specification, decisions);
  const readiness = assessReadiness(specification, decisions);
  return { specification, intent, decisions, findings, readiness, analyzerAudit };
}
