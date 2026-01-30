/**
 * Workspace bootstrap for LlamaFarm Moltbot integration
 *
 * Creates the state directory structure at ~/.llamafarm/moltbot-workspace/
 * This is separate from the regular .clawdbot/ directory.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

import type { LlamaFarmConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

export type WorkspaceBootstrapResult = {
  stateDir: string;
  workspaceDir: string;
  memoryDir: string;
  configPath: string;
  created: boolean;
  templatesCopied: string[];
};

/**
 * Default state directory for LlamaFarm Moltbot integration
 */
export const DEFAULT_STATE_DIR = join(homedir(), ".llamafarm", "moltbot-workspace");

/**
 * Get the state directory path
 */
export function getStateDir(): string {
  return process.env.MOLTBOT_STATE_DIR ?? DEFAULT_STATE_DIR;
}

/**
 * Get the workspace directory path
 */
export function getWorkspaceDir(): string {
  return join(getStateDir(), "workspace");
}

/**
 * Get the memory directory path
 */
export function getMemoryDir(): string {
  return join(getStateDir(), "memory");
}

/**
 * Check if workspace already exists
 */
export function workspaceExists(): boolean {
  const configPath = join(getStateDir(), "moltbot.json");
  return existsSync(configPath);
}

/**
 * Template content for SOUL.md
 */
export function getSoulTemplate(): string {
  return `# Soul

You are an AI assistant powered by LlamaFarm, running locally via Qwen.

## Core Identity

- You are helpful, harmless, and honest
- You provide thoughtful, well-reasoned responses
- You acknowledge when you don't know something
- You prioritize the user's needs and safety

## Capabilities

- Local LLM inference (no cloud dependency)
- Tool usage for notifications, controls, and actions
- Memory persistence across conversations

## Communication Style

- Clear and concise
- Professional yet friendly
- Technical when needed, accessible when possible
`;
}

/**
 * Template content for AGENTS.md
 */
export function getAgentsTemplate(): string {
  return `# Agents

This workspace uses LlamaFarm for local LLM inference.

## Primary Agent

- **Model**: Qwen3-8B via LlamaFarm Universal Runtime
- **Provider**: LlamaFarm (OpenAI-compatible API)
- **Endpoint**: http://localhost:8000

## Agent Behavior

The agent processes messages through the LlamaFarm API, which routes to the
configured model. System prompts and tools are passed via the variables field.
`;
}

/**
 * Template content for TOOLS.md
 */
export function getToolsTemplate(): string {
  return `# Tools

Available tools for the LlamaFarm agent.

## Mock Skills (Development)

These mock tools are available for testing:

### llamafarm-notify
Send notifications (mock implementation).
- **Parameters**: message (string), level (info|warn|error)
- **Returns**: Confirmation of notification sent

### llamafarm-control
Control actions (mock implementation).
- **Parameters**: action (string), target (string)
- **Returns**: Action execution result

### llamafarm-move
Movement/navigation (mock implementation).
- **Parameters**: destination (string)
- **Returns**: Navigation result

## Adding Real Tools

Replace mock tools with real implementations by:
1. Creating tool modules in extensions/llamafarm/src/tools/
2. Registering them via api.registerTool() in index.ts
3. Ensuring tool schemas are JSON-serializable
`;
}

/**
 * Template content for USER.md
 */
export function getUserTemplate(): string {
  return `# User Profile

The user interacting with this agent.

## Preferences

- Response style: Clear and concise
- Technical level: Adaptable
- Language: English

## Notes

Add user-specific notes here as the relationship develops.
`;
}

/**
 * Template content for IDENTITY.md
 */
export function getIdentityTemplate(): string {
  return `# Identity

## Agent Name
LlamaFarm Assistant

## Description
A locally-running AI assistant powered by LlamaFarm and Qwen.

## Version
1.0.0

## Created
${new Date().toISOString().split("T")[0]}
`;
}

/**
 * Template content for MEMORY.md
 */
export function getMemoryTemplate(): string {
  return `# Memory

Persistent memory for the LlamaFarm agent.

## Important Facts

(Facts learned during conversations will be stored here)

## User Preferences

(Preferences expressed by the user will be tracked here)

## Context

(Important context for ongoing work will be recorded here)
`;
}

/**
 * Generate moltbot.json configuration
 */
export function generateMoltbotConfig(config: Required<LlamaFarmConfig>): object {
  return {
    gateway: {
      port: 3332,
      mode: "local",
    },
    agents: {
      defaults: {
        workspace: getWorkspaceDir(),
      },
    },
    models: {
      providers: {
        llamafarm: {
          baseUrl: `${config.serverUrl}/v1/projects/${config.namespace}/${config.project}`,
          api: "openai-completions",
          authHeader: false,
          models: [
            {
              id: config.modelName,
              name: config.modelName,
              api: "openai-completions",
              reasoning: false,
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 32000,
              maxTokens: 8192,
            },
          ],
        },
      },
    },
  };
}

/**
 * Bootstrap the workspace directory structure
 */
export async function bootstrapWorkspace(
  config: LlamaFarmConfig = {},
): Promise<WorkspaceBootstrapResult> {
  const fullConfig: Required<LlamaFarmConfig> = {
    serverUrl: config.serverUrl ?? DEFAULT_CONFIG.serverUrl,
    namespace: config.namespace ?? DEFAULT_CONFIG.namespace,
    project: config.project ?? DEFAULT_CONFIG.project,
    modelName: config.modelName ?? DEFAULT_CONFIG.modelName,
    autoBootstrap: config.autoBootstrap ?? DEFAULT_CONFIG.autoBootstrap,
  };

  const stateDir = getStateDir();
  const workspaceDir = getWorkspaceDir();
  const memoryDir = getMemoryDir();
  const configPath = join(stateDir, "moltbot.json");

  const templatesCopied: string[] = [];

  // Check if already exists
  if (existsSync(configPath)) {
    return {
      stateDir,
      workspaceDir,
      memoryDir,
      configPath,
      created: false,
      templatesCopied,
    };
  }

  // Create directories
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });
  mkdirSync(memoryDir, { recursive: true });

  // Write templates to workspace
  const templates: Array<[string, string]> = [
    ["SOUL.md", getSoulTemplate()],
    ["AGENTS.md", getAgentsTemplate()],
    ["TOOLS.md", getToolsTemplate()],
    ["USER.md", getUserTemplate()],
    ["IDENTITY.md", getIdentityTemplate()],
    ["MEMORY.md", getMemoryTemplate()],
  ];

  for (const [filename, content] of templates) {
    const filepath = join(workspaceDir, filename);
    writeFileSync(filepath, content, "utf-8");
    templatesCopied.push(filename);
  }

  // Write moltbot.json config
  const moltbotConfig = generateMoltbotConfig(fullConfig);
  writeFileSync(configPath, JSON.stringify(moltbotConfig, null, 2), "utf-8");

  return {
    stateDir,
    workspaceDir,
    memoryDir,
    configPath,
    created: true,
    templatesCopied,
  };
}

/**
 * Read existing moltbot.json if it exists
 */
export function readMoltbotConfig(): object | null {
  const configPath = join(getStateDir(), "moltbot.json");
  if (!existsSync(configPath)) {
    return null;
  }
  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content) as object;
}
