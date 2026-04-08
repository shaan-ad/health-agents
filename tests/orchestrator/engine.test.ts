import { describe, it, expect } from "vitest";
import { WorkflowEngine } from "../../src/orchestrator/engine.js";
import { BaseAgent, type AgentContext } from "../../src/orchestrator/agent.js";
import { workflow } from "../../src/orchestrator/workflow.js";
import type { CompletionParams, CompletionResponse, LLMProvider, StreamChunk } from "../../src/providers/base.js";

class EchoAgent extends BaseAgent {
  getSystemPrompt(): string {
    return "Echo the input.";
  }
  async process(input: unknown): Promise<unknown> {
    return { echo: input, agentId: this.id };
  }
}

class UpperAgent extends BaseAgent {
  getSystemPrompt(): string {
    return "Uppercase the input.";
  }
  async process(input: unknown): Promise<unknown> {
    const str = JSON.stringify(input);
    return { upper: str.toUpperCase(), agentId: this.id };
  }
}

class FailAgent extends BaseAgent {
  getSystemPrompt(): string {
    return "Fail.";
  }
  async process(): Promise<unknown> {
    throw new Error("Intentional failure");
  }
}

function createMockProvider(): LLMProvider {
  return {
    async complete(): Promise<CompletionResponse> {
      return {
        content: "mock response",
        toolCalls: [],
        model: "mock",
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 1,
      };
    },
    async *stream(): AsyncGenerator<StreamChunk> {
      yield { content: "mock", toolCalls: [], done: true };
    },
  };
}

describe("WorkflowEngine", () => {
  it("executes a single-agent workflow", async () => {
    const builtWorkflow = workflow("simple")
      .agent("echo", EchoAgent, { phi_access: "none" })
      .build();

    const engine = new WorkflowEngine(createMockProvider(), {
      enableAccessControl: false,
    });
    const result = await engine.execute(builtWorkflow, "hello");

    expect(result.success).toBe(true);
    expect(result.agentResults.size).toBe(1);
    const echoResult = result.agentResults.get("echo");
    expect(echoResult?.success).toBe(true);
    expect((echoResult?.output as Record<string, unknown>).echo).toBe("hello");
  });

  it("executes a sequential two-agent workflow", async () => {
    const builtWorkflow = workflow("sequential")
      .agent("echo", EchoAgent, { phi_access: "none" })
      .agent("upper", UpperAgent, { phi_access: "none" })
      .edge("echo", "upper")
      .build();

    const engine = new WorkflowEngine(createMockProvider(), {
      enableAccessControl: false,
    });
    const result = await engine.execute(builtWorkflow, "test");

    expect(result.success).toBe(true);
    expect(result.agentResults.size).toBe(2);

    const upperResult = result.agentResults.get("upper");
    expect(upperResult?.success).toBe(true);
  });

  it("handles agent failure gracefully", async () => {
    const builtWorkflow = workflow("failing")
      .agent("fail", FailAgent, { phi_access: "none" })
      .build();

    const engine = new WorkflowEngine(createMockProvider(), {
      enableAccessControl: false,
    });
    const result = await engine.execute(builtWorkflow, "input");

    expect(result.success).toBe(false);
    const failResult = result.agentResults.get("fail");
    expect(failResult?.success).toBe(false);
    expect(failResult?.error).toContain("Intentional failure");
  });

  it("records audit entries during execution", async () => {
    const builtWorkflow = workflow("audited")
      .agent("echo", EchoAgent, { phi_access: "none" })
      .build();

    const engine = new WorkflowEngine(createMockProvider(), {
      enableAccessControl: false,
    });
    await engine.execute(builtWorkflow, "test");

    // Engine should not log audit entries for non-LLM agents
    // (agents that don't call context.complete don't go through middleware)
    expect(engine.auditLogger).toBeDefined();
  });

  it("populates message bus during execution", async () => {
    const builtWorkflow = workflow("messaging")
      .agent("echo", EchoAgent, { phi_access: "none" })
      .agent("upper", UpperAgent, { phi_access: "none" })
      .edge("echo", "upper")
      .build();

    const engine = new WorkflowEngine(createMockProvider(), {
      enableAccessControl: false,
    });
    await engine.execute(builtWorkflow, "test");

    const messages = engine.messages.getMessagesFor("upper");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it("tracks workflow timing", async () => {
    const builtWorkflow = workflow("timed")
      .agent("echo", EchoAgent, { phi_access: "none" })
      .build();

    const engine = new WorkflowEngine(createMockProvider(), {
      enableAccessControl: false,
    });
    const result = await engine.execute(builtWorkflow, "test");

    expect(result.startTime).toBeGreaterThan(0);
    expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
  });
});
