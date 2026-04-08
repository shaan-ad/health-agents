/**
 * PHI redaction for logs, reports, and unauthorized agent contexts.
 */

import type { PHIDetection, PHISensitivity } from "../types/compliance.js";
import { detectPHI } from "./phi-detector.js";

/** Redaction replacement labels by PHI type. */
const REDACTION_LABELS: Record<string, string> = {
  name: "[REDACTED_NAME]",
  date_of_birth: "[REDACTED_DOB]",
  ssn: "[REDACTED_SSN]",
  mrn: "[REDACTED_MRN]",
  phone: "[REDACTED_PHONE]",
  email: "[REDACTED_EMAIL]",
  address: "[REDACTED_ADDRESS]",
  zip_code: "[REDACTED_ZIP]",
  account_number: "[REDACTED_ACCOUNT]",
  license_number: "[REDACTED_LICENSE]",
  device_identifier: "[REDACTED_DEVICE]",
  url: "[REDACTED_URL]",
  ip_address: "[REDACTED_IP]",
  biometric: "[REDACTED_BIOMETRIC]",
  photo: "[REDACTED_PHOTO]",
  vehicle_identifier: "[REDACTED_VEHICLE]",
  age_over_89: "[REDACTED_AGE]",
  other_unique: "[REDACTED]",
};

/**
 * Redact all detected PHI from text.
 *
 * Returns the redacted text and the list of detections that were redacted.
 */
export function redactPHI(
  text: string,
  sensitivity: PHISensitivity = "standard"
): { redacted: string; detections: PHIDetection[] } {
  const detections = detectPHI(text, sensitivity);

  if (detections.length === 0) {
    return { redacted: text, detections: [] };
  }

  // Build redacted text by replacing detections from end to start
  // (to preserve indices)
  let redacted = text;
  for (let i = detections.length - 1; i >= 0; i--) {
    const detection = detections[i];
    const label = REDACTION_LABELS[detection.type] || "[REDACTED]";
    redacted =
      redacted.slice(0, detection.startIndex) +
      label +
      redacted.slice(detection.endIndex);
  }

  return { redacted, detections };
}

/**
 * Redact PHI from a structured object by recursively processing string values.
 */
export function redactObjectPHI(
  obj: unknown,
  sensitivity: PHISensitivity = "standard"
): unknown {
  if (typeof obj === "string") {
    return redactPHI(obj, sensitivity).redacted;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObjectPHI(item, sensitivity));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactObjectPHI(value, sensitivity);
    }
    return result;
  }

  return obj;
}
