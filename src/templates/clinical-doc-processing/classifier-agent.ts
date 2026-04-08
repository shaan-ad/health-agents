/**
 * Classifier agent: categorizes clinical documents by type, department, and urgency.
 */

import { BaseAgent, type AgentContext } from "../../orchestrator/agent.js";
import type { ClinicalExtraction, DocumentClassification } from "../../types/clinical.js";

const SYSTEM_PROMPT = `You are a clinical document classifier. Given structured clinical data extracted from a document, determine:

1. Document type (progress_note, discharge_summary, lab_report, radiology_report, pathology_report, consultation_note, operative_note, referral, prescription, other)
2. Relevant department (e.g., cardiology, oncology, emergency, primary_care, surgery, neurology, pediatrics, general)
3. Urgency level:
   - "routine": standard follow-up, normal results
   - "urgent": abnormal results requiring attention within 24-48 hours
   - "critical": life-threatening values, immediate attention required

Output valid JSON:
{
  "type": "...",
  "department": "...",
  "urgency": "routine|urgent|critical",
  "routingMetadata": {
    "reason": "Brief explanation of classification",
    "keywords": ["relevant", "clinical", "terms"]
  }
}

Classification rules:
- Critical lab values (e.g., potassium > 6.0, glucose < 40) always flag as "critical"
- Active cancer diagnoses route to oncology
- Multiple active medications may indicate complex care coordination needs
- Discharge summaries with pending follow-ups are at least "urgent"`;

export class ClassifierAgent extends BaseAgent {
  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async process(input: unknown, context: AgentContext): Promise<DocumentClassification> {
    const extraction = input as ClinicalExtraction;
    const response = await context.complete(
      `Classify this clinical document based on the extracted data:\n\n${JSON.stringify(extraction, null, 2)}`
    );

    try {
      const parsed = JSON.parse(extractJSON(response.content));
      return {
        documentId: extraction.documentId,
        type: parsed.type || "other",
        department: parsed.department || "general",
        urgency: parsed.urgency || "routine",
        routingMetadata: parsed.routingMetadata || {},
      };
    } catch {
      return {
        documentId: extraction.documentId,
        type: "other",
        department: "general",
        urgency: "routine",
        routingMetadata: { reason: "Classification failed, defaulting to routine" },
      };
    }
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
