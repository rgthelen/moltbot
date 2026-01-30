/**
 * LlamaFarm API client
 */

import type {
  LlamaFarmChatRequest,
  LlamaFarmChatResponse,
  LlamaFarmConfig,
  LlamaFarmHealthResponse,
  LlamaFarmProjectConfig,
  LlamaFarmProjectListResponse,
  LlamaFarmProjectResponse,
  LlamaFarmCreateProjectRequest,
  LlamaFarmUpdateProjectRequest,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

export class LlamaFarmClient {
  private serverUrl: string;
  private namespace: string;
  private project: string;

  constructor(config: LlamaFarmConfig = {}) {
    this.serverUrl = config.serverUrl ?? DEFAULT_CONFIG.serverUrl;
    this.namespace = config.namespace ?? DEFAULT_CONFIG.namespace;
    this.project = config.project ?? DEFAULT_CONFIG.project;
  }

  /**
   * Check LlamaFarm server health
   */
  async health(): Promise<LlamaFarmHealthResponse> {
    const res = await fetch(`${this.serverUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<LlamaFarmHealthResponse>;
  }

  /**
   * Check if the server is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === "healthy";
    } catch {
      return false;
    }
  }

  /**
   * Get the chat completions endpoint URL
   */
  getChatEndpoint(): string {
    return `${this.serverUrl}/v1/projects/${this.namespace}/${this.project}/chat/completions`;
  }

  /**
   * Send a chat completion request
   */
  async chat(request: LlamaFarmChatRequest): Promise<LlamaFarmChatResponse> {
    const res = await fetch(this.getChatEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Chat request failed: ${res.status} ${res.statusText} - ${errorText}`);
    }

    return res.json() as Promise<LlamaFarmChatResponse>;
  }

  /**
   * List available models for the project
   */
  async listModels(): Promise<string[]> {
    const res = await fetch(
      `${this.serverUrl}/v1/projects/${this.namespace}/${this.project}/models`,
    );
    if (!res.ok) {
      throw new Error(`List models failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { models?: string[] };
    return data.models ?? [];
  }

  /**
   * Check if a project exists
   */
  async projectExists(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/v1/projects/${this.namespace}`);
      if (!res.ok) return false;
      const data = (await res.json()) as LlamaFarmProjectListResponse;
      return data.projects?.some((p) => p.name === this.project) ?? false;
    } catch {
      return false;
    }
  }

  /**
   * List all projects in the namespace
   */
  async listProjects(): Promise<LlamaFarmProjectListResponse> {
    const res = await fetch(`${this.serverUrl}/v1/projects/${this.namespace}`);
    if (!res.ok) {
      throw new Error(`List projects failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<LlamaFarmProjectListResponse>;
  }

  /**
   * Get project details
   */
  async getProject(): Promise<LlamaFarmProjectResponse> {
    const res = await fetch(
      `${this.serverUrl}/v1/projects/${this.namespace}/${this.project}`,
    );
    if (!res.ok) {
      throw new Error(`Get project failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<LlamaFarmProjectResponse>;
  }

  /**
   * Create a new project via the LlamaFarm API
   */
  async createProject(
    request: LlamaFarmCreateProjectRequest,
  ): Promise<LlamaFarmProjectResponse> {
    const res = await fetch(`${this.serverUrl}/v1/projects/${this.namespace}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Create project failed: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }

    return res.json() as Promise<LlamaFarmProjectResponse>;
  }

  /**
   * Update project configuration via the LlamaFarm API
   */
  async updateProject(
    request: LlamaFarmUpdateProjectRequest,
  ): Promise<LlamaFarmProjectResponse> {
    const res = await fetch(
      `${this.serverUrl}/v1/projects/${this.namespace}/${this.project}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Update project failed: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }

    return res.json() as Promise<LlamaFarmProjectResponse>;
  }

  /**
   * Create or update project with the Moltbot agent configuration
   *
   * The project is configured with:
   * - Dynamic {{system_prompt}} variable for injecting custom system prompts
   * - Dynamic {{tools_context}} variable for injecting tool definitions
   * - RAG is disabled per-request (rag_enabled: false in chat requests)
   */
  async ensureProject(modelName: string): Promise<LlamaFarmProjectResponse> {
    // Note: RAG is disabled per-request with rag_enabled: false, not in config
    const config: LlamaFarmProjectConfig = {
      version: "v1",
      name: this.project,
      namespace: this.namespace,
      runtime: {
        models: [
          {
            name: modelName,
            provider: "universal",
            model: "unsloth/Qwen3-1.7B-GGUF:Q4_K_M",
            default: true,
            prompts: ["default"],
            tool_call_strategy: "native_api",
          },
        ],
      },
      prompts: [
        {
          name: "default",
          messages: [
            {
              role: "system",
              content: "{{system_prompt | You are a helpful AI assistant.}}",
            },
          ],
        },
      ],
    };

    // Check if project exists
    const exists = await this.projectExists();

    if (exists) {
      // Update existing project
      return this.updateProject({ config });
    } else {
      // Create new project with default template, then update config
      await this.createProject({
        name: this.project,
        config_template: "default",
      });
      // Now update with our specific configuration
      return this.updateProject({ config });
    }
  }

  /**
   * Send a chat completion with Moltbot defaults
   * - Streaming enabled
   * - RAG disabled
   * - Supports dynamic system_prompt variable
   */
  async chatWithDefaults(
    messages: Array<{ role: string; content: string }>,
    options: {
      systemPrompt?: string;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {},
  ): Promise<LlamaFarmChatResponse> {
    const request: LlamaFarmChatRequest = {
      messages: messages as LlamaFarmChatRequest["messages"],
      stream: options.stream ?? false,
      rag_enabled: false, // Always disable RAG for Moltbot
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
    };

    // Add variables if system prompt provided
    if (options.systemPrompt) {
      request.variables = {
        system_prompt: options.systemPrompt,
      };
    }

    return this.chat(request);
  }
}
