# Architecture

Health Agents is a three-layer framework: an orchestration engine, a HIPAA compliance middleware, and clinical workflow templates.

## System Overview

```
                   +-----------------+
                   | Workflow Engine  |
                   +--------+--------+
                            |
            +---------------+---------------+
            |                               |
    +-------+-------+              +--------+--------+
    | DAG Scheduler |              | HIPAA Middleware |
    +-------+-------+              +--------+--------+
            |                               |
    +-------+-------+    +--------+---------+--------+
    | Message Bus   |    | PHI     | Access  | Audit |
    +---------------+    | Detect  | Control | Log   |
                         +--------+---------+--------+
            |
    +-------+-------+
    | Agent Runtime  |
    +---------------+
```

## Orchestrator Layer

### Workflow Engine (`orchestrator/engine.ts`)

Executes workflows defined as directed acyclic graphs (DAGs). Each node is an agent, each edge is a data dependency. The engine:
1. Computes execution stages from the DAG (topological sort)
2. Runs agents within each stage in parallel
3. Passes output from upstream agents as input to downstream agents
4. Wraps every LLM call through the HIPAA middleware

### Workflow Builder (`orchestrator/workflow.ts`)

Fluent API for defining workflows:

```typescript
const wf = workflow("my-workflow")
  .agent("a", AgentA, { phi_access: "read" })
  .agent("b", AgentB, { phi_access: "metadata_only" })
  .edge("a", "b")
  .build();
```

### Scheduler (`orchestrator/scheduler.ts`)

Computes parallel execution stages from the DAG using Kahn's algorithm. Agents in the same stage have no dependencies on each other and can run concurrently.

### Message Bus (`orchestrator/message-bus.ts`)

Typed inter-agent messaging. Messages have types and the bus validates payloads against registered schemas. This prevents agents from passing malformed data to each other.

### Agent Base Class (`orchestrator/agent.ts`)

Every agent extends `BaseAgent` and implements:
- `process(input, context)`: the main logic
- `getSystemPrompt()`: the LLM system prompt
- `getTools()`: optional tool definitions

## Compliance Layer

This is the core differentiator. Every agent action passes through the compliance middleware automatically.

### HIPAA Middleware (`compliance/hipaa-middleware.ts`)

Wraps every LLM call with:
1. PHI detection in input messages
2. Access control check against the agent's declared PHI access level
3. Automatic PHI redaction for agents with insufficient access
4. Audit logging of every call and response

### PHI Detector (`compliance/phi-detector.ts`)

Pattern-matching detection for HIPAA Safe Harbor identifiers: SSN, MRN, DOB, phone, email, address, IP, and more. Three sensitivity levels: strict, standard, relaxed.

### Access Control (`compliance/access-control.ts`)

Role-based access control with four levels: `none`, `metadata_only`, `read`, `read_write`. Each agent declares its required access level at workflow definition time. The middleware enforces this at runtime.

### Audit Logger (`compliance/audit-logger.ts`)

Immutable, append-only log with hash chain for tamper detection. Every action is recorded with actor, action, resource, classification, and outcome. Exportable as JSON, CSV, or markdown report.

## Provider Layer

LLM providers implement the `LLMProvider` interface. Built-in adapters for Anthropic Claude and OpenAI. Provider choice is configurable via environment variables.

## Template Layer

Pre-built clinical workflows that can be used directly or as references for custom workflows. The MVP includes a clinical document processing pipeline with four agents (extractor, classifier, flagger, router).
