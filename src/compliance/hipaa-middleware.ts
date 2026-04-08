/**
 * Core HIPAA middleware that wraps every agent action.
 *
 * This middleware is NOT opt-in. Every agent action passes through it.
 */

import type { ComplianceConfig, PHISensitivity } from "../types/compliance.js";
import type { PHIAccessLevel } from "../types/workflow.js";
import type { CompletionParams, CompletionResponse, LLMProvider } from "../providers/base.js";
import { checkAccess } from "./access-control.js";
import { AuditLogger } from "./audit-logger.js";
import { ConsentTracker } from "./consent.js";
import { containsPHI } from "./phi-detector.js";
import { redactPHI } from "./phi-redactor.js";

/**
 * Default compliance configuration.
 */
export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
  sensitivity: "standard",
  enableAuditLog: true,
  enablePHIRedaction: true,
  enableAccessControl: true,
  enableConsentTracking: true,
};

/**
 * HIPAA-compliant wrapper around an LLM provider.
 *
 * Intercepts every call to enforce access control,
 * redact PHI in logs, and maintain audit trails.
 */
export class HIPAAMiddleware {
  public readonly auditLogger: AuditLogger;
  public readonly consentTracker: ConsentTracker;
  private config: ComplianceConfig;

  constructor(config: Partial<ComplianceConfig> = {}) {
    this.config = { ...DEFAULT_COMPLIANCE_CONFIG, ...config };
    this.auditLogger = new AuditLogger();
    this.consentTracker = new ConsentTracker();
  }

  /**
   * Wrap a provider call with HIPAA compliance checks.
   *
   * This is the main entry point. Every agent LLM call goes through here.
   */
  async wrapCall(
    provider: LLMProvider,
    params: CompletionParams,
    agentId: string,
    agentPHIAccess: PHIAccessLevel
  ): Promise<CompletionResponse> {
    // 1. Check if the input contains PHI
    const inputText = params.messages.map((m) => m.content).join(" ");
    const hasPHI = containsPHI(inputText, this.config.sensitivity);

    // 2. Access control check (block "none" agents, allow "metadata_only" with redaction)
    if (this.config.enableAccessControl && hasPHI && agentPHIAccess === "none") {
      if (this.config.enableAuditLog) {
        this.auditLogger.log({
          actor: agentId,
          action: "llm_call",
          resource: "patient_data",
          dataClassification: "phi",
          phiAccessLevel: agentPHIAccess,
          outcome: "denied",
          details: `Agent "${agentId}" has no PHI access`,
        });
      }
      throw new PHIAccessDeniedError(agentId, agentPHIAccess, "read");
    }

    // 3. Redact PHI from messages if agent has metadata_only access
    let processedParams = params;
    if (
      this.config.enablePHIRedaction &&
      hasPHI &&
      agentPHIAccess === "metadata_only"
    ) {
      processedParams = this.redactParams(params);
      if (this.config.enableAuditLog) {
        this.auditLogger.log({
          actor: agentId,
          action: "phi_redaction",
          resource: "llm_input",
          dataClassification: "phi",
          phiAccessLevel: agentPHIAccess,
          outcome: "redacted",
          details: "PHI redacted from agent input (metadata_only access)",
        });
      }
    }

    // 4. Log the LLM call
    if (this.config.enableAuditLog) {
      this.auditLogger.log({
        actor: agentId,
        action: "llm_call",
        resource: "llm_provider",
        dataClassification: hasPHI ? "phi" : "metadata",
        phiAccessLevel: agentPHIAccess,
        outcome: "allowed",
      });
    }

    // 5. Make the actual call
    const response = await provider.complete(processedParams);

    // 6. Log the response
    if (this.config.enableAuditLog) {
      const responseHasPHI = containsPHI(
        response.content,
        this.config.sensitivity
      );
      this.auditLogger.log({
        actor: agentId,
        action: "llm_response",
        resource: "llm_provider",
        dataClassification: responseHasPHI ? "phi" : "metadata",
        phiAccessLevel: agentPHIAccess,
        outcome: "allowed",
        details: `tokens: ${response.inputTokens + response.outputTokens}`,
      });
    }

    return response;
  }

  /**
   * Log an inter-agent message.
   */
  logMessage(
    fromAgent: string,
    toAgent: string,
    containsPHIData: boolean,
    fromAccess: PHIAccessLevel,
    toAccess: PHIAccessLevel
  ): void {
    if (!this.config.enableAuditLog) return;

    this.auditLogger.log({
      actor: fromAgent,
      action: `message_to:${toAgent}`,
      resource: "agent_message",
      dataClassification: containsPHIData ? "phi" : "metadata",
      phiAccessLevel: fromAccess,
      outcome: "allowed",
      details: `recipient_access: ${toAccess}`,
    });
  }

  /**
   * Redact PHI from completion params.
   */
  private redactParams(params: CompletionParams): CompletionParams {
    return {
      ...params,
      messages: params.messages.map((msg) => ({
        ...msg,
        content: redactPHI(msg.content, this.config.sensitivity).redacted,
      })),
    };
  }
}

/**
 * Error thrown when an agent attempts to access PHI without sufficient permissions.
 */
export class PHIAccessDeniedError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly actualLevel: PHIAccessLevel,
    public readonly requiredLevel: PHIAccessLevel
  ) {
    super(
      `PHI access denied for agent "${agentId}": ` +
        `has ${actualLevel} access, requires ${requiredLevel}`
    );
    this.name = "PHIAccessDeniedError";
  }
}
