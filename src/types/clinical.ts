/**
 * Clinical data types, FHIR-aligned where practical.
 */

/** Patient demographics. */
export interface Patient {
  id: string;
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  mrn?: string;  // Medical Record Number
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
}

/** A clinical document (progress note, discharge summary, lab report, etc.). */
export interface ClinicalDocument {
  id: string;
  type: DocumentType;
  rawText: string;
  patient?: Patient;
  date?: string;
  author?: string;
  department?: string;
  metadata?: Record<string, unknown>;
}

/** Types of clinical documents. */
export type DocumentType =
  | "progress_note"
  | "discharge_summary"
  | "lab_report"
  | "radiology_report"
  | "pathology_report"
  | "consultation_note"
  | "operative_note"
  | "referral"
  | "prescription"
  | "other";

/** A diagnosis extracted from a clinical document. */
export interface Diagnosis {
  code?: string;      // ICD-10 code
  description: string;
  status: "active" | "resolved" | "suspected";
  date?: string;
}

/** A medication from a clinical document. */
export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status: "active" | "discontinued" | "prescribed";
  startDate?: string;
  endDate?: string;
}

/** A lab result from a clinical document. */
export interface LabResult {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: "normal" | "high" | "low" | "critical_high" | "critical_low";
  date?: string;
}

/** A procedure from a clinical document. */
export interface Procedure {
  code?: string;      // CPT code
  description: string;
  date?: string;
  status: "completed" | "planned" | "in_progress";
}

/** Structured extraction from a clinical document. */
export interface ClinicalExtraction {
  documentId: string;
  patient?: Patient;
  diagnoses: Diagnosis[];
  medications: Medication[];
  labResults: LabResult[];
  procedures: Procedure[];
  summary?: string;
}

/** Document classification result. */
export interface DocumentClassification {
  documentId: string;
  type: DocumentType;
  department: string;
  urgency: "routine" | "urgent" | "critical";
  routingMetadata: Record<string, string>;
}

/** Anomaly flag from the flagger agent. */
export interface AnomalyFlag {
  documentId: string;
  severity: "info" | "warning" | "critical";
  category: "missing_field" | "contradiction" | "critical_value" | "drug_interaction" | "other";
  description: string;
  field?: string;
  details?: string;
}

/** Routing decision from the router agent. */
export interface RoutingDecision {
  documentId: string;
  destination: string;
  department: string;
  priority: "low" | "normal" | "high" | "urgent";
  rationale: string;
  flags: AnomalyFlag[];
}
