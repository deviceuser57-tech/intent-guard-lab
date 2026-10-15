export type ModelProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "openai-compatible";

export interface ModelProviderConfig {
  provider: ModelProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
}

export type PersistedModelProviderConfig = Omit<ModelProviderConfig, "apiKey">;

export const DEFAULT_MODEL_PROVIDER_CONFIG: ModelProviderConfig = {
  provider: "openai",
  model: "gpt-4.1-mini",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
};

export const providerDefaults: Record<ModelProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-3-7-sonnet-latest" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-reasoner" },
  "openai-compatible": { baseUrl: "", model: "" },
};

export function safePersistedConfig(config: ModelProviderConfig): PersistedModelProviderConfig {
  return { provider: config.provider, model: config.model, baseUrl: config.baseUrl };
}
