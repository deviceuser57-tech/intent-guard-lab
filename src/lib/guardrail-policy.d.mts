export type Policy = { id: string; name: string; mode: "natural" | "json"; content: string; enabled: boolean };
export function csvCell(value: string): string;
export function validatePolicy(policy: unknown): policy is Policy;
export function validatePolicyContent(mode: "natural" | "json", content: string): string | null;
export function scoreOutput(value: string, policyText: string): { score: number; matched: string[]; verdict: string };

export declare function normalizeImportedPolicies(entries: unknown[]): ReadonlyArray<Policy>;
