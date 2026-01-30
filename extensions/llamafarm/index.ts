/**
 * LlamaFarm extension for Moltbot
 *
 * Provides local LLM backend via LlamaFarm server with OpenAI-compatible chat API.
 * All API calls go through port 8000 (main LlamaFarm server).
 */

import type { MoltbotPluginApi } from "../../src/plugins/types.js";

import { LlamaFarmClient } from "./src/client.js";
import { createLlamaFarmProvider } from "./src/provider.js";
import type { LlamaFarmConfig } from "./src/types.js";
import { DEFAULT_CONFIG } from "./src/types.js";

export const PLUGIN_ID = "llamafarm";
export const PLUGIN_NAME = "LlamaFarm";
export const PLUGIN_VERSION = "2026.1.30";

export default function register(api: MoltbotPluginApi) {
  const pluginConfig = (api.pluginConfig ?? {}) as LlamaFarmConfig;
  const config: Required<LlamaFarmConfig> = {
    serverUrl: pluginConfig.serverUrl ?? DEFAULT_CONFIG.serverUrl,
    namespace: pluginConfig.namespace ?? DEFAULT_CONFIG.namespace,
    project: pluginConfig.project ?? DEFAULT_CONFIG.project,
    modelName: pluginConfig.modelName ?? DEFAULT_CONFIG.modelName,
    autoBootstrap: pluginConfig.autoBootstrap ?? DEFAULT_CONFIG.autoBootstrap,
  };

  api.logger.info(`LlamaFarm extension registered (server: ${config.serverUrl})`);

  // Register a service that checks LlamaFarm health on gateway start
  api.registerService({
    id: "llamafarm-health",
    start: async (ctx) => {
      const client = new LlamaFarmClient(config);

      try {
        const healthy = await client.isHealthy();
        if (healthy) {
          ctx.logger.info(
            `LlamaFarm server healthy at ${config.serverUrl} (${config.namespace}/${config.project})`,
          );
        } else {
          ctx.logger.warn(`LlamaFarm server at ${config.serverUrl} is not healthy`);
        }
      } catch (err) {
        ctx.logger.warn(
          `Could not reach LlamaFarm server at ${config.serverUrl}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  });

  // Register gateway_start hook to log when LlamaFarm is available
  api.on("gateway_start", async (_event, _ctx) => {
    api.logger.info(`LlamaFarm extension active for project ${config.namespace}/${config.project}`);
  });

  // Register the LlamaFarm provider for model access
  api.registerProvider(createLlamaFarmProvider(config));
}

// Re-export types and client for external use
export { LlamaFarmClient } from "./src/client.js";
export { createLlamaFarmProvider, buildChatEndpoint } from "./src/provider.js";
export type { LlamaFarmConfig, LlamaFarmChatRequest, LlamaFarmChatResponse } from "./src/types.js";
export { DEFAULT_CONFIG } from "./src/types.js";
