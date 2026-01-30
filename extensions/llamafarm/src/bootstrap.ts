/**
 * LlamaFarm project bootstrap service
 *
 * Creates and manages the LlamaFarm project via the LlamaFarm API.
 * This uses the LlamaFarm REST API to create/update projects instead of
 * writing files directly to ~/.llamafarm/projects/.
 *
 * The API handles all file management - we just call the endpoints.
 */

import type { LlamaFarmConfig, LlamaFarmProjectConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { LlamaFarmClient } from "./client.js";

export type BootstrapResult = {
  namespace: string;
  project: string;
  created: boolean;
  serverHealthy: boolean;
  config?: LlamaFarmProjectConfig;
  error?: string;
};

/**
 * Bootstrap the LlamaFarm project via the API
 *
 * This uses the LlamaFarm REST API to:
 * 1. Check if the project exists (GET /v1/projects/{namespace})
 * 2. Create it if needed (POST /v1/projects/{namespace})
 * 3. Update configuration (PUT /v1/projects/{namespace}/{project})
 *
 * All file management is handled by LlamaFarm server.
 */
export async function bootstrapProject(
  config: LlamaFarmConfig = {},
): Promise<BootstrapResult> {
  const fullConfig: Required<LlamaFarmConfig> = {
    serverUrl: config.serverUrl ?? DEFAULT_CONFIG.serverUrl,
    namespace: config.namespace ?? DEFAULT_CONFIG.namespace,
    project: config.project ?? DEFAULT_CONFIG.project,
    modelName: config.modelName ?? DEFAULT_CONFIG.modelName,
    autoBootstrap: config.autoBootstrap ?? DEFAULT_CONFIG.autoBootstrap,
  };

  const client = new LlamaFarmClient(fullConfig);

  // Check server health first
  let serverHealthy = false;
  try {
    serverHealthy = await client.isHealthy();
  } catch {
    // Server not reachable
    return {
      namespace: fullConfig.namespace,
      project: fullConfig.project,
      created: false,
      serverHealthy: false,
      error: "LlamaFarm server not reachable at " + fullConfig.serverUrl,
    };
  }

  if (!serverHealthy) {
    return {
      namespace: fullConfig.namespace,
      project: fullConfig.project,
      created: false,
      serverHealthy: false,
      error: "LlamaFarm server unhealthy",
    };
  }

  // Check if project already exists
  const exists = await client.projectExists();

  try {
    // Use the API to create/update the project
    const response = await client.ensureProject(fullConfig.modelName);

    return {
      namespace: fullConfig.namespace,
      project: fullConfig.project,
      created: !exists,
      serverHealthy: true,
      config: response.project.config,
    };
  } catch (error) {
    return {
      namespace: fullConfig.namespace,
      project: fullConfig.project,
      created: false,
      serverHealthy: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get project configuration from the API
 */
export async function getProjectConfig(
  config: LlamaFarmConfig = {},
): Promise<LlamaFarmProjectConfig | null> {
  const fullConfig: Required<LlamaFarmConfig> = {
    serverUrl: config.serverUrl ?? DEFAULT_CONFIG.serverUrl,
    namespace: config.namespace ?? DEFAULT_CONFIG.namespace,
    project: config.project ?? DEFAULT_CONFIG.project,
    modelName: config.modelName ?? DEFAULT_CONFIG.modelName,
    autoBootstrap: config.autoBootstrap ?? DEFAULT_CONFIG.autoBootstrap,
  };

  const client = new LlamaFarmClient(fullConfig);

  try {
    const exists = await client.projectExists();
    if (!exists) {
      return null;
    }
    const response = await client.getProject();
    return response.project.config;
  } catch {
    return null;
  }
}

/**
 * Check if project exists via the API
 */
export async function projectExists(config: LlamaFarmConfig = {}): Promise<boolean> {
  const fullConfig: Required<LlamaFarmConfig> = {
    serverUrl: config.serverUrl ?? DEFAULT_CONFIG.serverUrl,
    namespace: config.namespace ?? DEFAULT_CONFIG.namespace,
    project: config.project ?? DEFAULT_CONFIG.project,
    modelName: config.modelName ?? DEFAULT_CONFIG.modelName,
    autoBootstrap: config.autoBootstrap ?? DEFAULT_CONFIG.autoBootstrap,
  };

  const client = new LlamaFarmClient(fullConfig);
  return client.projectExists();
}
