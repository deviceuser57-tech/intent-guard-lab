export type TaskType =
  | "code_generation" | "code_review" | "debugging" | "business_strategy" | "copywriting"
  | "content_marketing" | "data_analysis" | "data_extraction" | "agent_system" | "deep_research"
  | "creative_visual" | "education" | "legal_compliance" | "customer_support" | "general_inquiry";

export type Archetype =
  | "software" | "business" | "copywriting" | "analytics" | "agents" | "research" | "creative" | "general";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Complexity = "simple" | "moderate" | "complex";
export type Mode = "quick" | "expert" | "enterprise";

export type Component =
  | "role" | "context" | "task" | "constraints" | "output_contract" | "examples"
  | "reasoning" | "safety" | "variables" | "citations" | "tools" | "evaluation_rubric";

export interface IntentAnalysis {
  taskType: TaskType;
  archetype: Archetype;
  confidence: number;
  risk: RiskLevel;
  riskSignals: string[];
  complexity: Complexity;
  components: Component[];
  persona: string;
  variables: string[];
  keywords: string[];
}

export interface Specification {
  goal: string;
  archetype: Archetype;
  persona: string;
  audience: string;
  tone: string;
  constraints: string[];
  outputFormat: "markdown" | "json" | "plain" | "code" | "table";
  outputSchema: string;
  components: Component[];
  variables: { name: string; description: string; example: string }[];
  examples: string;
  reasoning: "none" | "brief" | "step_by_step";
  maxWords: number;
  advanced?: AdvancedControls;
}

export type ConfidenceMode = "off" | "evidence_weighted" | "source_count" | "bayesian";
export interface AdvancedControls {
  executiveDoc: boolean;
  confidence: ConfidenceMode;
  selfRedTeam: boolean;
  brutalTruth: boolean;
  documents: { name: string; content: string }[];
  docsWeight: number; // 0-100, remainder = web / general knowledge
}

export interface CompiledPrompt {
  system: string;
  user: string;
  outputContract: string;
  variables: string[];
}
