/**
 * Export audit logs in multiple formats for compliance reviews.
 */

import type { AuditEntry } from "../types/compliance.js";
import type { AuditLogger } from "./audit-logger.js";

/**
 * Export audit entries as JSON.
 */
export function exportAsJSON(logger: AuditLogger): string {
  const entries = logger.getEntries();
  const integrity = logger.verifyIntegrity();

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      integrityValid: integrity.valid,
      entries,
    },
    null,
    2
  );
}

/**
 * Export audit entries as CSV.
 */
export function exportAsCSV(logger: AuditLogger): string {
  const entries = logger.getEntries();
  const headers = [
    "id",
    "timestamp",
    "actor",
    "action",
    "resource",
    "dataClassification",
    "phiAccessLevel",
    "outcome",
    "details",
    "hash",
  ];

  const rows = entries.map((entry) =>
    headers.map((h) => {
      const value = entry[h as keyof AuditEntry];
      if (value === undefined || value === null) return "";
      const str = typeof value === "number" ? new Date(value).toISOString() : String(value);
      // Escape CSV values
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Export audit entries as a structured markdown report.
 * (Designed to be convertible to PDF by external tools.)
 */
export function exportAsReport(logger: AuditLogger): string {
  const entries = logger.getEntries();
  const integrity = logger.verifyIntegrity();

  const lines: string[] = [];
  lines.push("# HIPAA Compliance Audit Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total Entries:** ${entries.length}`);
  lines.push(`**Chain Integrity:** ${integrity.valid ? "VALID" : "BROKEN"}`);
  if (!integrity.valid && integrity.brokenAt !== undefined) {
    lines.push(`**Chain broken at entry:** ${integrity.brokenAt}`);
  }
  lines.push("");

  // Summary statistics
  const denied = entries.filter((e) => e.outcome === "denied").length;
  const redacted = entries.filter((e) => e.outcome === "redacted").length;
  const phiAccess = entries.filter(
    (e) => e.dataClassification === "phi"
  ).length;

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total actions logged | ${entries.length} |`);
  lines.push(`| Access denied | ${denied} |`);
  lines.push(`| PHI redacted | ${redacted} |`);
  lines.push(`| PHI access events | ${phiAccess} |`);
  lines.push("");

  // Access by actor
  const actorCounts = new Map<string, number>();
  for (const entry of entries) {
    actorCounts.set(entry.actor, (actorCounts.get(entry.actor) || 0) + 1);
  }

  lines.push("## Activity by Actor");
  lines.push("");
  lines.push("| Actor | Actions |");
  lines.push("|-------|---------|");
  for (const [actor, count] of actorCounts.entries()) {
    lines.push(`| ${actor} | ${count} |`);
  }
  lines.push("");

  // Denied access events (critical for auditors)
  const deniedEntries = entries.filter((e) => e.outcome === "denied");
  if (deniedEntries.length > 0) {
    lines.push("## Denied Access Events");
    lines.push("");
    lines.push("| Timestamp | Actor | Action | Resource | Details |");
    lines.push("|-----------|-------|--------|----------|---------|");
    for (const entry of deniedEntries) {
      const ts = new Date(entry.timestamp).toISOString();
      lines.push(
        `| ${ts} | ${entry.actor} | ${entry.action} | ${entry.resource} | ${entry.details || ""} |`
      );
    }
    lines.push("");
  }

  // Recent entries (last 20)
  const recent = entries.slice(-20);
  lines.push("## Recent Entries (Last 20)");
  lines.push("");
  lines.push("| Timestamp | Actor | Action | Outcome |");
  lines.push("|-----------|-------|--------|---------|");
  for (const entry of recent) {
    const ts = new Date(entry.timestamp).toISOString();
    lines.push(`| ${ts} | ${entry.actor} | ${entry.action} | ${entry.outcome} |`);
  }
  lines.push("");

  return lines.join("\n");
}
