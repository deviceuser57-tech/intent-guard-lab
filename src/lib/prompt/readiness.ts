/* ============================================================================
 * READINESS ENGINE
 * ============================================================================
 * Assesses the readiness of a PromptSpecification for release.
 * 
 * Key principle: NEVER fabricate readiness scores. Every dimension must
 * clearly state whether it's measured, inferred, partial, or not_tested.
 * 
 * The readiness assessment is evidence-backed, not a probability.
 * ============================================================================ */

import type {
  PromptSpecification,
  ReadinessAssessment,
  ReadinessState,
  ScoreDimension,
  ValidationFinding,
  PromptComponentDecision,
} from "./specification";
import { lintPrompt, getLintSummary } from "./linter";

/* ============================================================================
 * DIMENSION ASSESSORS
 * ============================================================================ */

function assessClarity(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  let value = 50; // baseline
  
  // Check intent clarity
  if (spec.intent && spec.intent.length > 20) {
    value += 15;
    evidence.push("Intent is sufficiently detailed");
  } else {
    evidence.push("Intent is too short or missing");
  }
  
  // Check objective clarity
  if (spec.objective && spec.objective.length > 30) {
    value += 15;
    evidence.push("Objective is sufficiently detailed");
  } else {
    evidence.push("Objective is too short or missing");
  }
  
  // Check for ambiguity flags
  if (spec.intent.includes("?") || spec.intent.includes("؟")) {
    value -= 10;
    evidence.push("Intent contains question marks — may indicate ambiguity");
  }
  
  return {
    name: "Clarity",
    value: Math.min(100, Math.max(0, value)),
    status: "measured",
    evidence,
  };
}

function assessTaskAlignment(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  let value = 60; // baseline
  
  // Check if task type is specified
  if (spec.taskType && spec.taskType !== "other") {
    value += 20;
    evidence.push(`Task type is specified: ${spec.taskType}`);
  } else {
    evidence.push("Task type is not specified or is 'other'");
  }
  
  // Check if domain is specified
  if (spec.domain) {
    value += 10;
    evidence.push(`Domain is specified: ${spec.domain}`);
  } else {
    evidence.push("Domain is not specified");
  }
  
  // Check if role matches task type
  if (spec.role && spec.role.domain) {
    if (spec.role.domain === spec.domain || spec.role.domain === spec.taskType) {
      value += 10;
      evidence.push("Role domain aligns with task");
    } else {
      value -= 10;
      evidence.push("Role domain may not align with task");
    }
  }
  
  return {
    name: "Task Alignment",
    value: Math.min(100, Math.max(0, value)),
    status: "measured",
    evidence,
  };
}

function assessConstraintCoverage(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  let value = 40; // baseline
  
  const constraintCount = spec.constraints.length;
  
  if (constraintCount === 0) {
    evidence.push("No constraints specified");
  } else if (constraintCount < 3) {
    value += 20;
    evidence.push(`${constraintCount} constraints specified`);
  } else {
    value += 40;
    evidence.push(`${constraintCount} constraints specified — good coverage`);
  }
  
  // Check if constraints are enforced
  const enforcedCount = spec.constraints.filter((c) => c.enforced).length;
  if (enforcedCount > 0) {
    value += 20;
    evidence.push(`${enforcedCount} constraints are enforced`);
  }
  
  return {
    name: "Constraint Coverage",
    value: Math.min(100, Math.max(0, value)),
    status: "measured",
    evidence,
  };
}

function assessOutputCompliance(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  let value = 50; // baseline
  
  // Check output format
  if (spec.output.format) {
    value += 20;
    evidence.push(`Output format specified: ${spec.output.format}`);
  } else {
    evidence.push("Output format not specified");
  }
  
  // Check output length
  if (spec.output.length) {
    value += 15;
    evidence.push("Output length constraints specified");
  } else {
    evidence.push("No output length constraints");
  }
  
  // Check validation rules
  if (spec.output.validationRules && spec.output.validationRules.length > 0) {
    value += 15;
    evidence.push(`${spec.output.validationRules.length} validation rules specified`);
  } else {
    evidence.push("No validation rules specified");
  }
  
  return {
    name: "Output Compliance",
    value: Math.min(100, Math.max(0, value)),
    status: "measured",
    evidence,
  };
}

function assessSecurity(spec: PromptSpecification, findings: ValidationFinding[]): ScoreDimension {
  const evidence: string[] = [];
  let value = 60; // baseline
  
  const securityFindings = findings.filter((f) => f.category === "security");
  const criticalSecurity = securityFindings.filter((f) => f.severity === "critical");
  const highSecurity = securityFindings.filter((f) => f.severity === "high");
  
  if (criticalSecurity.length > 0) {
    value -= 40;
    evidence.push(`${criticalSecurity.length} critical security issues found`);
  }
  
  if (highSecurity.length > 0) {
    value -= 20;
    evidence.push(`${highSecurity.length} high-severity security issues found`);
  }
  
  if (spec.security.injectionProtection) {
    value += 20;
    evidence.push("Injection protection enabled");
  }
  
  if (spec.security.dataLeakageProtection) {
    value += 10;
    evidence.push("Data leakage protection enabled");
  }
  
  return {
    name: "Security",
    value: Math.min(100, Math.max(0, value)),
    status: "measured",
    evidence,
  };
}

