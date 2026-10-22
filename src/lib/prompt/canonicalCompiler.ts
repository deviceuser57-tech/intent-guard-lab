/* ============================================================================
 * PROMPT COMPILER
 * ============================================================================
 * Converts a PromptSpecification into a CompiledPrompt for a specific model.
 * 
 * The compiler:
 * - Selects sections based on component decisions
 * - Resolves dependencies
 * - Applies security safeguards
 * - Packages context
 * - Adapts to model-specific requirements
 * 
 * Key principle: The compiled prompt is an ARTIFACT, not the source of truth.
 * ============================================================================ */

import type {
  PromptSpecification,
  CompiledPrompt,
  PromptComponentDecision,
  Bi,
} from "./specification";

/* ============================================================================
 * SECTION BUILDERS
 * ============================================================================ */

function buildRoleSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (!spec.role) return "";
  
  const name = locale === "ar" ? spec.role.name.ar : spec.role.name.en;
  const desc = locale === "ar" ? spec.role.description.ar : spec.role.description.en;
  
  return `# Role\nYou are ${name}. ${desc}\n`;
}

function buildObjectiveSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  const objective = spec.objective;
  return `# Objective\n${objective}\n`;
}

function buildContextSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (spec.context.actuallyUsed.length === 0) return "";
  
  const lines = ["# Context"];
  for (const ctx of spec.context.actuallyUsed) {
    lines.push(`- ${ctx.name} (${ctx.type})`);
  }
  return lines.join("\n") + "\n";
}

function buildConstraintsSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (spec.constraints.length === 0) return "";
  
  const lines = ["# Constraints"];
  for (const c of spec.constraints) {
    if (c.enforced) {
      lines.push(`- ${c.description}`);
    }
  }
  return lines.join("\n") + "\n";
}

function buildGroundingSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (!spec.grounding) return "";
  
  const lines = ["# Grounding & Evidence"];
  
  if (spec.grounding.required) {
    lines.push("All factual claims must be grounded in evidence.");
  }
  
  if (spec.grounding.citationRequired) {
    lines.push("Citations are required for all claims.");
  }
  
  if (spec.grounding.sourcePolicy === "cited_sources_only") {
    lines.push("Use only cited sources. Do not rely on internal knowledge for facts.");
  }
  
  lines.push(`Missing evidence handling: ${spec.grounding.missingEvidenceHandling}`);
  
  return lines.join("\n") + "\n";
}

function buildEvidencePolicySection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (!spec.evidencePolicy) return "";
  
  const lines = ["# Evidence Policy"];
  lines.push(`Evidence levels: ${spec.evidencePolicy.levels.join(", ")}`);
  lines.push(`Minimum level: ${spec.evidencePolicy.minimumLevel}`);
  lines.push(`Citation required: ${spec.evidencePolicy.requireCitation ? "yes" : "no"}`);
  
  return lines.join("\n") + "\n";
}

function buildOutputSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  const lines = ["# Output Specification"];
  lines.push(`Format: ${spec.output.format}`);
  
  if (spec.output.language) {
    lines.push(`Language: ${spec.output.language}`);
  }
  
  if (spec.output.length) {
    const { min, max, unit } = spec.output.length;
    if (min && max) {
      lines.push(`Length: ${min}-${max} ${unit}`);
    } else if (max) {
      lines.push(`Max length: ${max} ${unit}`);
    }
  }
  
  if (spec.output.validationRules && spec.output.validationRules.length > 0) {
    lines.push("Validation rules:");
    for (const rule of spec.output.validationRules) {
      lines.push(`- ${rule}`);
    }
  }
  
  return lines.join("\n") + "\n";
}

function buildReasoningSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (!spec.reasoningApproach) return "";
  if (spec.reasoningApproach.approach === "none") return "";
  
  const lines = ["# Reasoning"];
  
  if (spec.reasoningApproach.approach === "concise") {
    lines.push("Provide concise, decision-relevant reasoning.");
  } else if (spec.reasoningApproach.approach === "step_by_step") {
    lines.push("Break down your reasoning into clear steps.");
  }
  
  if (!spec.reasoningApproach.exposeReasoning) {
    lines.push("Do not expose private chain-of-thought.");
  }
  
  return lines.join("\n") + "\n";
}

function buildFailureHandlingSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  const lines = ["# Failure Handling"];
  
  lines.push(`On missing input: ${spec.failureHandling.onMissingInput}`);
  lines.push(`On ambiguity: ${spec.failureHandling.onAmbiguity}`);
  lines.push(`On security violation: ${spec.failureHandling.onSecurityViolation}`);
  
  if (spec.failureHandling.maxRetries) {
    lines.push(`Max retries: ${spec.failureHandling.maxRetries}`);
  }
  
  return lines.join("\n") + "\n";
}

function buildSecuritySection(spec: PromptSpecification, locale: "ar" | "en"): string {
  const lines = ["# Security"];
  
  lines.push(`Injection protection: ${spec.security.injectionProtection ? "enabled" : "disabled"}`);
  lines.push(`Data leakage protection: ${spec.security.dataLeakageProtection ? "enabled" : "disabled"}`);
  lines.push(`Sensitive data policy: ${spec.security.sensitiveDataPolicy}`);
  
  if (spec.security.toolPolicy) {
    lines.push("\n## Tool Policy");
    lines.push(`Enabled: ${spec.security.toolPolicy.enabled}`);
    lines.push(`Allowed tools: ${spec.security.toolPolicy.allowedTools.join(", ")}`);
    lines.push(`Max calls per run: ${spec.security.toolPolicy.maxCallsPerRun}`);
  }
  
  return lines.join("\n") + "\n";
}

function buildWorkflowSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (!spec.workflow || spec.workflow.steps.length === 0) return "";
  
  const lines = ["# Workflow"];
  for (const step of spec.workflow.steps) {
    lines.push(`${step.id}. ${step.name}`);
    if (step.description) {
      lines.push(`   ${step.description}`);
    }
  }
  
  return lines.join("\n") + "\n";
}

function buildQualitySection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (spec.qualityCriteria.length === 0) return "";
  
  const lines = ["# Quality Criteria"];
  for (const q of spec.qualityCriteria) {
    lines.push(`- ${q.name}: ${q.description} (weight: ${q.weight})`);
  }
  
  return lines.join("\n") + "\n";
}

function buildExamplesSection(spec: PromptSpecification, locale: "ar" | "en"): string {
  if (!spec.examples || spec.examples.length === 0) return "";
  
  const lines = ["# Examples"];
  for (const ex of spec.examples) {
    lines.push(`## Example ${ex.id}`);
    if (ex.description) {
      lines.push(ex.description);
    }
    lines.push(`Input: ${JSON.stringify(ex.input)}`);
    lines.push(`Output: ${JSON.stringify(ex.output)}`);
    lines.push("");
  }
  
  return lines.join("\n");
}

/* ============================================================================
 * MAIN COMPILER
 * ============================================================================ */

