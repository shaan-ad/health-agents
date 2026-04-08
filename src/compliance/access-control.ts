/**
 * Role-based access control (RBAC) for PHI data.
 */

import type { PHIAccessLevel } from "../types/workflow.js";
import type { AccessCheckResult } from "../types/compliance.js";

/**
 * PHI access level hierarchy (higher number = more access).
 */
const ACCESS_HIERARCHY: Record<PHIAccessLevel, number> = {
  none: 0,
  metadata_only: 1,
  read: 2,
  read_write: 3,
};

/**
 * Check if an agent's access level is sufficient for the required level.
 */
export function checkAccess(
  agentId: string,
  agentLevel: PHIAccessLevel,
  requiredLevel: PHIAccessLevel
): AccessCheckResult {
  const agentRank = ACCESS_HIERARCHY[agentLevel];
  const requiredRank = ACCESS_HIERARCHY[requiredLevel];

  if (agentRank >= requiredRank) {
    return {
      allowed: true,
      reason: `Agent "${agentId}" has ${agentLevel} access (requires ${requiredLevel})`,
      requiredLevel,
      actualLevel: agentLevel,
    };
  }

  return {
    allowed: false,
    reason: `Agent "${agentId}" has ${agentLevel} access but requires ${requiredLevel}`,
    requiredLevel,
    actualLevel: agentLevel,
  };
}

/**
 * Determine the minimum access level needed based on data content.
 *
 * - "none": no PHI present
 * - "metadata_only": only document metadata (type, department, dates)
 * - "read": contains PHI that needs to be read
 * - "read_write": contains PHI that may be modified
 */
export function determineRequiredAccess(
  containsPHI: boolean,
  isMetadataOnly: boolean,
  requiresModification: boolean
): PHIAccessLevel {
  if (!containsPHI) return "none";
  if (isMetadataOnly) return "metadata_only";
  if (requiresModification) return "read_write";
  return "read";
}

/**
 * Compare two access levels. Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
export function compareAccessLevels(
  a: PHIAccessLevel,
  b: PHIAccessLevel
): number {
  return ACCESS_HIERARCHY[a] - ACCESS_HIERARCHY[b];
}
