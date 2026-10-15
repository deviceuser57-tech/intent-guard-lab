export interface CandidateRankingSignals {
  index: number;
  highRiskFindings: number;
  judgeScore: number;
  securityScore: number;
  evaluationScore: number;
  tokens: number;
}

/**
 * Rank evaluated candidates conservatively: reduce severe findings first,
 * then prefer judged quality, static security, static quality, and fewer tokens.
 */
export function rankCandidates<T extends CandidateRankingSignals>(candidates: T[]): T[] {
  return [...candidates].sort(
    (left, right) =>
      left.highRiskFindings - right.highRiskFindings ||
      right.judgeScore - left.judgeScore ||
      right.securityScore - left.securityScore ||
      right.evaluationScore - left.evaluationScore ||
      left.tokens - right.tokens,
  );
}
