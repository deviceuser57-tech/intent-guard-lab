/* ============================================================================
 * PROMPT LINTER / VALIDATOR
 * ============================================================================
 * Validates a PromptSpecification for structural, semantic, security, and
 * operational issues.
 * 
 * Key principle: NEVER fabricate validation results. If a check cannot be
 * performed, report it as "not_executed" with clear evidence.
 * ============================================================================ */

import type {
  PromptSpecification,
  ValidationFinding,
  PromptComponentDecision,
} from "./specification";

let findingCounter = 0;
function makeFinding(
  status: ValidationFinding["status"],
  severity: ValidationFinding["severity"],
  category: ValidationFinding["category"],
  message: string,
  affectedComponent?: string,
  suggestedCorrection?: string
): ValidationFinding {
  return {
    id: `finding-${++findingCounter}`,
    status,
    severity,
    category,
    message,
    affectedComponent,
    suggestedCorrection,
  };
}

/* ============================================================================
 * STRUCTURAL VALIDATION
 * ============================================================================ */

function validateStructural(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  
  // Check required fields
  if (!spec.intent || spec.intent.trim().length === 0) {
    findings.push(makeFinding("fail", "critical", "structural", "Intent is empty or missing", "intent", "Provide a clear description of what the prompt should accomplish"));
  }
  
  if (!spec.objective || spec.objective.trim().length === 0) {
    findings.push(makeFinding("fail", "critical", "structural", "Objective is empty or missing", "objective", "Define a clear, measurable objective"));
  }
  
  if (!spec.output || !spec.output.format) {
    findings.push(makeFinding("fail", "critical", "structural", "Output format is not specified", "output", "Specify the expected output format (markdown, json, image, etc.)"));
  }
  
  // Check required components are present
  for (const decision of decisions) {
    if (decision.status === "required") {
      const value = spec[decision.component as keyof PromptSpecification];
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        findings.push(makeFinding(
          "fail",
          "high",
          "structural",
          `Required component "${decision.component}" is missing`,
          decision.component,
          decision.reason
        ));
      }
    }
  }
  
  // Check metadata
  if (!spec.metadata || !spec.metadata.assetId) {
    findings.push(makeFinding("fail", "high", "structural", "Missing asset metadata", "metadata", "Provide asset ID, version, and author"));
  }
  
  if (!spec.metadata.version) {
    findings.push(makeFinding("warning", "medium", "structural", "Missing version in metadata", "metadata.version", "Use semantic versioning (e.g., 1.0.0)"));
  }
  
  // Check for unresolved dependencies
  for (const decision of decisions) {
    if (decision.dependencies) {
      for (const dep of decision.dependencies) {
        const depDecision = decisions.find((d) => d.component === dep);
        if (!depDecision || depDecision.status === "not_applicable") {
          findings.push(makeFinding(
            "warning",
            "medium",
            "structural",
            `Component "${decision.component}" depends on "${dep}" which is not available`,
            decision.component,
            `Enable "${dep}" or remove dependency`
          ));
        }
      }
    }
  }
  
  return findings;
}

/* ============================================================================
 * SEMANTIC VALIDATION
 * ============================================================================ */

function validateSemantic(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  
  // Check task/objective alignment
  if (spec.taskType === "research" && !spec.grounding) {
    findings.push(makeFinding(
      "warning",
      "medium",
      "semantic",
      "Research task without grounding specification",
      "grounding",
      "Add grounding specification for research tasks"
    ));
  }
  
  // Check for contradictory constraints
  const formatConstraints = spec.constraints.filter((c) => c.type === "format");
  if (formatConstraints.length > 1) {
    findings.push(makeFinding(
      "warning",
      "medium",
      "semantic",
      "Multiple format constraints detected — potential conflict",
      "constraints",
      "Review format constraints for consistency"
    ));
  }
  
  // Check output language vs detected language
  if (spec.output.language && spec.metadata.tags) {
    // Simple check: if output language doesn't match tags
    const hasArTag = spec.metadata.tags.some((t) => t.includes("ar"));
    const hasEnTag = spec.metadata.tags.some((t) => t.includes("en"));
    if (hasArTag && spec.output.language === "en") {
      findings.push(makeFinding(
        "pass",
        "low",
        "semantic",
        "Output language (English) differs from detected input language (Arabic)",
        "output.language",
        "Verify this is intentional"
      ));
    }
  }
  
  // Check context relevance
  if (spec.context.selected.length > 0 && spec.context.actuallyUsed.length === 0) {
    findings.push(makeFinding(
      "warning",
      "low",
      "semantic",
      "Context sources selected but none actually used",
      "context",
      "Review context selection or enable usage"
    ));
  }
  
  return findings;
}

