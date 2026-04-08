/**
 * Base agent class and lifecycle management.
 */

import type { LLMProvider, CompletionResponse, ChatMessage, ToolDefinition } from "../providers/base.js";
import type { PHIAccessLevel } from "../types/workflow.js";

/**
 * Base class for all agents in a workflow.
 * Subclass this to create custom agents.
 */
export abstract class BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly phiAccess: PHIAccessLevel;

  constructor(id: string, name: string, phiAccess: PHIAccessLevel = "none") {
    this.id = id;
    this.name = name;
    this.phiAccess = phiAccess;
  }

  /**
   * Process input and produce output.
   * This is the main method that subclasses implement.
   */
  abstract process(
    input: unknown,
    context: AgentContext
  ): Promise<unknown>;

  /**
   * Get the system prompt for this agent.
   */
  abstract getSystemPrompt(): string;

  /**
   * Get the tools this agent can use (optional).
   */
  getTools(): ToolDefinition[] {
    return [];
  }
}

/**
 * Context provided to an agent during execution.
 */
export interface AgentContext {
  provider: LLMProvider;
  workflowName: string;
  metadata: Record<string, unknown>;

  /**
   * Helper to make an LLM call with the agent's system prompt.
   */
  complete(userMessage: string): Promise<CompletionResponse>;
}

/**
 * Create an agent context for execution.
 */
export function createAgentContext(
  agent: BaseAgent,
  provider: LLMProvider,
  workflowName: string,
  metadata: Record<string, unknown> = {}
): AgentContext {
  return {
    provider,
    workflowName,
    metadata,

    async complete(userMessage: string): Promise<CompletionResponse> {
      const messages: ChatMessage[] = [
        { role: "system", content: agent.getSystemPrompt() },
        { role: "user", content: userMessage },
      ];
      const tools = agent.getTools();
      return provider.complete({
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });
    },
  };
}
