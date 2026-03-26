/**
 * Model resolution: maps model tier to concrete provider model ID
 */

import { MonkeyModel } from "../../references/types";
import { getModelConfig } from "../../references/config";
import { log } from "../../ui/logger";

export interface ResolvedModel {
  provider: string;
  modelId: string;
}

export function resolveModel(model: MonkeyModel): ResolvedModel {
  const config = getModelConfig();
  
  let modelId: string;
  switch (model) {
    case "agent":
      modelId = config.agent;
      break;
    case "high":
      modelId = config.high;
      break;
    case "mid":
      modelId = config.mid;
      break;
    default:
      modelId = config.mid;
  }
  
  log(`Resolved model: ${model} -> ${config.provider}:${modelId}`);
  
  return {
    provider: config.provider,
    modelId,
  };
}
