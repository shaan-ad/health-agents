/**
 * LLM provider interface and shared types.
 */

export interface CompletionParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  model?: string;
  maxTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCallResult[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CompletionResponse {
  content: string;
  toolCalls: ToolCallResult[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface StreamChunk {
  content: string;
  toolCalls: ToolCallResult[];
  done: boolean;
}

/**
 * Interface that all LLM providers must implement.
 */
export interface LLMProvider {
  complete(params: CompletionParams): Promise<CompletionResponse>;
  stream(params: CompletionParams): AsyncGenerator<StreamChunk>;
}

/**
 * Create a provider based on environment configuration.
 */
export function createProvider(): LLMProvider {
  const providerName = process.env.HEALTH_AGENTS_PROVIDER || "anthropic";

  switch (providerName.toLowerCase()) {
    case "anthropic":
      // Lazy import to avoid requiring the SDK when not used
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AnthropicProvider } = require("./anthropic.js") as typeof import("./anthropic.js");
      return new AnthropicProvider();
    case "openai":
      const { OpenAIProvider } = require("./openai.js") as typeof import("./openai.js");
      return new OpenAIProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}. Use "anthropic" or "openai".`);
  }
}
