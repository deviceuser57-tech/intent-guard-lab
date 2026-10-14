/* ============================================================================
 * EVIDENCE-BASED SCORING
 * ============================================================================
 * Replaces naked confidence scores with evidence-backed assessments.
 * Never present a value without indicating how it was derived.
 * ============================================================================ */

export type EvidenceStatus =
  | "measured"      // Actual execution/observation occurred
  | "inferred"      // Derived from related evidence
  | "estimated"     // Prediction without direct evidence
  | "not_tested";   // No attempt to measure

export interface EvidenceItem {
  source: string;        // e.g., "task_analysis", "user_input", "policy_rule"
  observation: string;   // What was observed
  timestamp?: number;    // When measured
}

export interface EvidenceScore {
  value?: number;                    // 0-100, only if measured/inferred
  status: EvidenceStatus;            // How this score was derived
  basis: string;                     // One-line explanation
  evidence: EvidenceItem[];          // Supporting observations
  measuredAt?: number;               // Timestamp of last measurement
}

export function createEvidenceScore(
  status: EvidenceStatus,
  basis: string,
  value?: number,
  evidence: EvidenceItem[] = []
): EvidenceScore {
  return {
    value,
    status,
    basis,
    evidence,
    measuredAt: status === "measured" || status === "inferred" ? Date.now() : undefined,
  };
}

export function emptyEvidenceScore(): EvidenceScore {
  return {
    status: "not_tested",
    basis: "No assessment performed",
    evidence: [],
  };
}

/* ============================================================================
 * PROMPT SPECIFICATION / INTERMEDIATE REPRESENTATION (IR)
 * ============================================================================
 * This is the model-independent, serializable, versionable, testable
 * representation of a prompt. The final prompt text is a COMPILED artifact
 * derived from this specification.
 * 
 * Key principles:
 * - Never treat the final prompt text as the source of truth
 * - Every field must be serializable to JSON
 * - Every change must be traceable via metadata
 * - The specification is model-independent; adapters compile it per model
 * ============================================================================ */

export type ComponentStatus = 
  | "required"
  | "recommended"
  | "optional"
  | "not_applicable"
  | "auto";

export type ExecutionStatus =
  | "measured"
  | "estimated"
  | "inferred"
  | "not_executed"
  | "unavailable";

export type LifecycleState =
  | "draft"
  | "review"
  | "test"
  | "approved"
  | "published"
  | "monitored"
  | "deprecated"
  | "archived";

export type ReadinessState =
  | "not_evaluated"
  | "partially_tested"
  | "needs_review"
  | "ready_for_release"
  | "not_ready"
  | "blocked";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type TaskType =
  | "visual_generation"
  | "visual_editing"
  | "text_generation"
  | "text_analysis"
  | "code_generation"
  | "code_analysis"
  | "research"
  | "translation"
  | "summarization"
  | "data_analysis"
  | "creative_writing"
  | "technical_writing"
  | "business_analysis"
  | "education"
  | "other";

/* ============================================================================
 * PERSONA
 * ============================================================================ */
export interface PersonaSpec {
  id: string;
  name: Bi;
  description: Bi;
  domain?: string;
  expertise?: string[];
  tone?: "professional" | "creative" | "technical" | "casual" | "academic" | "executive" | "concise" | "detailed";
  source: "system" | "user" | "auto_suggested";
}

/* ============================================================================
 * CONTEXT
 * ============================================================================ */
export type ContextSourceType =
  | "text"
  | "file"
  | "image"
  | "url"
  | "code"
  | "data"
  | "previous_prompt"
  | "saved_knowledge"
  | "user_memory"
  | "rag";

export type TrustLevel = "trusted" | "user_supplied" | "external" | "untrusted";
export type Classification = "public" | "internal" | "confidential" | "restricted";

export interface ContextSource {
  id: string;
  type: ContextSourceType;
  name: string;
  contentRef?: string;
  trustLevel: TrustLevel;
  classification: Classification;
  relevanceScore?: number;
  selected: boolean;
  actuallyUsed: boolean;
}

export interface ContextSpec {
  available: ContextSource[];
  selected: ContextSource[];
  actuallyUsed: ContextSource[];
}

/* ============================================================================
 * INPUTS
 * ============================================================================ */
export interface InputSpec {
  id: string;
  name: string;
  type: "text" | "file" | "image" | "data" | "code" | "url";
  required: boolean;
  description?: string;
  value?: unknown;
}

/* ============================================================================
 * CONSTRAINTS
 * ============================================================================ */
export interface ConstraintSpec {
  id: string;
  type: "format" | "length" | "language" | "style" | "domain" | "security" | "custom";
  description: string;
  value?: unknown;
  enforced: boolean;
}

/* ============================================================================
 * REASONING
 * ============================================================================ */
