import { describe, it, expect } from "vitest";
import {
  checkAccess,
  compareAccessLevels,
  determineRequiredAccess,
} from "../../src/compliance/access-control.js";

describe("Access Control", () => {
  describe("checkAccess", () => {
    it("allows when agent has sufficient access", () => {
      const result = checkAccess("agent-1", "read", "read");
      expect(result.allowed).toBe(true);
    });

    it("allows when agent has higher access than required", () => {
      const result = checkAccess("agent-1", "read_write", "read");
      expect(result.allowed).toBe(true);
    });

    it("denies when agent has insufficient access", () => {
      const result = checkAccess("agent-1", "none", "read");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("agent-1");
    });

    it("denies metadata_only agent from read access", () => {
      const result = checkAccess("agent-1", "metadata_only", "read");
      expect(result.allowed).toBe(false);
    });

    it("allows metadata_only agent for metadata_only access", () => {
      const result = checkAccess("agent-1", "metadata_only", "metadata_only");
      expect(result.allowed).toBe(true);
    });

    it("allows none access when none is required", () => {
      const result = checkAccess("agent-1", "none", "none");
      expect(result.allowed).toBe(true);
    });
  });

  describe("determineRequiredAccess", () => {
    it("returns none when no PHI", () => {
      expect(determineRequiredAccess(false, false, false)).toBe("none");
    });

    it("returns metadata_only for metadata", () => {
      expect(determineRequiredAccess(true, true, false)).toBe("metadata_only");
    });

    it("returns read for PHI read access", () => {
      expect(determineRequiredAccess(true, false, false)).toBe("read");
    });

    it("returns read_write for PHI modification", () => {
      expect(determineRequiredAccess(true, false, true)).toBe("read_write");
    });
  });

  describe("compareAccessLevels", () => {
    it("returns 0 for equal levels", () => {
      expect(compareAccessLevels("read", "read")).toBe(0);
    });

    it("returns positive when a > b", () => {
      expect(compareAccessLevels("read_write", "read")).toBeGreaterThan(0);
    });

    it("returns negative when a < b", () => {
      expect(compareAccessLevels("none", "read")).toBeLessThan(0);
    });

    it("orders correctly: none < metadata_only < read < read_write", () => {
      expect(compareAccessLevels("none", "metadata_only")).toBeLessThan(0);
      expect(compareAccessLevels("metadata_only", "read")).toBeLessThan(0);
      expect(compareAccessLevels("read", "read_write")).toBeLessThan(0);
    });
  });
});
