/**
 * OpenAI provider adapter.
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

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.defaultModel = defaultModel || "gpt-4o";
  }

  async complete(params: CompletionParams): Promise<CompletionResponse> {
    const OpenAI = await this.getSDK();
    const client = new OpenAI({ apiKey: this.apiKey });

    const messages = this.convertMessages(params.messages);
    const tools = this.convertTools(params.tools);

    const start = performance.now();
    const response = await client.chat.completions.create({
      model: params.model || this.defaultModel,
      messages,
      ...(tools.length > 0 ? { tools } : {}),
    });
    const latency = performance.now() - start;

    const choice = response.choices[0];
    const content = choice.message.content || "";
    const toolCalls: ToolCallResult[] = [];

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content,
      toolCalls,
      model: params.model || this.defaultModel,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      latencyMs: latency,
    };
  }

  async *stream(params: CompletionParams): AsyncGenerator<StreamChunk> {
    const OpenAI = await this.getSDK();
    const client = new OpenAI({ apiKey: this.apiKey });

    const messages = this.convertMessages(params.messages);
    const tools = this.convertTools(params.tools);

    const stream = await client.chat.completions.create({
      model: params.model || this.defaultModel,
      messages,
      stream: true,
      ...(tools.length > 0 ? { tools } : {}),
    });

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        yield {
          content: chunk.choices[0].delta.content,
          toolCalls: [],
          done: false,
        };
      }
    }
    yield { content: "", toolCalls: [], done: true };
  }

  private convertMessages(
    messages: ChatMessage[]
  ): Array<Record<string, unknown>> {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };
      }
      return { role: msg.role, content: msg.content };
    });
  }

  private convertTools(
    tools?: ToolDefinition[]
  ): Array<Record<string, unknown>> {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  private async getSDK(): Promise<any> {
    try {
      return (await import("openai")).default;
    } catch {
      throw new Error(
        "openai package is required for OpenAIProvider. Install it with: npm install openai"
      );
    }
  }
}
