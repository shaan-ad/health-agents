/**
 * Router agent: determines where processed documents should be sent.
 */

import { BaseAgent, type AgentContext } from "../../orchestrator/agent.js";
import type {
  AnomalyFlag,
  DocumentClassification,
  RoutingDecision,
} from "../../types/clinical.js";

const SYSTEM_PROMPT = `You are a clinical document routing specialist. Given a document classification and any anomaly flags, determine where the document should be routed.

Consider:
- Document type and department
- Urgency level
- Any critical flags that need immediate attention
- Whether the document needs specialist review

Output valid JSON:
{
  "destination": "specific person, role, or queue (e.g., 'Dr. Smith', 'Cardiology Queue', 'ER Triage')",
  "department": "department name",
  "priority": "low|normal|high|urgent",
  "rationale": "Brief explanation of routing decision"
}

Routing rules:
- Critical anomaly flags always route to "urgent" priority
- Lab reports with critical values go to the ordering physician AND the relevant specialist
- Discharge summaries route to primary care for follow-up
- Referrals route to the target specialist's intake queue`;

export class RouterAgent extends BaseAgent {
  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async process(input: unknown, context: AgentContext): Promise<RoutingDecision> {
    // Input comes from both classifier and flagger (merged by engine)
    const merged = input as Record<string, unknown>;
    const classification = (merged.classifier || merged) as DocumentClassification;
    const flags = ((merged.flagger || []) as AnomalyFlag[]);

    const response = await context.complete(
      `Route this document based on classification and flags:\n\n` +
        `Classification: ${JSON.stringify(classification, null, 2)}\n\n` +
        `Anomaly Flags: ${JSON.stringify(flags, null, 2)}`
    );

    try {
      const parsed = JSON.parse(extractJSON(response.content));
      return {
        documentId: classification.documentId,
        destination: parsed.destination || "General Queue",
        department: parsed.department || classification.department || "general",
        priority: parsed.priority || mapUrgencyToPriority(classification.urgency),
        rationale: parsed.rationale || "No rationale provided",
        flags,
      };
    } catch {
      return {
        documentId: classification.documentId,
        destination: "General Queue",
        department: classification.department || "general",
        priority: mapUrgencyToPriority(classification.urgency),
        rationale: "Routing failed, defaulting to general queue",
        flags,
      };
    }
  }
}

function mapUrgencyToPriority(
  urgency: string
): "low" | "normal" | "high" | "urgent" {
  switch (urgency) {
    case "critical":
      return "urgent";
    case "urgent":
      return "high";
    default:
      return "normal";
  }
}

function extractJSON(text: string): string {
  if (text.includes("```json")) {
    const start = text.indexOf("```json") + 7;
    const end = text.indexOf("```", start);
    return text.slice(start, end).trim();
  }
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}") + 1;
  if (braceStart >= 0 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd);
  }
  return text;
}