function assessFunctionalTests(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  
  const testCount = spec.evaluation.functionalTests.length;
  const passedCount = spec.evaluation.functionalTests.filter((t) => t.status === "passed").length;
  
  if (testCount === 0) {
    return {
      name: "Functional Tests",
      status: "not_tested",
      evidence: ["No functional tests defined"],
    };
  }
  
  const value = testCount > 0 ? (passedCount / testCount) * 100 : 0;
  
  evidence.push(`${passedCount}/${testCount} functional tests passed`);
  
  if (spec.evaluation.executionStatus === "not_executed") {
    return {
      name: "Functional Tests",
      value,
      status: "not_tested",
      evidence: [...evidence, "Tests defined but not executed"],
    };
  }
  
  return {
    name: "Functional Tests",
    value,
    status: "measured",
    evidence,
  };
}

function assessRedTeam(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  
  const redTeamRuns = spec.evaluation.redTeamRuns;
  
  if (redTeamRuns.length === 0) {
    return {
      name: "Red Team",
      status: "not_tested",
      evidence: ["No red team tests defined"],
    };
  }
  
  const detectedCount = redTeamRuns.filter((r) => r.detectionStatus === "detected").length;
  const value = (detectedCount / redTeamRuns.length) * 100;
  
  evidence.push(`${detectedCount}/${redTeamRuns.length} attacks detected`);
  
  // Check if actually executed
  const executedRuns = redTeamRuns.filter((r) => r.executedAt);
  if (executedRuns.length === 0) {
    return {
      name: "Red Team",
      value,
      status: "not_tested",
      evidence: [...evidence, "Red team tests defined but not executed"],
    };
  }
  
  return {
    name: "Red Team",
    value,
    status: "measured",
    evidence,
  };
}

function assessRegression(spec: PromptSpecification): ScoreDimension {
  const evidence: string[] = [];
  
  const regressionTests = spec.evaluation.regressionTests;
  
  if (regressionTests.length === 0) {
    return {
      name: "Regression",
      status: "not_tested",
      evidence: ["No regression tests defined"],
    };
  }
  
  const passedCount = regressionTests.filter((t) => t.status === "passed").length;
  const value = (passedCount / regressionTests.length) * 100;
  
  evidence.push(`${passedCount}/${regressionTests.length} regression tests passed`);
  
  return {
    name: "Regression",
    value,
    status: regressionTests.some((t) => t.executedAt) ? "measured" : "not_tested",
    evidence,
  };
}

/* ============================================================================
 * MAIN READINESS ASSESSMENT
 * ============================================================================ */

export function assessReadiness(
  spec: PromptSpecification,
  decisions: PromptComponentDecision[]
): ReadinessAssessment {
  const findings = lintPrompt(spec, decisions);
  
  const dimensions: ScoreDimension[] = [
    assessClarity(spec),
    assessTaskAlignment(spec),
    assessConstraintCoverage(spec),
    assessOutputCompliance(spec),
    assessSecurity(spec, findings),
    assessFunctionalTests(spec),
    assessRedTeam(spec),
    assessRegression(spec),
  ];
  
  // Calculate overall state
  const lintSummary = getLintSummary(findings);
  
  let overallState: ReadinessState;
  let releaseGate: "blocked" | "ready" | "needs_review";
  const blockingReasons: string[] = [];
  
  // Check for critical failures
  if (lintSummary.criticalCount > 0) {
    overallState = "blocked";
    releaseGate = "blocked";
    blockingReasons.push(`${lintSummary.criticalCount} critical validation failures`);
  }
  // Check if tests were executed
  else if (dimensions.every((d) => d.status === "not_tested")) {
    overallState = "not_evaluated";
    releaseGate = "needs_review";
    blockingReasons.push("No tests have been executed");
  }
  // Check if partially tested
  else if (dimensions.some((d) => d.status === "not_tested")) {
    overallState = "partially_tested";
    releaseGate = "needs_review";
    blockingReasons.push("Some dimensions have not been tested");
  }
  // Check average score
  else {
    const measuredDimensions = dimensions.filter((d) => d.status === "measured" && d.value !== undefined);
    const avgScore = measuredDimensions.reduce((sum, d) => sum + (d.value || 0), 0) / measuredDimensions.length;
    
    if (avgScore >= 80 && lintSummary.fail === 0) {
      overallState = "ready_for_release";
      releaseGate = "ready";
    } else if (avgScore >= 60) {
      overallState = "needs_review";
      releaseGate = "needs_review";
      blockingReasons.push(`Average score ${avgScore.toFixed(0)} is below 80 threshold`);
    } else {
      overallState = "not_ready";
      releaseGate = "blocked";
      blockingReasons.push(`Average score ${avgScore.toFixed(0)} is too low`);
    }
  }
  
  return {
    overallState,
    dimensions,
    releaseGate,
    blockingReasons: blockingReasons.length > 0 ? blockingReasons : undefined,
    assessedAt: new Date().toISOString(),
  };
}
