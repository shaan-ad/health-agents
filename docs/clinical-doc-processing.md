# Clinical Document Processing Template

## Overview

A four-agent pipeline that processes raw clinical documents into structured, classified, and routed outputs. This is the default template included with Health Agents.

## Pipeline

```
Raw Clinical Text
       |
       v
  [Extractor]     PHI Access: read
       |
   +---+---+
   |       |
   v       v
[Classifier]  [Flagger]     Both: PHI Access: read
   |            |            (run in parallel)
   +-----+-----+
         |
         v
     [Router]     PHI Access: metadata_only
         |
         v
  Routing Decision
```

## Agents

### Extractor

Converts raw clinical text into structured data:
- Patient demographics
- Diagnoses (with ICD-10 codes when available)
- Medications (name, dosage, frequency, route, status)
- Lab results (with reference ranges and flags)
- Procedures (with CPT codes when available)

### Classifier

Categorizes the document:
- **Type**: progress note, discharge summary, lab report, etc.
- **Department**: cardiology, oncology, emergency, etc.
- **Urgency**: routine, urgent, critical

### Flagger

Identifies anomalies:
- Missing required fields
- Contradictions between sections
- Critical lab values outside safe ranges
- Potential drug interactions

### Router

Determines where the document should go:
- Destination (person, role, or queue)
- Department
- Priority level
- Rationale for the routing decision

## Usage

```typescript
import {
  WorkflowEngine,
  createClinicalDocProcessingWorkflow,
  createProvider,
  exportAsReport,
} from "health-agents";

const provider = createProvider();
const engine = new WorkflowEngine(provider);
const workflow = createClinicalDocProcessingWorkflow();

const result = await engine.execute(workflow, {
  id: "doc-001",
  type: "lab_report",
  rawText: "... clinical text ...",
});

// Access individual agent outputs
const extraction = result.agentResults.get("extractor")?.output;
const classification = result.agentResults.get("classifier")?.output;
const flags = result.agentResults.get("flagger")?.output;
const routing = result.agentResults.get("router")?.output;

// Export compliance audit
const auditReport = exportAsReport(engine.auditLogger);
```

## Customization

You can use the individual agents in your own workflows:

```typescript
import { ExtractorAgent, ClassifierAgent } from "health-agents";
import { workflow } from "health-agents";

const custom = workflow("my-pipeline")
  .agent("extract", ExtractorAgent, { phi_access: "read" })
  .agent("classify", ClassifierAgent, { phi_access: "read" })
  .edge("extract", "classify")
  .build();
```
