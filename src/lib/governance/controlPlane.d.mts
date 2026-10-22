export type GovernanceRole = "owner" | "admin" | "reviewer" | "contributor" | "viewer";
export type LearningDecision = "approve" | "reject";
export interface CognitiveProfileInput {
  id: string; version: number; name: string; principles: string[]; limitations: string[]; createdAt?: string;
}
export interface CognitiveProfile extends Omit<CognitiveProfileInput, "principles" | "limitations"> {
  principles: readonly string[]; limitations: readonly string[]; securityPolicy: string;
}
export interface LearningCandidateInput {
  id: string; feedback: string; createdBy: string; currentVersion: number; evidence?: string[];
}
export interface LearningCandidate {
  id: string; feedback: string; evidence: readonly string[]; createdBy: string; baseVersion: number;
  status: "pending_review" | "approved" | "rejected"; proposedAt: string; approvedVersion: number | null; reviewedBy: string | null;
}
export interface RetrievedDocument {
  id: string; tenantId: string; status: string; source: string; allowedRoles: string[];
  content: string; score?: number;
}
export interface RetrievedContext {
  tenantId: string; roles: string[]; allowedSources?: string[]; limit?: number;
}
export interface OrchestrationStepInput { id: string; specialist: string; objective: string; dependsOn?: string[] }
export interface OrchestrationPlanInput { id: string; task: string; risk: "low" | "medium" | "high" | "critical"; steps: OrchestrationStepInput[]; toolsAllowed?: string[] }
export function createCognitiveProfile(input: CognitiveProfileInput): Readonly<CognitiveProfile>;
export function proposeLearningCandidate(input: LearningCandidateInput): Readonly<LearningCandidate>;
export function reviewLearningCandidate(candidate: LearningCandidate, reviewerId: string, decision: LearningDecision): Readonly<LearningCandidate>;
export function filterRetrievedDocuments(documents: RetrievedDocument[], context: RetrievedContext): ReadonlyArray<{
  id: string; source: string; content: string; score: number; trust: "untrusted_reference_data"; handling: string;
}>;
export function createOrchestrationPlan(input: OrchestrationPlanInput): Readonly<{
  id: string; task: string; risk: OrchestrationPlanInput["risk"]; status: "planned" | "awaiting_human_approval";
  requiresHumanApproval: boolean; steps: ReadonlyArray<OrchestrationStepInput & { status: "planned" }>; toolsAllowed: readonly string[];
}>;
export function authorizeAction(input: {
  actor?: { id?: string; role?: string }; tenantId?: string; resourceTenantId?: string; permission?: string;
}): { allowed: boolean; reason: "invalid_request" | "missing_actor" | "tenant_boundary" | "unknown_role" | "permission_denied" | "authorized" };
