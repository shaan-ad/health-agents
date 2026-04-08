import { describe, it, expect } from "vitest";
import { redactPHI, redactObjectPHI } from "../../src/compliance/phi-redactor.js";

describe("PHI Redactor", () => {
  it("redacts SSNs", () => {
    const { redacted } = redactPHI("SSN: 123-45-6789");
    expect(redacted).toContain("[REDACTED_SSN]");
    expect(redacted).not.toContain("123-45-6789");
  });

  it("redacts email addresses", () => {
    const { redacted } = redactPHI("Email: john@hospital.com");
    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).not.toContain("john@hospital.com");
  });

  it("redacts phone numbers", () => {
    const { redacted } = redactPHI("Call 555-123-4567 for info");
    expect(redacted).toContain("[REDACTED_PHONE]");
    expect(redacted).not.toContain("555-123-4567");
  });

  it("returns detections list", () => {
    const { detections } = redactPHI("SSN: 123-45-6789, Email: test@test.com");
    expect(detections.length).toBeGreaterThanOrEqual(2);
  });

  it("handles text with no PHI", () => {
    const { redacted, detections } = redactPHI("No sensitive data here");
    expect(redacted).toBe("No sensitive data here");
    expect(detections).toHaveLength(0);
  });

  it("redacts multiple PHI instances", () => {
    const text = "SSN: 123-45-6789 and also 987-65-4321";
    const { redacted } = redactPHI(text);
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).not.toContain("987-65-4321");
  });

  describe("redactObjectPHI", () => {
    it("redacts PHI in string values", () => {
      const result = redactObjectPHI("SSN: 123-45-6789");
      expect(result).toContain("[REDACTED_SSN]");
    });

    it("redacts PHI in nested objects", () => {
      const obj = {
        patient: {
          name: "Patient: John Smith",
          ssn: "SSN is 123-45-6789",
        },
        notes: "Contact at 555-123-4567",
      };
      const result = redactObjectPHI(obj) as Record<string, unknown>;
      const patient = result.patient as Record<string, string>;
      expect(patient.ssn).toContain("[REDACTED_SSN]");
      expect(result.notes).toContain("[REDACTED_PHONE]");
    });

    it("redacts PHI in arrays", () => {
      const arr = ["SSN: 123-45-6789", "clean text"];
      const result = redactObjectPHI(arr) as string[];
      expect(result[0]).toContain("[REDACTED_SSN]");
      expect(result[1]).toBe("clean text");
    });

    it("passes through non-string primitives", () => {
      expect(redactObjectPHI(42)).toBe(42);
      expect(redactObjectPHI(true)).toBe(true);
      expect(redactObjectPHI(null)).toBe(null);
    });
  });
});
