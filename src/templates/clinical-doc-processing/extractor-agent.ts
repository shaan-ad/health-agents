/**
 * Extractor agent: extracts structured data from clinical text.
 */

import { BaseAgent, type AgentContext } from "../../orchestrator/agent.js";
import type { ClinicalDocument, ClinicalExtraction } from "../../types/clinical.js";

const SYSTEM_PROMPT = `You are a clinical data extraction specialist. Given raw clinical text (progress notes, discharge summaries, lab reports), extract structured medical information.

Extract the following categories:
- Patient demographics (name, DOB, MRN, gender)
- Diagnoses (ICD-10 codes if mentioned, descriptions, status)
- Medications (name, dosage, frequency, route, status)
- Lab results (test name, value, unit, reference range, flags)
- Procedures (CPT codes if mentioned, descriptions, dates, status)

Output your extraction as valid JSON matching this structure:
{
  "patient": { "name": "...", "dateOfBirth": "...", "mrn": "...", "gender": "..." },
  "diagnoses": [{ "code": "...", "description": "...", "status": "active|resolved|suspected" }],
  "medications": [{ "name": "...", "dosage": "...", "frequency": "...", "route": "...", "status": "active|discontinued|prescribed" }],
  "labResults": [{ "testName": "...", "value": "...", "unit": "...", "referenceRange": "...", "flag": "normal|high|low|critical_high|critical_low" }],
  "procedures": [{ "code": "...", "description": "...", "date": "...", "status": "completed|planned|in_progress" }],
  "summary": "Brief 1-2 sentence summary of the document"
}

Rules:
- Only extract information explicitly present in the text
- Use null for fields not mentioned
- Flag lab values outside reference ranges
- Note the active/inactive status of medications and diagnoses`;

export class ExtractorAgent extends BaseAgent {
  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async process(input: unknown, context: AgentContext): Promise<ClinicalExtraction> {
    const doc = input as ClinicalDocument;
    const response = await context.complete(
      `Extract structured clinical data from the following document:\n\n${doc.rawText}`
    );

    try {
      const parsed = JSON.parse(extractJSON(response.content));
      return {
        documentId: doc.id,
        patient: parsed.patient || undefined,
        diagnoses: parsed.diagnoses || [],
        medications: parsed.medications || [],
        labResults: parsed.labResults || [],
        procedures: parsed.procedures || [],
        summary: parsed.summary,
      };
    } catch {
      return {
        documentId: doc.id,
        diagnoses: [],
        medications: [],
        labResults: [],
        procedures: [],
        summary: response.content.slice(0, 200),
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
  if (text.includes("```")) {
    const start = text.indexOf("```") + 3;
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
