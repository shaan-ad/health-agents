import { describe, it, expect } from "vitest";
import { workflow } from "../../src/orchestrator/workflow.js";
import { BaseAgent, type AgentContext } from "../../src/orchestrator/agent.js";

class TestAgent extends BaseAgent {
  getSystemPrompt(): string {
    return "Test";
  }
  async process(input: unknown): Promise<unknown> {
    return input;
  }
}

describe("WorkflowBuilder", () => {
  it("builds a workflow with agents and edges", () => {
    const built = workflow("test-workflow")
      .agent("a", TestAgent, { phi_access: "read" })
      .agent("b", TestAgent, { phi_access: "none" })
      .edge("a", "b")
      .build();

    expect(built.definition.name).toBe("test-workflow");
    expect(built.definition.agents.size).toBe(2);
    expect(built.definition.edges).toHaveLength(1);
    expect(built.agents.size).toBe(2);
  });

  it("instantiates agents with correct PHI access", () => {
    const built = workflow("test")
      .agent("reader", TestAgent, { phi_access: "read" })
      .agent("writer", TestAgent, { phi_access: "read_write" })
      .build();

    expect(built.agents.get("reader")!.phiAccess).toBe("read");
    expect(built.agents.get("writer")!.phiAccess).toBe("read_write");
  });

  it("throws on duplicate agent IDs", () => {
    expect(() =>
      workflow("test")
        .agent("dup", TestAgent, { phi_access: "none" })
        .agent("dup", TestAgent, { phi_access: "none" })
    ).toThrow("already registered");
  });

  it("throws on edges referencing unknown agents", () => {
    expect(() =>
      workflow("test")
        .agent("a", TestAgent, { phi_access: "none" })
        .edge("a", "nonexistent")
        .build()
    ).toThrow("unknown agent");
  });

  it("builds workflow with no edges (all parallel)", () => {
    const built = workflow("parallel")
      .agent("a", TestAgent, { phi_access: "none" })
      .agent("b", TestAgent, { phi_access: "none" })
      .agent("c", TestAgent, { phi_access: "none" })
      .build();

    expect(built.definition.edges).toHaveLength(0);
    expect(built.agents.size).toBe(3);
  });

  it("builds complex DAG", () => {
    const built = workflow("complex")
      .agent("extract", TestAgent, { phi_access: "read" })
      .agent("classify", TestAgent, { phi_access: "read" })
      .agent("flag", TestAgent, { phi_access: "read" })
      .agent("route", TestAgent, { phi_access: "metadata_only" })
      .edge("extract", "classify")
      .edge("extract", "flag")
      .edge("classify", "route")
      .edge("flag", "route")
      .build();

    expect(built.definition.edges).toHaveLength(4);
    expect(built.agents.size).toBe(4);
  });
});
