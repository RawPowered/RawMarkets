import { getEngineMeta, setEngineMeta } from "./portfolioResearchDb";

/** Default local model for chat, news extract, and research. */
export const DEFAULT_OLLAMA_MODEL = "qwen2.5:14b";

const LEGACY_DEFAULT = "llama3.2:3b";

export function ollamaPullCommand(model = DEFAULT_OLLAMA_MODEL): string {
  return `ollama pull ${model}`;
}

export function ollamaNotReadyMessage(model = DEFAULT_OLLAMA_MODEL): string {
  return `Ollama is not running. Start Ollama, then run: ${ollamaPullCommand(model)}`;
}

/** Persist qwen2.5:14b when meta is missing or still on legacy 3B default. */
export function ensureOllamaDefaultModel(): void {
  const current = getEngineMeta("ollama_default_model");
  if (!current || current === LEGACY_DEFAULT) {
    setEngineMeta("ollama_default_model", DEFAULT_OLLAMA_MODEL);
  }
}

export function resolveOllamaModel(): string {
  return getEngineMeta("ollama_default_model") ?? DEFAULT_OLLAMA_MODEL;
}
