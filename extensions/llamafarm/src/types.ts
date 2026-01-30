/**
 * LlamaFarm extension configuration types
 */

export type LlamaFarmConfig = {
  /** LlamaFarm server URL (default: http://localhost:8000) */
  serverUrl?: string;
  /** LlamaFarm project namespace */
  namespace?: string;
  /** LlamaFarm project name */
  project?: string;
  /** Model name to use (default: qwen3-8b) */
  modelName?: string;
  /** Automatically bootstrap LlamaFarm project on startup (default: true) */
  autoBootstrap?: boolean;
};

export const DEFAULT_CONFIG: Required<LlamaFarmConfig> = {
  serverUrl: "http://localhost:8000",
  namespace: "moltbot",
  project: "agent",
  modelName: "qwen3-8b",
  autoBootstrap: true,
};

export type LlamaFarmHealthResponse = {
  status: "healthy" | "unhealthy";
  summary?: string;
  components?: Array<{
    name: string;
    status: string;
    message?: string;
  }>;
};

export type LlamaFarmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlamaFarmChatRequest = {
  messages: LlamaFarmChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  /** Disable RAG for this request (default: uses project config) */
  rag_enabled?: boolean;
  variables?: Record<string, string | number | boolean | null>;
  tools?: unknown[];
};

export type LlamaFarmChatResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: LlamaFarmChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

/**
 * LlamaFarm project configuration (llamafarm.yaml structure)
 */
export type LlamaFarmProjectConfig = {
  version?: string;
  name: string;
  namespace: string;
  runtime?: {
    models?: Array<{
      name: string;
      provider?: string;
      model?: string;
      base_url?: string;
      default?: boolean;
      prompts?: string[];
      tool_call_strategy?: string;
    }>;
  };
  prompts?: Array<{
    name: string;
    messages: Array<{
      role: string;
      content: string;
    }>;
  }>;
  rag?: {
    enabled?: boolean;
  };
};

/**
 * Response from listing projects
 */
export type LlamaFarmProjectListResponse = {
  total: number;
  projects: Array<{
    namespace: string;
    name: string;
    config: LlamaFarmProjectConfig;
  }>;
};

/**
 * Response from creating/getting a project
 */
export type LlamaFarmProjectResponse = {
  project: {
    namespace: string;
    name: string;
    config: LlamaFarmProjectConfig;
  };
};

/**
 * Request to create a project
 */
export type LlamaFarmCreateProjectRequest = {
  name: string;
  config_template?: "server" | "rag" | string;
};

/**
 * Request to update a project
 */
export type LlamaFarmUpdateProjectRequest = {
  config: LlamaFarmProjectConfig;
};
