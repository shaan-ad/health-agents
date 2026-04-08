import { describe, it, expect } from "vitest";
import { AuditLogger } from "../../src/compliance/audit-logger.js";

describe("AuditLogger", () => {
  it("logs entries with hash chain", () => {
    const logger = new AuditLogger();
    const entry = logger.log({
      actor: "agent-1",
      action: "llm_call",
      resource: "patient_data",
      dataClassification: "phi",
      phiAccessLevel: "read",
      outcome: "allowed",
    });

    expect(entry.id).toBeDefined();
    expect(entry.actor).toBe("agent-1");
    expect(entry.hash).toBeDefined();
    expect(entry.previousHash).toBe("genesis");
  });

  it("chains hashes correctly", () => {
    const logger = new AuditLogger();
    const first = logger.log({
      actor: "agent-1",
      action: "read",
      resource: "doc-1",
      dataClassification: "phi",
      phiAccessLevel: "read",
      outcome: "allowed",
    });
    const second = logger.log({
      actor: "agent-2",
      action: "write",
      resource: "doc-1",
      dataClassification: "phi",
      phiAccessLevel: "read_write",
      outcome: "allowed",
    });

    expect(second.previousHash).toBe(first.hash);
  });

  it("verifies integrity of valid chain", () => {
    const logger = new AuditLogger();
    for (let i = 0; i < 5; i++) {
      logger.log({
        actor: `agent-${i}`,
        action: "action",
        resource: "resource",
        dataClassification: "metadata",
        phiAccessLevel: "none",
        outcome: "allowed",
      });
    }

    const result = logger.verifyIntegrity();
    expect(result.valid).toBe(true);
  });

  it("returns entries count", () => {
    const logger = new AuditLogger();
    expect(logger.size).toBe(0);

    logger.log({
      actor: "test",
      action: "test",
      resource: "test",
      dataClassification: "metadata",
      phiAccessLevel: "none",
      outcome: "allowed",
    });

    expect(logger.size).toBe(1);
  });

  it("queries by actor", () => {
    const logger = new AuditLogger();
    logger.log({
      actor: "agent-1",
      action: "read",
      resource: "doc",
      dataClassification: "phi",
      phiAccessLevel: "read",
      outcome: "allowed",
    });
    logger.log({
      actor: "agent-2",
      action: "read",
      resource: "doc",
      dataClassification: "phi",
      phiAccessLevel: "read",
      outcome: "allowed",
    });
    logger.log({
      actor: "agent-1",
      action: "write",
      resource: "doc",
      dataClassification: "phi",
      phiAccessLevel: "read_write",
      outcome: "allowed",
    });

    const agent1Entries = logger.getByActor("agent-1");
    expect(agent1Entries).toHaveLength(2);
  });

  it("queries denied entries", () => {
    const logger = new AuditLogger();
    logger.log({
      actor: "agent-1",
      action: "read",
      resource: "doc",
      dataClassification: "phi",
      phiAccessLevel: "read",
      outcome: "allowed",
    });
    logger.log({
      actor: "agent-2",
      action: "read",
      resource: "doc",
      dataClassification: "phi",
      phiAccessLevel: "none",
      outcome: "denied",
    });

    const denied = logger.getDenied();
    expect(denied).toHaveLength(1);
    expect(denied[0].actor).toBe("agent-2");
  });

  it("returns read-only entries copy", () => {
    const logger = new AuditLogger();
    logger.log({
      actor: "test",
      action: "test",
      resource: "test",
      dataClassification: "metadata",
      phiAccessLevel: "none",
      outcome: "allowed",
    });

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    // Verify it's a copy
    expect(entries).not.toBe(logger.getEntries());
  });
});
