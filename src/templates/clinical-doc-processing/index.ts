/**
 * Clinical Document Processing workflow template.
 *
 * Four-agent pipeline:
 * 1. Extractor: raw text -> structured clinical data
 * 2. Classifier: structured data -> document classification (parallel with Flagger)
 * 3. Flagger: structured data -> anomaly flags (parallel with Classifier)
 * 4. Router: classification + flags -> routing decision
 */

import { workflow, type BuiltWorkflow } from "../../orchestrator/workflow.js";
import { ExtractorAgent } from "./extractor-agent.js";
import { ClassifierAgent } from "./classifier-agent.js";
import { FlaggerAgent } from "./flagger-agent.js";
import { RouterAgent } from "./router-agent.js";

/**
 * Create the clinical document processing workflow.
 */
export function createClinicalDocProcessingWorkflow(): BuiltWorkflow {
  return workflow("clinical-doc-processing")
    .agent("extractor", ExtractorAgent, { phi_access: "read" })
    .agent("classifier", ClassifierAgent, { phi_access: "read" })
    .agent("flagger", FlaggerAgent, { phi_access: "read" })
    .agent("router", RouterAgent, { phi_access: "metadata_only" })
    .edge("extractor", "classifier")
    .edge("extractor", "flagger")
    .edge("classifier", "router")
    .edge("flagger", "router")
    .build();
}

export { ExtractorAgent, ClassifierAgent, FlaggerAgent, RouterAgent };