export interface ReasoningSpec {
  approach: "none" | "concise" | "step_by_step" | "chain_of_thought" | "tree_of_thought";
  exposeReasoning: boolean; // NEVER true for production (security)
  maxDepth?: number;
}

/* ============================================================================
 * GROUNDING & EVIDENCE
 * ============================================================================ */
export interface GroundingSpec {
  required: boolean;
  sourcePolicy: "cited_sources_only" | "internal_knowledge" | "mixed";
  citationRequired: boolean;
  missingEvidenceHandling: "state_uncertainty" | "refuse" | "best_effort";
}

export interface EvidencePolicy {
  levels: ("direct" | "contextual" | "referenced" | "inferred" | "analogical")[];
  minimumLevel: string;
  requireCitation: boolean;
}

/* ============================================================================
 * OUTPUT
 * ============================================================================ */
export interface OutputSpec {
  format: string; // e.g., "markdown", "json", "image", "code"
  schema?: Record<string, unknown>; // For structured outputs
  length?: { min?: number; max?: number; unit: "words" | "tokens" | "characters" | "images" | "pages" };
  language?: string;
  mimeType?: string;
  validationRules?: string[];
}

/* ============================================================================
 * QUALITY
 * ============================================================================ */
export interface QualityCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1
  measurable: boolean;
  threshold?: number;
}

/* ============================================================================
 * EXAMPLES
 * ============================================================================ */
export interface ExampleSpec {
  id: string;
  input: unknown;
  output: unknown;
  description?: string;
}

/* ============================================================================
 * FAILURE HANDLING
 * ============================================================================ */
export interface FailureHandlingSpec {
  onMissingInput: "refuse" | "best_effort" | "ask_user";
  onAmbiguity: "clarify" | "best_effort" | "refuse";
  onSecurityViolation: "refuse" | "warn_and_continue";
  onToolFailure: "stop" | "fallback" | "ask_user";
  maxRetries?: number;
}

/* ============================================================================
 * SECURITY
 * ============================================================================ */
export interface SecuritySpec {
  trustHierarchy: ("system" | "application" | "user" | "file" | "rag" | "tool" | "model")[];
  injectionProtection: boolean;
  dataLeakageProtection: boolean;
  sensitiveDataPolicy: "redact" | "warn" | "allow";
  toolPolicy?: ToolPolicy;
}

export interface ToolPolicy {
  enabled: boolean;
  allowedTools: string[];
  allowedOperations: string[];
  requireApprovalFor: string[];
  maxCallsPerRun: number;
  inputValidation: boolean;
  outputValidation: boolean;
  failureBehavior: "stop" | "fallback" | "ask_user";
}

/* ============================================================================
 * RAG
 * ============================================================================ */
export interface RAGConfig {
  enabled: boolean;
  collectionIds?: string[];
  topK?: number;
  rerank?: boolean;
  citationRequired?: boolean;
  sourcePriority?: string[];
  minimumRetrievalConfidence?: number;
  contextCompression?: boolean;
  maxContextTokens?: number;
  conflictDetection?: boolean;
  accessFilter?: string;
  executionStatus: ExecutionStatus;
}

/* ============================================================================
 * WORKFLOW
 * ============================================================================ */
export interface WorkflowSpec {
  steps: {
    id: string;
    name: string;
    description?: string;
    dependsOn?: string[];
  }[];
}

/* ============================================================================
 * EVALUATION
 * ============================================================================ */
export interface EvaluationSpec {
  functionalTests: TestCase[];
  adversarialTests: TestCase[];
  regressionTests: TestCase[];
  redTeamRuns: RedTeamRun[];
  executionStatus: ExecutionStatus;
}

export interface TestCase {
  id: string;
  suiteId: string;
  type: "functional" | "edge" | "adversarial" | "injection" | "regression" | "red_team";
  objective: string;
  input: unknown;
  expectedBehavior: string;
  actualResult?: string;
  status: "not_run" | "passed" | "failed" | "blocked" | "not_executed";
  evidence?: string[];
  executedBy?: string;
  executedAt?: string;
}

export interface RedTeamRun {
  id: string;
  scenario: string;
  attack: string;
  detectionStatus: "detected" | "not_detected" | "not_executed";
  diagnosis?: string;
  executedAt?: string;
}

/* ============================================================================
 * MODEL REQUIREMENTS
 * ============================================================================ */
export interface ModelRequirements {
  provider?: string;
  model?: string;
  capabilities?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
}

/* ============================================================================
 * METADATA
 * ============================================================================ */
export interface PromptMetadata {
  assetId: string;
  version: string;
  parentVersion?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  lifecycleState: LifecycleState;
  tags?: string[];
  domain?: string;
  category?: string;
  changeSummary?: string;
}

/* ============================================================================
 * THE PROMPT SPECIFICATION (IR)
 * ============================================================================ */
