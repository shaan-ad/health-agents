import { describe, it, expect } from "vitest";
import { detectPHI, containsPHI } from "../../src/compliance/phi-detector.js";

describe("PHI Detector", () => {
  describe("SSN detection", () => {
    it("detects SSN format XXX-XX-XXXX", () => {
      const detections = detectPHI("Patient SSN: 123-45-6789");
      const ssn = detections.find((d) => d.type === "ssn");
      expect(ssn).toBeDefined();
      expect(ssn!.value).toBe("123-45-6789");
    });
  });

  describe("MRN detection", () => {
    it("detects MRN with label", () => {
      const detections = detectPHI("MRN: 12345678");
      const mrn = detections.find((d) => d.type === "mrn");
      expect(mrn).toBeDefined();
    });

    it("detects Medical Record Number label", () => {
      const detections = detectPHI("Medical Record Number 98765432");
      const mrn = detections.find((d) => d.type === "mrn");
      expect(mrn).toBeDefined();
    });
  });

  describe("email detection", () => {
    it("detects email addresses", () => {
      const detections = detectPHI("Contact: john.doe@hospital.com");
      const email = detections.find((d) => d.type === "email");
      expect(email).toBeDefined();
      expect(email!.value).toBe("john.doe@hospital.com");
    });
  });

  describe("phone detection", () => {
    it("detects US phone numbers", () => {
      const detections = detectPHI("Call (555) 123-4567");
      const phone = detections.find((d) => d.type === "phone");
      expect(phone).toBeDefined();
    });

    it("detects phone with dashes", () => {
      const detections = detectPHI("Phone: 555-123-4567");
      const phone = detections.find((d) => d.type === "phone");
      expect(phone).toBeDefined();
    });
  });

  describe("DOB detection", () => {
    it("detects DOB with label", () => {
      const detections = detectPHI("DOB: 03/15/1990");
      const dob = detections.find((d) => d.type === "date_of_birth");
      expect(dob).toBeDefined();
    });

    it("detects Date of Birth label", () => {
      const detections = detectPHI("Date of Birth: 1990-03-15");
      const dob = detections.find((d) => d.type === "date_of_birth");
      expect(dob).toBeDefined();
    });
  });

  describe("IP address detection", () => {
    it("detects IPv4 addresses", () => {
      const detections = detectPHI("Server: 192.168.1.100");
      const ip = detections.find((d) => d.type === "ip_address");
      expect(ip).toBeDefined();
      expect(ip!.value).toBe("192.168.1.100");
    });
  });

  describe("name detection", () => {
    it("detects patient names", () => {
      const detections = detectPHI("Patient: John Smith", "strict");
      const name = detections.find((d) => d.type === "name");
      expect(name).toBeDefined();
    });
  });

  describe("address detection", () => {
    it("detects street addresses", () => {
      const detections = detectPHI("Lives at 123 Main Street", "strict");
      const addr = detections.find((d) => d.type === "address");
      expect(addr).toBeDefined();
    });
  });

  describe("sensitivity levels", () => {
    it("strict mode catches more items", () => {
      const text = "Patient: John Smith, 12345, 192.168.1.1";
      const strict = detectPHI(text, "strict");
      const relaxed = detectPHI(text, "relaxed");
      expect(strict.length).toBeGreaterThanOrEqual(relaxed.length);
    });
  });

  describe("containsPHI", () => {
    it("returns true when PHI is present", () => {
      expect(containsPHI("SSN: 123-45-6789")).toBe(true);
    });

    it("returns false when no PHI is present", () => {
      expect(containsPHI("The weather is nice today")).toBe(false);
    });
  });

  describe("complex clinical text", () => {
    it("detects multiple PHI types in clinical notes", () => {
      const clinicalNote = `
        Patient: Jane Doe
        MRN: 87654321
        DOB: 05/22/1985
        Phone: (555) 987-6543
        Email: jane.doe@email.com
        SSN: 987-65-4321

        Assessment: Patient presents with elevated blood pressure.
      `;
      const detections = detectPHI(clinicalNote, "standard");
      const types = new Set(detections.map((d) => d.type));

      expect(types.has("ssn")).toBe(true);
      expect(types.has("mrn")).toBe(true);
      expect(types.has("email")).toBe(true);
      expect(types.has("phone")).toBe(true);
    });
  });
});
