/**
 * Immutable, append-only audit logger with hash chain for tamper detection.
 */

import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { AuditEntry } from "../types/compliance.js";
import type { PHIAccessLevel } from "../types/workflow.js";

/**
 * Compute SHA-256 hash of an audit entry for chain integrity.
 */
function computeHash(entry: Omit<AuditEntry, "hash">): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    dataClassification: entry.dataClassification,
    phiAccessLevel: entry.phiAccessLevel,
    outcome: entry.outcome,
    details: entry.details,
    previousHash: entry.previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Immutable audit logger that maintains a hash chain.
 *
 * Every entry references the hash of the previous entry,
 * making the log tamper-evident.
 */
export class AuditLogger {
  private entries: AuditEntry[] = [];
  private lastHash: string = "genesis";

  /**
   * Log an audit entry. Returns the created entry.
   */
  log(params: {
    actor: string;
    action: string;
    resource: string;
    dataClassification: AuditEntry["dataClassification"];
    phiAccessLevel: PHIAccessLevel;
    outcome: AuditEntry["outcome"];
    details?: string;
  }): AuditEntry {
    const entryWithoutHash: Omit<AuditEntry, "hash"> = {
      id: uuidv4(),
      timestamp: Date.now(),
      actor: params.actor,
      action: params.action,
      resource: params.resource,
      dataClassification: params.dataClassification,
      phiAccessLevel: params.phiAccessLevel,
      outcome: params.outcome,
      details: params.details,
      previousHash: this.lastHash,
    };

    const hash = computeHash(entryWithoutHash);
    const entry: AuditEntry = { ...entryWithoutHash, hash };

    this.entries.push(entry);
    this.lastHash = hash;

    return entry;
  }

  /**
   * Get all audit entries (read-only copy).
   */
  getEntries(): ReadonlyArray<AuditEntry> {
    return [...this.entries];
  }

  /**
   * Get the number of entries in the log.
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Verify the integrity of the hash chain.
   *
   * Returns true if no entries have been tampered with.
   */
  verifyIntegrity(): { valid: boolean; brokenAt?: number } {
    let expectedPrevHash = "genesis";

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Check previous hash link
      if (entry.previousHash !== expectedPrevHash) {
        return { valid: false, brokenAt: i };
      }

      // Verify entry hash
      const { hash, ...rest } = entry;
      const computed = computeHash(rest as Omit<AuditEntry, "hash">);
      if (computed !== hash) {
        return { valid: false, brokenAt: i };
      }

      expectedPrevHash = hash;
    }

    return { valid: true };
  }

  /**
   * Query entries by actor.
   */
  getByActor(actor: string): AuditEntry[] {
    return this.entries.filter((e) => e.actor === actor);
  }

  /**
   * Query entries by time range.
   */
  getByTimeRange(start: number, end: number): AuditEntry[] {
    return this.entries.filter(
      (e) => e.timestamp >= start && e.timestamp <= end
    );
  }

  /**
   * Query entries that were denied.
   */
  getDenied(): AuditEntry[] {
    return this.entries.filter((e) => e.outcome === "denied");
  }
}