export interface PromptSpecification {
  // Core
  intent: string;
  objective: string;
  domain?: string;
  taskType: TaskType;
  
  // Role
  role?: PersonaSpec;
  
  // Context
  context: ContextSpec;
  
  // Inputs
  inputs: InputSpec[];
  
  // Constraints
  constraints: ConstraintSpec[];
  
  // Reasoning
  reasoningApproach?: ReasoningSpec;
  
  // Grounding & Evidence
  grounding?: GroundingSpec;
  evidencePolicy?: EvidencePolicy;
  
  // Output
  output: OutputSpec;
  
  // Quality
  qualityCriteria: QualityCriterion[];
  
  // Examples
  examples?: ExampleSpec[];
  
  // Failure Handling
  failureHandling: FailureHandlingSpec;
  
  // Security
  security: SecuritySpec;
  
  // Tools
  tools?: ToolPolicy;
  
  // RAG
  rag?: RAGConfig;
  
  // Workflow
  workflow?: WorkflowSpec;
  
  // Evaluation
  evaluation: EvaluationSpec;
  
  // Model
  modelRequirements?: ModelRequirements;
  
  // Metadata
  metadata: PromptMetadata;
}

/* ============================================================================
 * COMPONENT DECISION
 * ============================================================================ */
export interface PromptComponentDecision {
  component: string;
  status: ComponentStatus;
  reason: string;
  evidence?: import("./specification").EvidenceScore;  // Evidence-backed confidence
  dependencies?: string[];
  source: "task_analysis" | "risk_policy" | "user_selection" | "dependency_rule" | "system_safeguard";
  trace?: {
    ruleId?: string;
    policyId?: string;
    overriddenByUser?: boolean;
    overriddenAt?: number;
  };
}

/* ============================================================================
 * INTENT ANALYSIS
 * ============================================================================ */
export interface IntentAnalysis {
  originalInput: string;
  normalizedIntent: string;
  taskType: TaskType;
  domain?: string;
  objective: string;
  audience?: string;
  riskLevel: RiskLevel;
  complexity: "simple" | "moderate" | "complex";
  detectedLanguage: "ar" | "en" | "mixed";
  ambiguityFlags: string[];
  suggestedCommands: string[];
  suggestedPersona?: PersonaSpec;
  requiredComponents: string[];
  recommendedComponents: string[];
  executionStatus: ExecutionStatus;
}

/* ============================================================================
 * VALIDATION
 * ============================================================================ */
export type ValidationSeverity = "info" | "low" | "medium" | "high" | "critical";
export type ValidationCategory = "structural" | "semantic" | "security" | "operational";

export interface ValidationFinding {
  id: string;
  status: "pass" | "warning" | "fail";
  severity: ValidationSeverity;
  category: ValidationCategory;
  message: string;
  affectedComponent?: string;
  suggestedCorrection?: string;
}

/* ============================================================================
 * READINESS
 * ============================================================================ */
export interface ScoreDimension {
  name: string;
  value?: number;
  status: "measured" | "inferred" | "partial" | "not_tested";
  evidence: string[];
}

export interface ReadinessAssessment {
  overallState: ReadinessState;
  dimensions: ScoreDimension[];
  releaseGate: "blocked" | "ready" | "needs_review";
  blockingReasons?: string[];
  assessedAt: string;
}

/* ============================================================================
 * COMPILED PROMPT
 * ============================================================================ */
export interface CompiledPrompt {
  specificationId: string;
  version: string;
  model: string;
  provider: string;
  promptText: string;
  systemPrompt?: string;
  compiledAt: string;
  metadata: {
    inputTokens?: number;
    estimatedOutputTokens?: number;
    contextTokens?: number;
    compilationTime?: number;
  };
}

/* ============================================================================
 * PROMPT ASSET (REGISTRY)
 * ============================================================================ */
export interface PromptAsset {
  id: string;
  name: string;
  description?: string;
  owner: string;
  domain?: string;
  category?: string;
  tags?: string[];
  currentVersion: string;
  lifecycleState: LifecycleState;
  createdAt: string;
  updatedAt: string;
  versions: PromptVersion[];
  auditTrail: AuditEvent[];
}

export interface PromptVersion {
  version: string;
  specification: PromptSpecification;
  compiledPrompt?: CompiledPrompt;
  changeSummary?: string;
  author: string;
  createdAt: string;
  readiness?: ReadinessAssessment;
  lifecycleState: LifecycleState;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: "create" | "update" | "delete" | "publish" | "deprecate" | "approve" | "reject";
  entityType: "prompt_asset" | "prompt_version" | "evaluation" | "release";
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/* ============================================================================
 * BILINGUAL HELPER
 * ============================================================================ */
export type Bi = { ar: string; en: string };
