/**
 * Agent scheduling: determines execution order from the workflow DAG.
 */

import type { AgentConfig, EdgeDefinition } from "../types/workflow.js";

/**
 * An execution stage: a group of agents that can run in parallel.
 */
export interface ExecutionStage {
  stageIndex: number;
  agentIds: string[];
}

/**
 * Compute the execution schedule from a workflow DAG.
 *
 * Uses topological sorting to determine which agents can run in parallel
 * and which must wait for dependencies.
 *
 * Returns stages where each stage's agents can run concurrently.
 */
export function computeSchedule(
  agents: Map<string, AgentConfig>,
  edges: EdgeDefinition[]
): ExecutionStage[] {
  // Build adjacency and in-degree maps
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const [id] of agents) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    dependents.get(edge.from)?.push(edge.to);
  }

  // Kahn's algorithm for topological sort, grouped into stages
  const stages: ExecutionStage[] = [];
  let stageIndex = 0;

  // Find initial nodes (no dependencies)
  let ready = [...agents.keys()].filter((id) => inDegree.get(id) === 0);

  while (ready.length > 0) {
    stages.push({ stageIndex, agentIds: [...ready] });

    const nextReady: string[] = [];
    for (const agentId of ready) {
      for (const dependent of dependents.get(agentId) || []) {
        const newDegree = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          nextReady.push(dependent);
        }
      }
    }

    ready = nextReady;
    stageIndex++;
  }

  // Check for cycles
  const scheduledCount = stages.reduce(
    (sum, stage) => sum + stage.agentIds.length,
    0
  );
  if (scheduledCount !== agents.size) {
    throw new CyclicDependencyError();
  }

  return stages;
}

/**
 * Validate that all edge references point to existing agents.
 */
export function validateEdges(
  agents: Map<string, AgentConfig>,
  edges: EdgeDefinition[]
): string[] {
  const errors: string[] = [];
  for (const edge of edges) {
    if (!agents.has(edge.from)) {
      errors.push(`Edge references unknown agent: "${edge.from}"`);
    }
    if (!agents.has(edge.to)) {
      errors.push(`Edge references unknown agent: "${edge.to}"`);
    }
  }
  return errors;
}

/**
 * Error thrown when the workflow DAG contains a cycle.
 */
export class CyclicDependencyError extends Error {
  constructor() {
    super("Workflow contains a cyclic dependency between agents");
    this.name = "CyclicDependencyError";
  }
}
