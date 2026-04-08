import { describe, it, expect } from "vitest";
import { HIPAAMiddleware, PHIAccessDeniedError } from "../../src/compliance/hipaa-middleware.js";
import type { CompletionParams, CompletionResponse, LLMProvider, StreamChunk } from "../../src/providers/base.js";

function createMockProvider(responseContent: string = "Response"): LLMProvider {
  return {
    async complete(): Promise<CompletionResponse> {
      return {
        content: responseContent,
        toolCalls: [],
        model: "mock",
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10,
      };
    },
    async *stream(): AsyncGenerator<StreamChunk> {
      yield { content: responseContent, toolCalls: [], done: true };
    },
  };
}

describe("HIPAAMiddleware", () => {
  it("allows calls without PHI regardless of access level", async () => {
    const middleware = new HIPAAMiddleware();
    const provider = createMockProvider();

    const params: CompletionParams = {
      messages: [{ role: "user", content: "What is the weather?" }],
    };

    const response = await middleware.wrapCall(provider, params, "agent-1", "none");
    expect(response.content).toBe("Response");
  });

  it("allows calls with PHI when agent has read access", async () => {
    const middleware = new HIPAAMiddleware();
    const provider = createMockProvider();

    const params: CompletionParams = {
      messages: [{ role: "user", content: "Patient SSN: 123-45-6789" }],
    };

    const response = await middleware.wrapCall(provider, params, "agent-1", "read");
    expect(response.content).toBe("Response");
  });

  it("denies calls with PHI when agent has no access", async () => {
    const middleware = new HIPAAMiddleware();
    const provider = createMockProvider();

    const params: CompletionParams = {
      messages: [{ role: "user", content: "Patient SSN: 123-45-6789" }],
    };

    await expect(
      middleware.wrapCall(provider, params, "agent-1", "none")
    ).rejects.toThrow(PHIAccessDeniedError);
  });

  it("logs denied access in audit log", async () => {
    const middleware = new HIPAAMiddleware();
    const provider = createMockProvider();

    const params: CompletionParams = {
      messages: [{ role: "user", content: "SSN: 123-45-6789" }],
    };

    try {
      await middleware.wrapCall(provider, params, "blocked-agent", "none");
    } catch {
      // Expected
    }

    const denied = middleware.auditLogger.getDenied();
    expect(denied.length).toBeGreaterThanOrEqual(1);
    expect(denied[0].actor).toBe("blocked-agent");
  });

  it("redacts PHI for metadata_only agents", async () => {
    let capturedContent = "";
    const provider: LLMProvider = {
      async complete(params: CompletionParams): Promise<CompletionResponse> {
        capturedContent = params.messages[0].content;
        return {
          content: "Processed",
          toolCalls: [],
          model: "mock",
          inputTokens: 100,
          outputTokens: 50,
          latencyMs: 10,
        };
      },
      async *stream(): AsyncGenerator<StreamChunk> {
        yield { content: "Processed", toolCalls: [], done: true };
      },
    };

    const middleware = new HIPAAMiddleware();
    const params: CompletionParams = {
      messages: [{ role: "user", content: "Patient SSN: 123-45-6789" }],
    };

    await middleware.wrapCall(provider, params, "agent-1", "metadata_only");

    expect(capturedContent).toContain("[REDACTED_SSN]");
    expect(capturedContent).not.toContain("123-45-6789");
  });

  it("logs all calls in audit trail", async () => {
    const middleware = new HIPAAMiddleware();
    const provider = createMockProvider();

    const params: CompletionParams = {
      messages: [{ role: "user", content: "Simple question" }],
    };

    await middleware.wrapCall(provider, params, "agent-1", "read");

    // Should have logged the call and the response
    const entries = middleware.auditLogger.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it("maintains audit chain integrity", async () => {
    const middleware = new HIPAAMiddleware();
    const provider = createMockProvider();

    for (let i = 0; i < 5; i++) {
      await middleware.wrapCall(
        provider,
        { messages: [{ role: "user", content: `Question ${i}` }] },
        `agent-${i}`,
        "read"
      );
    }

    const integrity = middleware.auditLogger.verifyIntegrity();
    expect(integrity.valid).toBe(true);
  });

  it("can be configured to disable features", async () => {
    const middleware = new HIPAAMiddleware({
      enableAccessControl: false,
      enableAuditLog: false,
      enablePHIRedaction: false,
    });
    const provider = createMockProvider();

    // Should not throw even with PHI and no access
    const params: CompletionParams = {
      messages: [{ role: "user", content: "SSN: 123-45-6789" }],
    };

    const response = await middleware.wrapCall(provider, params, "agent-1", "none");
    expect(response.content).toBe("Response");
    expect(middleware.auditLogger.size).toBe(0);
  });
});