/* ============================================================================
 * SECURITY VALIDATION
 * ============================================================================ */

function validateSecurity(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  
  // Check for untrusted context without separation
  const untrustedContext = spec.context.available.filter((c) => c.trustLevel === "untrusted");
  if (untrustedContext.length > 0) {
    const usedUntrusted = untrustedContext.filter((c) => c.actuallyUsed);
    if (usedUntrusted.length > 0 && !spec.security.injectionProtection) {
      findings.push(makeFinding(
        "fail",
        "critical",
        "security",
        "Untrusted context is used without injection protection",
        "security.injectionProtection",
        "Enable injection protection or remove untrusted context"
      ));
    }
  }
  
  // Check for sensitive data policy
  if (spec.security.sensitiveDataPolicy === "allow") {
    findings.push(makeFinding(
      "warning",
      "high",
      "security",
      "Sensitive data policy is set to 'allow' — review for data leakage risk",
      "security.sensitiveDataPolicy",
      "Consider 'redact' or 'warn' policy"
    ));
  }
  
  // Check tool policy
  if (spec.security.toolPolicy?.enabled) {
    if (spec.security.toolPolicy.allowedTools.includes("*")) {
      findings.push(makeFinding(
        "fail",
        "critical",
        "security",
        "Tool policy allows all tools — violates least privilege",
        "security.toolPolicy.allowedTools",
        "Specify explicit allowed tools"
      ));
    }
    
    if (spec.security.toolPolicy.maxCallsPerRun > 100) {
      findings.push(makeFinding(
        "warning",
        "medium",
        "security",
        "High max tool calls per run — potential for abuse",
        "security.toolPolicy.maxCallsPerRun",
        "Consider reducing to a reasonable limit"
      ));
    }
  }
  
  // Check for reasoning exposure
  if (spec.reasoningApproach?.exposeReasoning) {
    findings.push(makeFinding(
      "warning",
      "high",
      "security",
      "Reasoning approach exposes chain-of-thought — security risk",
      "reasoningApproach.exposeReasoning",
      "Set to false for production use"
    ));
  }
  
  return findings;
}

/* ============================================================================
 * OPERATIONAL VALIDATION
 * ============================================================================ */

function validateOperational(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[]
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  
  // Check context size
  const totalContextSize = spec.context.actuallyUsed.reduce((sum, c) => sum + (c.contentRef?.length || 0), 0);
  if (totalContextSize > 100000) {
    findings.push(makeFinding(
      "warning",
      "medium",
      "operational",
      `Context size is very large (${totalContextSize} chars) — may exceed model limits`,
      "context",
      "Consider context compression or selective usage"
    ));
  }
  
  // Check output length feasibility
  if (spec.output.length?.max && spec.output.length.unit === "tokens") {
    if (spec.output.length.max > 100000) {
      findings.push(makeFinding(
        "warning",
        "medium",
        "operational",
        `Output length (${spec.output.length.max} tokens) may exceed model limits`,
        "output.length",
        "Verify model supports this output length"
      ));
    }
  }
  
  // Check for missing model requirements
  if (!spec.modelRequirements || !spec.modelRequirements.model) {
    findings.push(makeFinding(
      "pass",
      "low",
      "operational",
      "No specific model requirements — will use default adapter",
      "modelRequirements",
      "Specify model if you have specific needs"
    ));
  }
  
  // Check evaluation status
  if (spec.evaluation.executionStatus === "not_executed") {
    findings.push(makeFinding(
      "pass",
      "low",
      "operational",
      "Evaluation has not been executed — readiness cannot be fully assessed",
      "evaluation",
      "Run evaluation before release"
    ));
  }
  
  return findings;
}

/* ============================================================================
 * MAIN LINTER
 * ============================================================================ */

export function lintPrompt(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[]
): ValidationFinding[] {
  findingCounter = 0;
  
  const findings: ValidationFinding[] = [
    ...validateStructural(spec, decisions),
    ...validateSemantic(spec, decisions),
    ...validateSecurity(spec, decisions),
    ...validateOperational(spec, decisions),
  ];
  
  return findings;
}

export function getLintSummary(findings: ValidationFinding[]): {
  pass: number;
  warning: number;
  fail: number;
  criticalCount: number;
} {
  return {
    pass: findings.filter((f) => f.status === "pass").length,
    warning: findings.filter((f) => f.status === "warning").length,
    fail: findings.filter((f) => f.status === "fail").length,
    criticalCount: findings.filter((f) => f.severity === "critical").length,
  };
}
