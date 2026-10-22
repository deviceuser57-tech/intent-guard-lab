export interface WebhookTargetValidation { valid: boolean; reason?: string; url?: URL }
export declare function validateWebhookTarget(input: string): WebhookTargetValidation;
