/**
 * Anthropic Claude provider adapter.
 */

import type {
  ChatMessage,
  CompletionParams,
  CompletionResponse,
  LLMProvider,
  StreamChunk,
  ToolCallResult,
  ToolDefinition,
} from "./base.js";

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.defaultModel = defaultModel || "claude-sonnet-4-20250514";
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    const Anthropic = await this.getSDK();
    const client = new Anthropic({ apiKey: this.apiKey });

    const { system, messages } = this.convertMessages(params.messages);
    const tools = this.convertTools(params.tools);

    const start = performance.now();
    const response = await client.messages.create({
      model: params.model || this.defaultModel,
      messages,
      max_tokens: params.maxTokens || 4096,
      ...(system ? { system } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    });
    const latency = performance.now() - start;

    let content = "";
    const toolCalls: ToolCallResult[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls,
      model: params.model || this.defaultModel,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: latency,
    };
  }

  async *stream(params: CompletionParams): AsyncGenerator<StreamChunk> {
    const Anthropic = await this.getSDK();
    const client = new Anthropic({ apiKey: this.apiKey });

    const { system, messages } = this.convertMessages(params.messages);
    const tools = this.convertTools(params.tools);

    const stream = client.messages.stream({
      model: params.model || this.defaultModel,
      messages,
      max_tokens: params.maxTokens || 4096,
      ...(system ? { system } : {}),
      ...(tools.length > 0 ? { tools } : {}),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { content: event.delta.text, toolCalls: [], done: false };
      }
    }
    yield { content: "", toolCalls: [], done: true };
  }

  private convertMessages(
    messages: ChatMessage[]
  ): { system: string | undefined; messages: Array<Record<string, unknown>> } {
    let system: string | undefined;
    const converted: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = msg.content;
      } else if (msg.role === "tool") {
        converted.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content,
            },
          ],
        });
      } else {
        converted.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, messages: converted };
  }

  private convertTools(
    tools?: ToolDefinition[]
  ): Array<Record<string, unknown>> {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  private async getSDK(): Promise<any> {
    try {
      return (await import("@anthropic-ai/sdk")).default;
    } catch {
      throw new Error(
        "@anthropic-ai/sdk is required for AnthropicProvider. Install it with: npm install @anthropic-ai/sdk"
      );
    }
  }
}
