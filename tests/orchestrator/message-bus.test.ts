import { describe, it, expect } from "vitest";
import { MessageBus, MessageValidationError } from "../../src/orchestrator/message-bus.js";

describe("MessageBus", () => {
  it("sends and retrieves messages", () => {
    const bus = new MessageBus();
    bus.send("agent-1", "agent-2", "data", { key: "value" });

    const messages = bus.getMessagesFor("agent-2");
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe("agent-1");
    expect(messages[0].payload).toEqual({ key: "value" });
  });

  it("generates unique message IDs", () => {
    const bus = new MessageBus();
    const msg1 = bus.send("a", "b", "type", {});
    const msg2 = bus.send("a", "b", "type", {});
    expect(msg1.id).not.toBe(msg2.id);
  });

  it("filters messages by sender", () => {
    const bus = new MessageBus();
    bus.send("agent-1", "agent-3", "data", {});
    bus.send("agent-2", "agent-3", "data", {});

    const fromAgent1 = bus.getMessagesFrom("agent-1");
    expect(fromAgent1).toHaveLength(1);
  });

  it("filters messages by type", () => {
    const bus = new MessageBus();
    bus.send("a", "b", "request", {});
    bus.send("a", "b", "response", {});
    bus.send("a", "b", "request", {});

    const requests = bus.getMessagesByType("request");
    expect(requests).toHaveLength(2);
  });

  it("validates messages with registered validators", () => {
    const bus = new MessageBus();
    bus.registerType("typed_data", (payload) => {
      return typeof payload === "object" && payload !== null && "value" in payload;
    });

    // Valid payload
    expect(() => bus.send("a", "b", "typed_data", { value: 42 })).not.toThrow();

    // Invalid payload
    expect(() => bus.send("a", "b", "typed_data", { wrong: "key" })).toThrow(
      MessageValidationError
    );
  });

  it("allows unregistered message types", () => {
    const bus = new MessageBus();
    expect(() => bus.send("a", "b", "unregistered", { anything: true })).not.toThrow();
  });

  it("clears all messages", () => {
    const bus = new MessageBus();
    bus.send("a", "b", "type", {});
    bus.send("a", "b", "type", {});
    expect(bus.getAllMessages()).toHaveLength(2);

    bus.clear();
    expect(bus.getAllMessages()).toHaveLength(0);
  });

  it("returns messages with timestamps", () => {
    const bus = new MessageBus();
    const before = Date.now();
    const msg = bus.send("a", "b", "type", {});
    const after = Date.now();

    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });
});
