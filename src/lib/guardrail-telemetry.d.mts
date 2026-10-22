export type TelemetryLevel = "info" | "high-risk" | "intent-drift" | "policy-violation";
export type ParsedTelemetryEvent = {
  level: TelemetryLevel;
  message: string;
  source: string;
};
export const TELEMETRY_LEVELS: readonly TelemetryLevel[];
export function parseTelemetryEvent(raw: unknown): ParsedTelemetryEvent | null;
