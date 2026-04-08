# Getting Started

## Installation

```bash
npm install paperclip-healthtech
```

Install your preferred LLM provider:

```bash
# For Anthropic Claude
npm install @anthropic-ai/sdk

# For OpenAI
npm install openai
```

## Configuration

```bash
# Set provider and API key
export PAPERCLIP_HT_PROVIDER=anthropic
export ANTHROPIC_API_KEY=your-key-here
```

## Quick Start

### 1. Use the built-in clinical document processing template

```typescript
import {
  WorkflowEngine,
  createClinicalDocProcessingWorkflow,
  createProvider,
} from "paperclip-healthtech";

const provider = createProvider();
const engine = new WorkflowEngine(provider);
const workflow = createClinicalDocProcessingWorkflow();

const result = await engine.execute(workflow, {
  id: "doc-001",
  type: "progress_note",
  rawText: `
    Patient: Jane Smith
    MRN: 12345678
    DOB: 03/15/1985

    Chief Complaint: Persistent headaches for 2 weeks.
    Assessment: Tension-type headache. Rule out migraine.
    Plan: Start acetaminophen 500mg PRN. Follow up in 2 weeks.
  `,
});

console.log("Success:", result.success);
console.log("Routing:", result.agentResults.get("router")?.output);
```

### 2. Build a custom workflow

```typescript
import { workflow, BaseAgent, WorkflowEngine, type AgentContext } from "paperclip-healthtech";

class MyAgent extends BaseAgent {
  getSystemPrompt() {
    return "You are a helpful clinical assistant.";
  }

  async process(input: unknown, context: AgentContext) {
    const response = await context.complete(JSON.stringify(input));
    return { result: response.content };
  }
}

const myWorkflow = workflow("custom")
  .agent("assistant", MyAgent, { phi_access: "read" })
  .build();

const engine = new WorkflowEngine(provider);
const result = await engine.execute(myWorkflow, "Analyze this patient record");
```

### 3. Export audit logs

```typescript
import { exportAsJSON, exportAsCSV, exportAsReport } from "paperclip-healthtech";

// After running a workflow...
const json = exportAsJSON(engine.auditLogger);
const csv = exportAsCSV(engine.auditLogger);
const report = exportAsReport(engine.auditLogger);

// Write to files
fs.writeFileSync("audit.json", json);
fs.writeFileSync("audit.csv", csv);
fs.writeFileSync("audit-report.md", report);
```
