# HIPAA Compliance Guide

## Overview

Paperclip for HealthTech makes HIPAA compliance structural, not optional. Every agent action passes through the compliance middleware automatically. This document explains what the framework enforces and what remains the responsibility of the deploying organization.

## What the Framework Enforces

### PHI Detection

The framework detects the 18 HIPAA Safe Harbor identifiers in text:

| Identifier | Detection Method | Confidence |
|------------|-----------------|------------|
| Names | Pattern matching (Patient/Dr. prefix) | 0.80 |
| Dates of birth | DOB/Date of Birth labels | 0.90 |
| Social Security Numbers | XXX-XX-XXXX pattern | 0.95 |
| Medical Record Numbers | MRN label + digits | 0.90 |
| Phone numbers | US format patterns | 0.85 |
| Email addresses | Standard email regex | 0.95 |
| Street addresses | Number + street name pattern | 0.75 |
| ZIP codes | 5-digit and ZIP+4 | 0.50 |
| Account numbers | Account label + digits | 0.80 |
| License numbers | License/DL label + alphanumeric | 0.75 |
| IP addresses | IPv4 format | 0.80 |
| Ages over 89 | Age label + number > 89 | 0.85 |
| URLs | http/https pattern | 0.70 |

Three sensitivity levels control the confidence threshold:
- **Strict** (0.3): catches almost everything, more false positives
- **Standard** (0.6): balanced detection
- **Relaxed** (0.8): only high-confidence matches

### Access Control

Every agent declares a PHI access level:

| Level | Can Access | Use Case |
|-------|-----------|----------|
| `none` | No PHI | Utility agents, formatters |
| `metadata_only` | Document type, department, dates | Routing, classification |
| `read` | Full PHI | Extraction, analysis |
| `read_write` | Full PHI + modification | Data correction, updates |

The middleware enforces these at runtime. An agent with `metadata_only` access that receives PHI data will have it automatically redacted before the LLM call.

### Audit Logging

Every action is logged in an immutable, hash-chained audit trail:
- LLM calls (input and output)
- Tool invocations
- Inter-agent messages
- Access control decisions
- PHI redaction events

The hash chain makes the log tamper-evident: modifying any entry breaks the chain, which is detectable by `verifyIntegrity()`.

### Encryption

Helpers for AES-256-GCM encryption at rest and TLS enforcement for transit.

## What You Must Handle

The framework provides the technical building blocks, but HIPAA compliance requires organizational measures too:

1. **Business Associate Agreements (BAAs)**: you need BAAs with your LLM providers (Anthropic and OpenAI both offer these)
2. **Physical security**: server and infrastructure security
3. **Employee training**: HIPAA training for all staff with PHI access
4. **Incident response**: breach notification procedures
5. **Risk assessments**: regular security risk assessments
6. **Minimum necessary**: configuring agents with the minimum PHI access they need
7. **Data retention**: policies for how long to keep audit logs and patient data

## Configuration

```typescript
import { HIPAAMiddleware } from "paperclip-healthtech";

const middleware = new HIPAAMiddleware({
  sensitivity: "standard",      // PHI detection sensitivity
  enableAuditLog: true,         // Immutable audit logging
  enablePHIRedaction: true,     // Auto-redact PHI for unauthorized agents
  enableAccessControl: true,    // Enforce PHI access levels
  enableConsentTracking: true,  // Track patient consent
});
```

We recommend keeping all features enabled in production. The only reason to disable features is during development and testing.
