/**
 * Health Agents: HIPAA-compliant multi-agent orchestration for healthcare.
 *
 * HIPAA-compliant multi-agent orchestration framework for healthcare.
 */

// Orchestrator
export { WorkflowEngine } from "./orchestrator/engine.js";
export { workflow, WorkflowBuilder, type BuiltWorkflow } from "./orchestrator/workflow.js";
export { BaseAgent, createAgentContext, type AgentContext } from "./orchestrator/agent.js";
export { MessageBus, MessageValidationError } from "./orchestrator/message-bus.js";
export { computeSchedule, validateEdges, CyclicDependencyError } from "./orchestrator/scheduler.js";

// Compliance
export { HIPAAMiddleware, PHIAccessDeniedError, DEFAULT_COMPLIANCE_CONFIG } from "./compliance/hipaa-middleware.js";
export { detectPHI, containsPHI } from "./compliance/phi-detector.js";
export { redactPHI, redactObjectPHI } from "./compliance/phi-redactor.js";
export { checkAccess, determineRequiredAccess, compareAccessLevels } from "./compliance/access-control.js";
export { AuditLogger } from "./compliance/audit-logger.js";
export { exportAsJSON, exportAsCSV, exportAsReport } from "./compliance/audit-export.js";
export { ConsentTracker } from "./compliance/consent.js";
export { encrypt, decrypt, generateKey } from "./compliance/encryption.js";

// Providers
export type { LLMProvider, CompletionParams, CompletionResponse, ChatMessage, ToolDefinition, StreamChunk } from "./providers/base.js";
export { createProvider } from "./providers/base.js";
export { AnthropicProvider } from "./providers/anthropic.js";
export { OpenAIProvider } from "./providers/openai.js";

// Templates
export { createClinicalDocProcessingWorkflow } from "./templates/clinical-doc-processing/index.js";
export { ExtractorAgent } from "./templates/clinical-doc-processing/extractor-agent.js";
export { ClassifierAgent } from "./templates/clinical-doc-processing/classifier-agent.js";
export { FlaggerAgent } from "./templates/clinical-doc-processing/flagger-agent.js";
export { RouterAgent } from "./templates/clinical-doc-processing/router-agent.js";

// Types
export type * from "./types/workflow.js";
export type * from "./types/compliance.js";
export type * from "./types/clinical.js";
