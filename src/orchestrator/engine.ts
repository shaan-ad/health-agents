/**
 * DAG-based workflow execution engine.
 */

import type { LLMProvider } from "../providers/base.js";
import type { AgentResult, AgentStatus, WorkflowResult } from "../types/workflow.js";
import type { ComplianceConfig } from "../types/compliance.js";
import { BaseAgent, createAgentContext } from "./agent.js";
import { MessageBus } from "./message-bus.js";
import { computeSchedule } from "./scheduler.js";
import type { BuiltWorkflow } from "./workflow.js";
import { HIPAAMiddleware } from "../compliance/hipaa-middleware.js";
import { containsPHI } from "../compliance/phi-detector.js";

/**
 * Execute a workflow using the DAG scheduler with HIPAA compliance.
 */
export class WorkflowEngine {
  private provider: LLMProvider;
  private middleware: HIPAAMiddleware;
  private messageBus: MessageBus;

  constructor(
    provider: LLMProvider,
    complianceConfig?: Partial<ComplianceConfig>
  ) {
    this.provider = provider;
    this.middleware = new HIPAAMiddleware(complianceConfig);
    this.messageBus = new MessageBus();
  }

  /**
   * Get the audit logger for compliance exports.
   */
  get auditLogger() {
    return this.middleware.auditLogger;
  }

  /**
   * Get the consent tracker.
   */
  get consentTracker() {
    return this.middleware.consentTracker;
  }

  /**
   * Get the message bus.
   */
  get messages() {
    return this.messageBus;
  }

  /**
   * Execute a built workflow.
   */
  async execute(
    builtWorkflow: BuiltWorkflow,
    initialInput: unknown
  ): Promise<WorkflowResult> {
    const { definition, agents } = builtWorkflow;
    const startTime = Date.now();
    const agentResults = new Map<string, AgentResult>();
    const agentOutputs = new Map<string, unknown>();
    let totalTokens = 0;

    // Compute execution schedule
    const schedule = computeSchedule(definition.agents, definition.edges);

    // Execute stages
    for (const stage of schedule) {
      // Run agents in the stage concurrently
      const stagePromises = stage.agentIds.map(async (agentId) => {
        const agent = agents.get(agentId);
        if (!agent) {
          throw new Error(`Agent "${agentId}" not found in workflow`);
        }

        // Gather input from upstream agents (or use initial input for root nodes)
        const input = this.gatherInput(
          agentId,
          definition.edges,
          agentOutputs,
          initialInput
        );

        // Execute the agent with compliance middleware
        const result = await this.executeAgent(
          agent,
          input,
          definition.name
        );

        agentResults.set(agentId, result);
        agentOutputs.set(agentId, result.output);
        totalTokens += result.tokensUsed;

        // Log inter-agent messages for downstream agents
        const downstreamEdges = definition.edges.filter(
          (e) => e.from === agentId
        );
        for (const edge of downstreamEdges) {
          const toAgent = agents.get(edge.to);
          if (toAgent) {
            const outputStr = JSON.stringify(result.output);
            const hasPHI = containsPHI(outputStr);
            this.middleware.logMessage(
              agentId,
              edge.to,
              hasPHI,
              agent.phiAccess,
              toAgent.phiAccess
            );
            this.messageBus.send(agentId, edge.to, "agent_output", result.output);
          }
        }
      });

      await Promise.all(stagePromises);

      // Check if any agent in this stage failed
      for (const agentId of stage.agentIds) {
        const result = agentResults.get(agentId);
        if (result && !result.success) {
          // Continue execution but mark workflow as partially failed
          break;
        }
      }
    }

    const endTime = Date.now();
    const allSucceeded = [...agentResults.values()].every((r) => r.success);

    return {
      workflowName: definition.name,
      success: allSucceeded,
      agentResults,
      startTime,
      endTime,
      totalTokens,
    };
  }

  /**
   * Execute a single agent with compliance wrapping.
   */
  private async executeAgent(
    agent: BaseAgent,
    input: unknown,
    workflowName: string
  ): Promise<AgentResult> {
    const agentStart = Date.now();

    // Create a compliance-wrapped provider for this agent
    const wrappedProvider: LLMProvider = {
      complete: async (params) => {
        return this.middleware.wrapCall(
          this.provider,
          params,
          agent.id,
          agent.phiAccess
        );
      },
      stream: (params) => {
        return this.provider.stream(params);
      },
    };

    const context = createAgentContext(
      agent,
      wrappedProvider,
      workflowName
    );

    try {
      const output = await agent.process(input, context);
      return {
        agentId: agent.id,
        success: true,
        output,
        durationMs: Date.now() - agentStart,
        tokensUsed: 0, // Token tracking happens in middleware
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        agentId: agent.id,
        success: false,
        output: null,
        error: errorMessage,
        durationMs: Date.now() - agentStart,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Gather input for an agent from its upstream agents.
   */
  private gatherInput(
    agentId: string,
    edges: Array<{ from: string; to: string }>,
    agentOutputs: Map<string, unknown>,
    initialInput: unknown
  ): unknown {
    const upstreamEdges = edges.filter((e) => e.to === agentId);

    // Root node: use initial input
    if (upstreamEdges.length === 0) {
      return initialInput;
    }

    // Single upstream: pass output directly
    if (upstreamEdges.length === 1) {
      return agentOutputs.get(upstreamEdges[0].from);
    }

    // Multiple upstream: merge outputs into an object
    const merged: Record<string, unknown> = {};
    for (const edge of upstreamEdges) {
      merged[edge.from] = agentOutputs.get(edge.from);
    }
    return merged;
  }
}
