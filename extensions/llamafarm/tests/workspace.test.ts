import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DEFAULT_CONFIG } from "../src/types.js";

// Test home directory - must be defined before dynamic imports
const testHomeDir = join(tmpdir(), "llamafarm-workspace-test-" + process.pid);

// Mock homedir to use temp directory for tests
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  const testDir = join(actual.tmpdir(), "llamafarm-workspace-test-" + process.pid);
  return {
    ...actual,
    homedir: vi.fn(() => testDir),
  };
});

// Import after mock is set up
const {
  bootstrapWorkspace,
  workspaceExists,
  getStateDir,
  getWorkspaceDir,
  getMemoryDir,
  generateMoltbotConfig,
  readMoltbotConfig,
  getSoulTemplate,
  getAgentsTemplate,
  getToolsTemplate,
  getUserTemplate,
  getIdentityTemplate,
  getMemoryTemplate,
} = await import("../src/workspace.js");

describe("LlamaFarm Workspace", () => {
  beforeEach(() => {
    // Create test home directory
    if (!existsSync(testHomeDir)) {
      mkdirSync(testHomeDir, { recursive: true });
    }
    // Clear any env override
    delete process.env.MOLTBOT_STATE_DIR;
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testHomeDir)) {
      rmSync(testHomeDir, { recursive: true, force: true });
    }
  });

  describe("getStateDir", () => {
    it("should return default state directory", () => {
      const dir = getStateDir();
      expect(dir).toContain(".llamafarm");
      expect(dir).toContain("moltbot-workspace");
    });

    it("should use MOLTBOT_STATE_DIR env var if set", () => {
      process.env.MOLTBOT_STATE_DIR = "/custom/state/dir";
      const dir = getStateDir();
      expect(dir).toBe("/custom/state/dir");
      delete process.env.MOLTBOT_STATE_DIR;
    });

    it("should NOT use .clawdbot directory", () => {
      const dir = getStateDir();
      expect(dir).not.toContain(".clawdbot");
    });
  });

  describe("getWorkspaceDir", () => {
    it("should return workspace subdirectory", () => {
      const dir = getWorkspaceDir();
      expect(dir).toContain("workspace");
    });
  });

  describe("getMemoryDir", () => {
    it("should return memory subdirectory", () => {
      const dir = getMemoryDir();
      expect(dir).toContain("memory");
    });
  });

  describe("workspaceExists", () => {
    it("should return false for non-existent workspace", () => {
      expect(workspaceExists()).toBe(false);
    });

    it("should return true after bootstrap", async () => {
      await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(workspaceExists()).toBe(true);
    });
  });

  describe("templates", () => {
    it("should generate SOUL.md template", () => {
      const content = getSoulTemplate();
      expect(content).toContain("# Soul");
      expect(content).toContain("LlamaFarm");
    });

    it("should generate AGENTS.md template", () => {
      const content = getAgentsTemplate();
      expect(content).toContain("# Agents");
      expect(content).toContain("LlamaFarm");
    });

    it("should generate TOOLS.md template", () => {
      const content = getToolsTemplate();
      expect(content).toContain("# Tools");
      expect(content).toContain("llamafarm-notify");
      expect(content).toContain("llamafarm-control");
      expect(content).toContain("llamafarm-move");
    });

    it("should generate USER.md template", () => {
      const content = getUserTemplate();
      expect(content).toContain("# User Profile");
    });

    it("should generate IDENTITY.md template", () => {
      const content = getIdentityTemplate();
      expect(content).toContain("# Identity");
      expect(content).toContain("LlamaFarm");
    });

    it("should generate MEMORY.md template", () => {
      const content = getMemoryTemplate();
      expect(content).toContain("# Memory");
    });
  });

  describe("generateMoltbotConfig", () => {
    it("should generate valid config object", () => {
      const config = generateMoltbotConfig(DEFAULT_CONFIG);
      expect(config).toHaveProperty("gateway");
      expect(config).toHaveProperty("agents");
      expect(config).toHaveProperty("models");
    });

    it("should set gateway port to 3332", () => {
      const config = generateMoltbotConfig(DEFAULT_CONFIG) as { gateway: { port: number } };
      expect(config.gateway.port).toBe(3332);
    });

    it("should configure llamafarm provider", () => {
      const config = generateMoltbotConfig(DEFAULT_CONFIG) as {
        models: { providers: { llamafarm: unknown } };
      };
      expect(config.models.providers.llamafarm).toBeDefined();
    });

    it("should set correct baseUrl from config", () => {
      const config = generateMoltbotConfig(DEFAULT_CONFIG) as {
        models: { providers: { llamafarm: { baseUrl: string } } };
      };
      expect(config.models.providers.llamafarm.baseUrl).toBe(
        "http://localhost:8000/v1/projects/moltbot/agent",
      );
    });
  });

  describe("bootstrapWorkspace", () => {
    it("should create state directory", async () => {
      const result = await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(result.created).toBe(true);
      expect(existsSync(result.stateDir)).toBe(true);
    });

    it("should create workspace directory with templates", async () => {
      const result = await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(existsSync(result.workspaceDir)).toBe(true);
      expect(result.templatesCopied).toContain("SOUL.md");
      expect(result.templatesCopied).toContain("AGENTS.md");
      expect(result.templatesCopied).toContain("TOOLS.md");
    });

    it("should create memory directory", async () => {
      const result = await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(existsSync(result.memoryDir)).toBe(true);
    });

    it("should create moltbot.json config", async () => {
      const result = await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(existsSync(result.configPath)).toBe(true);

      const content = readFileSync(result.configPath, "utf-8");
      const config = JSON.parse(content);
      expect(config.gateway.port).toBe(3332);
    });

    it("should not overwrite existing workspace", async () => {
      // Create first
      const firstResult = await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(firstResult.created).toBe(true);

      // Try again
      const secondResult = await bootstrapWorkspace(DEFAULT_CONFIG);
      expect(secondResult.created).toBe(false);
      expect(secondResult.templatesCopied).toHaveLength(0);
    });

    it("should NOT modify .clawdbot directory", async () => {
      const clawdbotDir = join(testHomeDir, ".clawdbot");
      mkdirSync(clawdbotDir, { recursive: true });

      await bootstrapWorkspace(DEFAULT_CONFIG);

      // .clawdbot should still exist but not be touched
      expect(existsSync(clawdbotDir)).toBe(true);
    });
  });

  describe("readMoltbotConfig", () => {
    it("should return null for non-existent config", () => {
      const config = readMoltbotConfig();
      expect(config).toBeNull();
    });

    it("should return config object after bootstrap", async () => {
      await bootstrapWorkspace(DEFAULT_CONFIG);
      const config = readMoltbotConfig();
      expect(config).not.toBeNull();
      expect(config).toHaveProperty("gateway");
    });
  });
});
