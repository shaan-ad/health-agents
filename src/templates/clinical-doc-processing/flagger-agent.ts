/**
 * Flagger agent: identifies anomalies, missing info, and contradictions.
 */

import { BaseAgent, type AgentContext } from "../../orchestrator/agent.js";
import type { AnomalyFlag, ClinicalExtraction } from "../../types/clinical.js";

const SYSTEM_PROMPT = `You are a clinical quality assurance specialist. Given structured clinical data, identify anomalies, missing information, and potential issues.

Check for:
1. **Missing fields**: required demographic info, missing lab reference ranges, incomplete medication info
2. **Contradictions**: medications that conflict with diagnoses, inconsistent dates
3. **Critical values**: lab results outside safe ranges (e.g., potassium > 6.0, sodium < 120, glucose < 40 or > 500, hemoglobin < 7)
4. **Drug interactions**: medications known to interact with each other
5. **Other anomalies**: unusual patterns, incomplete records

Output valid JSON array:
[
  {
    "severity": "info|warning|critical",
    "category": "missing_field|contradiction|critical_value|drug_interaction|other",
    "description": "Clear description of the issue",
    "field": "which field or data point is affected",
    "details": "additional context"
  }
]

Severity guidelines:
- "info": minor gaps that don't affect patient safety
- "warning": issues requiring clinician review
- "critical": immediate attention required (life-threatening values, dangerous interactions)

If no issues are found, return an empty array: []`;

export class FlaggerAgent extends BaseAgent {
  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async process(input: unknown, context: AgentContext): Promise<AnomalyFlag[]> {
    const extraction = input as ClinicalExtraction;
    const response = await context.complete(
      `Analyze this clinical data for anomalies and issues:\n\n${JSON.stringify(extraction, null, 2)}`
    );

    try {
      const parsed = JSON.parse(extractJSON(response.content));
      const flags: AnomalyFlag[] = (Array.isArray(parsed) ? parsed : []).map(
        (f: Record<string, string>) => ({
          documentId: extraction.documentId,
          severity: (f.severity || "info") as AnomalyFlag["severity"],
          category: (f.category || "other") as AnomalyFlag["category"],
          description: f.description || "Unknown issue",
          field: f.field,
          details: f.details,
        })
      );
      return flags;
    } catch {
      return [];
    }
  }
}

function extractJSON(text: string): string {
  if (text.includes("```json")) {
    const start = text.indexOf("```json") + 7;
    const end = text.indexOf("```", start);
    return text.slice(start, end).trim();
  }
  const bracketStart = text.indexOf("[");
  const bracketEnd = text.lastIndexOf("]") + 1;
  if (bracketStart >= 0 && bracketEnd > bracketStart) {
    return text.slice(bracketStart, bracketEnd);
  }
  return "[]";
}
