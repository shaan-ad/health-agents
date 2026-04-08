/**
 * Workflow definition builder API.
 */

import type { AgentConfig, EdgeDefinition, PHIAccessLevel, WorkflowDefinition } from "../types/workflow.js";
import type { BaseAgent } from "./agent.js";

/**
 * Agent class constructor type.
 */
type AgentConstructor = new (id: string, name: string, phiAccess: PHIAccessLevel) => BaseAgent;

/**
 * Registered agent entry (class + config).
 */
interface AgentEntry {
  constructor: AgentConstructor;
  config: AgentConfig;
}

/**
 * Fluent builder for workflow definitions.
 *
 * Usage:
 *   const wf = workflow("my-workflow")
 *     .agent("extractor", ExtractorAgent, { phi_access: "read" })
 *     .agent("classifier", ClassifierAgent, { phi_access: "read" })
 *     .edge("extractor", "classifier")
 *     .build();
 */
export class WorkflowBuilder {
  private name: string;
  private agentEntries: Map<string, AgentEntry> = new Map();
  private edges: EdgeDefinition[] = [];

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Add an agent to the workflow.
   */
  agent(
    id: string,
    agentClass: AgentConstructor,
    options: { phi_access: PHIAccessLevel; metadata?: Record<string, unknown> } = {
      phi_access: "none",
    }
  ): WorkflowBuilder {
    if (this.agentEntries.has(id)) {
      throw new Error(`Agent "${id}" is already registered in workflow "${this.name}"`);
    }

    const config: AgentConfig = {
      id,
      name: id,
      phi_access: options.phi_access,
      metadata: options.metadata,
    };

    this.agentEntries.set(id, { constructor: agentClass, config });
    return this;
  }

  /**
   * Add a directed edge between two agents.
   */
  edge(from: string, to: string): WorkflowBuilder {
    this.edges.push({ from, to });
    return this;
  }

  /**
   * Build the workflow definition and instantiate agents.
   */
  build(): BuiltWorkflow {
    // Validate all edge references
    for (const e of this.edges) {
      if (!this.agentEntries.has(e.from)) {
        throw new Error(
          `Edge references unknown agent "${e.from}" in workflow "${this.name}"`
        );
      }
      if (!this.agentEntries.has(e.to)) {
        throw new Error(
          `Edge references unknown agent "${e.to}" in workflow "${this.name}"`
        );
      }
    }

    // Instantiate agents
    const agents = new Map<string, BaseAgent>();
    const configs = new Map<string, AgentConfig>();

    for (const [id, entry] of this.agentEntries) {
      agents.set(
        id,
        new entry.constructor(id, entry.config.name, entry.config.phi_access)
      );
      configs.set(id, entry.config);
    }

    const definition: WorkflowDefinition = {
      name: this.name,
      agents: configs,
      edges: [...this.edges],
    };

    return { definition, agents };
  }
}

/**
 * Result of building a workflow.
 */
export interface BuiltWorkflow {
  definition: WorkflowDefinition;
  agents: Map<string, BaseAgent>;
}

/**
 * Create a new workflow builder.
 */
export function workflow(name: string): WorkflowBuilder {
  return new WorkflowBuilder(name);
}
