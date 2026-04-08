/**
 * Patient consent tracking for HIPAA compliance.
 */

import type { ConsentRecord } from "../types/compliance.js";

/**
 * Tracks patient consent for data processing.
 */
export class ConsentTracker {
  private records: Map<string, ConsentRecord[]> = new Map();

  /**
   * Record a consent grant or revocation.
   */
  recordConsent(record: ConsentRecord): void {
    const existing = this.records.get(record.patientId) || [];
    existing.push(record);
    this.records.set(record.patientId, existing);
  }

  /**
   * Check if a patient has active consent for a specific scope.
   */
  hasConsent(patientId: string, scope: string): boolean {
    const records = this.records.get(patientId);
    if (!records) return false;

    const now = Date.now();

    // Find the most recent consent record for this scope
    const relevant = records
      .filter(
        (r) =>
          r.scope.includes(scope) &&
          (!r.expiresAt || r.expiresAt > now)
      )
      .sort((a, b) => b.grantedAt - a.grantedAt);

    if (relevant.length === 0) return false;
    return relevant[0].granted;
  }

  /**
   * Get all consent records for a patient.
   */
  getRecords(patientId: string): ReadonlyArray<ConsentRecord> {
    return [...(this.records.get(patientId) || [])];
  }

  /**
   * Revoke consent for a patient and scope.
   */
  revokeConsent(patientId: string, consentType: string, scope: string[]): void {
    this.recordConsent({
      patientId,
      consentType,
      granted: false,
      grantedAt: Date.now(),
      scope,
    });
  }
}