export function compilePrompt(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[],
  model: string,
  provider: string,
  locale: "ar" | "en" = "en"
): CompiledPrompt {
  const sections: string[] = [];
  
  // Build sections based on decisions
  for (const decision of decisions) {
    if (decision.status === "not_applicable") continue;
    if (decision.status === "optional" && !spec[decision.component as keyof PromptSpecification]) continue;
    
    switch (decision.component) {
      case "role":
        sections.push(buildRoleSection(spec, locale));
        break;
      case "objective":
        sections.push(buildObjectiveSection(spec, locale));
        break;
      case "context":
        sections.push(buildContextSection(spec, locale));
        break;
      case "constraints":
        sections.push(buildConstraintsSection(spec, locale));
        break;
      case "grounding":
        sections.push(buildGroundingSection(spec, locale));
        break;
      case "evidencePolicy":
        sections.push(buildEvidencePolicySection(spec, locale));
        break;
      case "output":
        sections.push(buildOutputSection(spec, locale));
        break;
      case "reasoningApproach":
        sections.push(buildReasoningSection(spec, locale));
        break;
      case "failureHandling":
        sections.push(buildFailureHandlingSection(spec, locale));
        break;
      case "security":
        sections.push(buildSecuritySection(spec, locale));
        break;
      case "workflow":
        sections.push(buildWorkflowSection(spec, locale));
        break;
      case "qualityCriteria":
        sections.push(buildQualitySection(spec, locale));
        break;
      case "examples":
        sections.push(buildExamplesSection(spec, locale));
        break;
    }
  }
  
  // Always add intent as system context
  const systemPrompt = `# Intent\n${spec.intent}\n`;
  
  const promptText = sections.join("\n");
  
  // Estimate tokens (very rough: 1 token ≈ 4 characters)
  const inputTokens = Math.ceil(promptText.length / 4);
  const estimatedOutputTokens = spec.output.length?.max 
    ? spec.output.length.unit === "tokens" 
      ? spec.output.length.max 
      : Math.ceil(spec.output.length.max * 1.3)
    : 1000;
  
  return {
    specificationId: spec.metadata.assetId,
    version: spec.metadata.version,
    model,
    provider,
    promptText,
    systemPrompt,
    compiledAt: new Date().toISOString(),
    metadata: {
      inputTokens,
      estimatedOutputTokens,
      contextTokens: spec.context.actuallyUsed.length > 0 ? Math.ceil(spec.context.actuallyUsed.reduce((sum, c) => sum + (c.contentRef?.length || 0), 0) / 4) : 0,
      compilationTime: 0, // Would be measured in real implementation
    },
  };
}

/* ============================================================================
 * MODEL ADAPTERS
 * ============================================================================ */

export interface ModelAdapter {
  id: string;
  provider: string;
  model: string;
  capabilities: string[];
  compile: (spec: PromptSpecification, decisions: PromptComponentDecision[]) => CompiledPrompt;
}

export const MODEL_ADAPTERS: ModelAdapter[] = [
  {
    id: "gpt4",
    provider: "openai",
    model: "gpt-4",
    capabilities: ["text", "code", "reasoning", "vision"],
    compile: (spec, decisions) => compilePrompt(spec, decisions, "gpt-4", "openai"),
  },
  {
    id: "claude",
    provider: "anthropic",
    model: "claude-3-opus",
    capabilities: ["text", "code", "reasoning", "vision"],
    compile: (spec, decisions) => compilePrompt(spec, decisions, "claude-3-opus", "anthropic"),
  },
  {
    id: "gemini",
    provider: "google",
    model: "gemini-pro",
    capabilities: ["text", "code", "reasoning", "vision"],
    compile: (spec, decisions) => compilePrompt(spec, decisions, "gemini-pro", "google"),
  },
];

export function getModelAdapter(modelId: string): ModelAdapter | undefined {
  return MODEL_ADAPTERS.find((a) => a.id === modelId);
}


/**
 * Compile the canonical Prompt IR into the Workbench's established prompt
 * envelope. The IR remains the source of truth; the legacy compiler is no
 * longer used to generate the active compiled artifact.
 */
import type { PromptIRResult } from "./ir";
import type { CompiledPrompt as WorkbenchCompiledPrompt } from "./types";

export function compilePromptIR(
  result: PromptIRResult,
  model: string,
  provider: string,
  locale: "ar" | "en" = "en",
): WorkbenchCompiledPrompt {
  const compiled = compilePrompt(result.specification, result.decisions, model, provider, locale);
  const spec = result.specification;
  const outputContract = [
    `Format: ${spec.output.format}`,
    `Language: ${spec.output.language}`,
    ...(spec.output.length?.max ? [`Maximum length: ${spec.output.length.max} ${spec.output.length.unit}`] : []),
    ...(spec.output.validationRules ?? []),
    ...(spec.outputSchema ? [`Output schema: ${spec.outputSchema}`] : []),
  ].join("\n");
  return {
    system: [compiled.systemPrompt, compiled.promptText].filter(Boolean).join("\n\n"),
    user: `# Task\n${spec.intent}\n\n# User input\n{{user_request}}`,
    outputContract,
    variables: ["user_request", ...spec.inputs.filter((input) => input.required).map((input) => input.id).filter((id) => id !== "user-request")],
  };
}
