/**
 * Compliance and HIPAA types.
 */

import type { PHIAccessLevel } from "./workflow.js";

/** Sensitivity levels for PHI detection. */
export type PHISensitivity = "strict" | "standard" | "relaxed";

/** Types of PHI that can be detected (based on HIPAA Safe Harbor 18 identifiers). */
export type PHIType =
  | "name"
  | "date_of_birth"
  | "ssn"
  | "mrn"
  | "phone"
  | "email"
  | "address"
  | "zip_code"
  | "account_number"
  | "license_number"
  | "device_identifier"
  | "url"
  | "ip_address"
  | "biometric"
  | "photo"
  | "vehicle_identifier"
  | "age_over_89"
  | "other_unique";

/** A detected PHI instance in text. */
export interface PHIDetection {
  type: PHIType;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

/** Configuration for the HIPAA compliance layer. */
export interface ComplianceConfig {
  sensitivity: PHISensitivity;
  enableAuditLog: boolean;
  enablePHIRedaction: boolean;
  enableAccessControl: boolean;
  enableConsentTracking: boolean;
  auditLogPath?: string;
}

/** An entry in the immutable audit log. */
export interface AuditEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  resource: string;
  dataClassification: "phi" | "pii" | "metadata" | "public";
  phiAccessLevel: PHIAccessLevel;
  outcome: "allowed" | "denied" | "redacted";
  details?: string;
  previousHash: string;
  hash: string;
}

/** Consent record for a patient. */
export interface ConsentRecord {
  patientId: string;
  consentType: string;
  granted: boolean;
  grantedAt: number;
  expiresAt?: number;
  scope: string[];
}

/** Access control check result. */
export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  requiredLevel: PHIAccessLevel;
  actualLevel: PHIAccessLevel;
}
