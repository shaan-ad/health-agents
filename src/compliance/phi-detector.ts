/**
 * PHI detection using pattern matching for HIPAA Safe Harbor identifiers.
 */

import type { PHIDetection, PHISensitivity, PHIType } from "../types/compliance.js";

interface PHIPattern {
  type: PHIType;
  pattern: RegExp;
  confidence: number;
}

/**
 * Patterns for detecting PHI in text.
 * Ordered by specificity (most specific first).
 */
const PHI_PATTERNS: PHIPattern[] = [
  // SSN: XXX-XX-XXXX
  {
    type: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    confidence: 0.95,
  },
  // MRN: common patterns (MRN followed by digits)
  {
    type: "mrn",
    pattern: /\b(?:MRN|mrn|Medical Record Number)[:\s#]*(\d{4,12})\b/g,
    confidence: 0.9,
  },
  // Date of birth patterns
  {
    type: "date_of_birth",
    pattern:
      /\b(?:DOB|D\.O\.B\.|Date of Birth|born)[:\s]*(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})\b/gi,
    confidence: 0.9,
  },
  // Email addresses
  {
    type: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.95,
  },
  // Phone numbers (US format)
  {
    type: "phone",
    pattern:
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    confidence: 0.85,
  },
  // IP addresses
  {
    type: "ip_address",
    pattern:
      /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    confidence: 0.8,
  },
  // ZIP codes (5-digit and ZIP+4)
  {
    type: "zip_code",
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    confidence: 0.5,  // Low confidence since many 5-digit numbers aren't ZIPs
  },
  // Account numbers (generic pattern)
  {
    type: "account_number",
    pattern: /\b(?:account|acct)[:\s#]*(\d{6,20})\b/gi,
    confidence: 0.8,
  },
  // License/ID numbers
  {
    type: "license_number",
    pattern: /\b(?:license|DL|driver's license)[:\s#]*([A-Z0-9]{5,15})\b/gi,
    confidence: 0.75,
  },
  // URLs
  {
    type: "url",
    pattern: /https?:\/\/[^\s]+/g,
    confidence: 0.7,
  },
  // Ages over 89
  {
    type: "age_over_89",
    pattern: /\b(?:age|aged?)[:\s]*([89]\d|[1-9]\d{2,})\b/gi,
    confidence: 0.85,
  },
];

/**
 * Name patterns (run separately because they require more context).
 */
const NAME_PATTERNS: PHIPattern[] = [
  // "Patient: Name" or "Name: John Doe"
  {
    type: "name",
    pattern:
      /\b(?:patient|name|pt)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/gi,
    confidence: 0.8,
  },
  // "Dr. Name" or "Doctor Name"
  {
    type: "name",
    pattern: /\b(?:Dr\.?|Doctor)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g,
    confidence: 0.85,
  },
];

/**
 * Address patterns (more complex, lower confidence).
 */
const ADDRESS_PATTERNS: PHIPattern[] = [
  {
    type: "address",
    pattern:
      /\b\d{1,5}\s+[A-Z][a-zA-Z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\.?\b/gi,
    confidence: 0.75,
  },
];

/**
 * Confidence thresholds by sensitivity level.
 */
const CONFIDENCE_THRESHOLDS: Record<PHISensitivity, number> = {
  strict: 0.3,    // Catch everything, more false positives
  standard: 0.6,  // Balanced
  relaxed: 0.8,   // Only high-confidence matches
};

/**
 * Detect PHI in text based on the configured sensitivity level.
 */
export function detectPHI(
  text: string,
  sensitivity: PHISensitivity = "standard"
): PHIDetection[] {
  const threshold = CONFIDENCE_THRESHOLDS[sensitivity];
  const detections: PHIDetection[] = [];
  const allPatterns = [...PHI_PATTERNS, ...NAME_PATTERNS, ...ADDRESS_PATTERNS];

  for (const { type, pattern, confidence } of allPatterns) {
    if (confidence < threshold) continue;

    // Reset regex state for global patterns
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type,
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence,
      });
    }
  }

  // Sort by position in text
  detections.sort((a, b) => a.startIndex - b.startIndex);

  // Remove overlapping detections (keep higher confidence)
  return deduplicateDetections(detections);
}

/**
 * Check if text contains any PHI.
 */
export function containsPHI(
  text: string,
  sensitivity: PHISensitivity = "standard"
): boolean {
  return detectPHI(text, sensitivity).length > 0;
}

/**
 * Remove overlapping detections, keeping the one with higher confidence.
 */
function deduplicateDetections(detections: PHIDetection[]): PHIDetection[] {
  if (detections.length <= 1) return detections;

  const result: PHIDetection[] = [detections[0]];

  for (let i = 1; i < detections.length; i++) {
    const current = detections[i];
    const previous = result[result.length - 1];

    // Check for overlap
    if (current.startIndex < previous.endIndex) {
      // Keep the one with higher confidence
      if (current.confidence > previous.confidence) {
        result[result.length - 1] = current;
      }
    } else {
      result.push(current);
    }
  }

  return result;
}
