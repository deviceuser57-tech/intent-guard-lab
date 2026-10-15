import { analyzeIntent as analyzeLegacyIntent } from "./intentAnalyzer";
import { analyzeIntent as analyzeDecisionIntent } from "./decisionEngine";
import type { IntentAnalysis as DecisionIntent, TaskType as DecisionTaskType } from "./specification";
import type { Complexity, RiskLevel, TaskType as LegacyTaskType } from "./types";

const LEGACY_TO_DECISION_TASK: Record<LegacyTaskType, DecisionTaskType> = {
  code_generation: "code_generation",
  code_review: "code_analysis",
  debugging: "code_analysis",
  business_strategy: "business_analysis",
  legal_compliance: "business_analysis",
  copywriting: "text_generation",
  content_marketing: "text_generation",
  customer_support: "text_generation",
  data_analysis: "data_analysis",
  data_extraction: "text_analysis",
  agent_system: "other",
  deep_research: "research",
  creative_visual: "visual_generation",
  education: "education",
  general_inquiry: "other",
};

export interface AnalyzerDifference {
  field: "taskType" | "riskLevel" | "complexity";
  legacyValue: string;
  normalizedLegacyValue?: string;
  decisionValue: string;
}

export interface AnalyzerAudit {
  consistent: boolean;
  legacy: {
    taskType: LegacyTaskType;
    normalizedTaskType: DecisionTaskType;
    archetype: string;
    riskLevel: RiskLevel;
    complexity: Complexity;
    confidence: number;
  };
  decision: {
    taskType: DecisionTaskType;
    riskLevel: RiskLevel;
    complexity: Complexity;
  };
  differences: AnalyzerDifference[];
}

export function auditIntentAnalyzers(
  input: string,
  language: "ar" | "en" = "en",
  decisionIntent?: DecisionIntent,
): AnalyzerAudit {
  const legacy = analyzeLegacyIntent(input);
  const decision = decisionIntent ?? analyzeDecisionIntent(input, language);
  const normalizedLegacyTask = LEGACY_TO_DECISION_TASK[legacy.taskType];
  const differences: AnalyzerDifference[] = [];

  if (normalizedLegacyTask !== decision.taskType) {
    differences.push({
      field: "taskType",
      legacyValue: legacy.taskType,
      normalizedLegacyValue: normalizedLegacyTask,
      decisionValue: decision.taskType,
    });
  }

  if (legacy.risk !== decision.riskLevel) {
    differences.push({
      field: "riskLevel",
      legacyValue: legacy.risk,
      decisionValue: decision.riskLevel,
    });
  }

  if (legacy.complexity !== decision.complexity) {
    differences.push({
      field: "complexity",
      legacyValue: legacy.complexity,
      decisionValue: decision.complexity,
    });
  }

  return {
    consistent: differences.length === 0,
    legacy: {
      taskType: legacy.taskType,
      normalizedTaskType: normalizedLegacyTask,
      archetype: legacy.archetype,
      riskLevel: legacy.risk,
      complexity: legacy.complexity,
      confidence: legacy.confidence,
    },
    decision: {
      taskType: decision.taskType,
      riskLevel: decision.riskLevel,
      complexity: decision.complexity,
    },
    differences,
  };
}
