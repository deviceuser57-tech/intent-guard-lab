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

export function retrieveKnowledge(query: string, documents: RetrievedDocument[], context: RetrievedContext): ReadonlyArray<{
  id: string; source: string; content: string; score: number; trust: "untrusted_reference_data"; handling: string; relevance: number;
}>;
export function authorizeOrchestrationStart(plan: { requiresHumanApproval: boolean }, approverId?: string): {
  allowed: boolean; reason: "invalid_plan" | "approval_not_required" | "human_approval_required" | "human_approved"; approvedBy?: string;
};
export function canRunOrchestrationStep(plan: { steps: Array<{ id: string; dependsOn: string[] }> }, stepId: string, completedStepIds?: string[]): {
  allowed: boolean; reason: "unknown_step" | "dependencies_incomplete" | "dependencies_satisfied"; missingDependencies?: string[];
};

export interface CognitiveProfileDiff {
  profileId: string; fromVersion: number; toVersion: number; nameChanged: boolean;
  principles: { added: readonly string[]; removed: readonly string[] };
  limitations: { added: readonly string[]; removed: readonly string[] };
}
export declare function diffCognitiveProfiles(previous: CognitiveProfile, next: CognitiveProfile): Readonly<CognitiveProfileDiff>;
export declare function rollbackCognitiveProfile(history: CognitiveProfile[], targetVersion: number, actorId: string): Readonly<CognitiveProfile & {
  rollback: { restoredContentFromVersion: number; supersedesVersion: number; actorId: string };
}>;
