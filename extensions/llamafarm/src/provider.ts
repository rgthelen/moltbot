/**
 * LlamaFarm provider for Moltbot
 *
 * Registers LlamaFarm as a model provider using OpenAI-compatible API.
 * All API calls go through port 8000 (main LlamaFarm server).
 */

import type { ProviderPlugin, ProviderAuthContext, ProviderAuthResult } from "../../../src/plugins/types.js";

import type { LlamaFarmConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { LlamaFarmClient } from "./client.js";

const PROVIDER_ID = "llamafarm";
const PROVIDER_LABEL = "LlamaFarm";

// Default model configuration
const DEFAULT_MODEL_ID = "qwen3-8b";
const DEFAULT_CONTEXT_WINDOW = 32_000;
const DEFAULT_MAX_TOKENS = 8192;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_CONFIG.serverUrl;
  let normalized = trimmed;
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
}

function validateBaseUrl(value: string): string | undefined {
  const normalized = normalizeBaseUrl(value);
  try {
    new URL(normalized);
  } catch {
    return "Enter a valid URL";
  }
  return undefined;
}

function buildModelDefinition(modelId: string, contextWindow = DEFAULT_CONTEXT_WINDOW) {
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}

/**
 * Build the full chat endpoint URL for LlamaFarm
 */
export function buildChatEndpoint(serverUrl: string, namespace: string, project: string): string {
  return `${serverUrl}/v1/projects/${namespace}/${project}`;
}

/**
 * Create the LlamaFarm provider plugin
 */
export function createLlamaFarmProvider(config: LlamaFarmConfig = {}): ProviderPlugin {
  const fullConfig: Required<LlamaFarmConfig> = {
    serverUrl: config.serverUrl ?? DEFAULT_CONFIG.serverUrl,
    namespace: config.namespace ?? DEFAULT_CONFIG.namespace,
    project: config.project ?? DEFAULT_CONFIG.project,
    modelName: config.modelName ?? DEFAULT_CONFIG.modelName,
    autoBootstrap: config.autoBootstrap ?? DEFAULT_CONFIG.autoBootstrap,
  };

  return {
    id: PROVIDER_ID,
    label: PROVIDER_LABEL,
    docsPath: "/providers/models",
    aliases: ["llama-farm", "lf"],
    auth: [
      {
        id: "local",
        label: "Local LlamaFarm Server",
        hint: "Connect to a running LlamaFarm server",
        kind: "custom",
        run: async (ctx: ProviderAuthContext): Promise<ProviderAuthResult> => {
          // Prompt for server URL
          const serverUrlInput = await ctx.prompter.text({
            message: "LlamaFarm server URL",
            initialValue: fullConfig.serverUrl,
            validate: validateBaseUrl,
          });

          // Prompt for namespace
          const namespaceInput = await ctx.prompter.text({
            message: "LlamaFarm namespace",
            initialValue: fullConfig.namespace,
            validate: (v) => (v.trim() ? undefined : "Enter a namespace"),
          });

          // Prompt for project
          const projectInput = await ctx.prompter.text({
            message: "LlamaFarm project name",
            initialValue: fullConfig.project,
            validate: (v) => (v.trim() ? undefined : "Enter a project name"),
          });

          // Prompt for model name
          const modelNameInput = await ctx.prompter.text({
            message: "Model name",
            initialValue: fullConfig.modelName,
            validate: (v) => (v.trim() ? undefined : "Enter a model name"),
          });

          const serverUrl = normalizeBaseUrl(serverUrlInput);
          const namespace = namespaceInput.trim();
          const project = projectInput.trim();
          const modelName = modelNameInput.trim();

          // Build the base URL for the provider (points to project endpoint)
          const baseUrl = buildChatEndpoint(serverUrl, namespace, project);
          const defaultModelRef = `${PROVIDER_ID}/${modelName}`;

          // Check server health
          const client = new LlamaFarmClient({ serverUrl, namespace, project });
          let healthNote = "";
          try {
            const healthy = await client.isHealthy();
            healthNote = healthy
              ? `Server is healthy at ${serverUrl}`
              : `Warning: Server at ${serverUrl} is not responding`;
          } catch (err) {
            healthNote = `Warning: Could not reach server at ${serverUrl}`;
          }

          return {
            profiles: [
              {
                profileId: `${PROVIDER_ID}:local`,
                credential: {
                  type: "token",
                  provider: PROVIDER_ID,
                  token: "n/a", // LlamaFarm doesn't require auth by default
                },
              },
            ],
            configPatch: {
              models: {
                providers: {
                  [PROVIDER_ID]: {
                    baseUrl,
                    apiKey: "n/a",
                    api: "openai-completions",
                    authHeader: false,
                    models: [buildModelDefinition(modelName)],
                  },
                },
              },
              agents: {
                defaults: {
                  models: {
                    [defaultModelRef]: {},
                  },
                },
              },
            },
            defaultModel: defaultModelRef,
            notes: [
              healthNote,
              `Configured to use ${namespace}/${project} project`,
              "LlamaFarm provides local LLM inference via Qwen, Llama, and other models.",
              "Pass system_prompt and tools_context via the variables field for dynamic prompts.",
            ],
          };
        },
      },
    ],
  };
}
