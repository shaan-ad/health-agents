/**
 * Typed inter-agent messaging system.
 */

import { v4 as uuidv4 } from "uuid";
import type { AgentMessage } from "../types/workflow.js";

/**
 * Message schema validator function type.
 */
type MessageValidator = (payload: unknown) => boolean;

/**
 * Typed message bus for inter-agent communication.
 *
 * Messages have types and the bus validates payloads against registered schemas.
 */
export class MessageBus {
  private messages: AgentMessage[] = [];
  private validators: Map<string, MessageValidator> = new Map();

  /**
   * Register a validator for a message type.
   */
  registerType(type: string, validator: MessageValidator): void {
    this.validators.set(type, validator);
  }

  /**
   * Send a message between agents.
   *
   * Validates the payload if a validator is registered for the message type.
   */
  send<T>(from: string, to: string, type: string, payload: T): AgentMessage<T> {
    // Validate payload if a validator exists
    const validator = this.validators.get(type);
    if (validator && !validator(payload)) {
      throw new MessageValidationError(type, from, to);
    }

    const message: AgentMessage<T> = {
      id: uuidv4(),
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
    };

    this.messages.push(message as AgentMessage);
    return message;
  }

  /**
   * Get all messages sent to a specific agent.
   */
  getMessagesFor(agentId: string): AgentMessage[] {
    return this.messages.filter((m) => m.to === agentId);
  }

  /**
   * Get all messages sent from a specific agent.
   */
  getMessagesFrom(agentId: string): AgentMessage[] {
    return this.messages.filter((m) => m.from === agentId);
  }

  /**
   * Get all messages of a specific type.
   */
  getMessagesByType(type: string): AgentMessage[] {
    return this.messages.filter((m) => m.type === type);
  }

  /**
   * Get all messages (read-only).
   */
  getAllMessages(): ReadonlyArray<AgentMessage> {
    return [...this.messages];
  }

  /**
   * Clear all messages (useful for testing).
   */
  clear(): void {
    this.messages = [];
  }
}

/**
 * Error thrown when a message payload fails validation.
 */
export class MessageValidationError extends Error {
  constructor(type: string, from: string, to: string) {
    super(
      `Message validation failed for type "${type}" from "${from}" to "${to}"`
    );
    this.name = "MessageValidationError";
  }
}
