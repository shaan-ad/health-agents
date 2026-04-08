/**
 * Core workflow types for the orchestration engine.
 */

/** PHI access levels for agents. */
export type PHIAccessLevel = "none" | "metadata_only" | "read" | "read_write";

/** Agent configuration within a workflow. */
export interface AgentConfig {
  id: string;
  name: string;
  phi_access: PHIAccessLevel;
  metadata?: Record<string, unknown>;
}

/** An edge connecting two agents in the workflow DAG. */
export interface EdgeDefinition {
  from: string;
  to: string;
}

/** Complete workflow definition. */
export interface WorkflowDefinition {
  name: string;
  agents: Map<string, AgentConfig>;
  edges: EdgeDefinition[];
}

/** Message passed between agents on the message bus. */
export interface AgentMessage<T = unknown> {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: T;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Result from running a single agent. */
export interface AgentResult {
  agentId: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
  tokensUsed: number;
}

/** Result from running a complete workflow. */
export interface WorkflowResult {
  workflowName: string;
  success: boolean;
  agentResults: Map<string, AgentResult>;
  startTime: number;
  endTime: number;
  totalTokens: number;
}

/** Execution state of an agent within a workflow run. */
export type AgentStatus = "pending" | "running" | "completed" | "failed" | "skipped";
