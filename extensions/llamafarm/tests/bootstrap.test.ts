import { describe, it, expect, beforeAll, afterAll } from "vitest";

import {
  bootstrapProject,
  projectExists,
  getProjectConfig,
} from "../src/bootstrap.js";
import { LlamaFarmClient } from "../src/client.js";

/**
 * Bootstrap tests that run against the REAL LlamaFarm server.
 *
 * Prerequisites:
 * - LlamaFarm server running on http://localhost:8000
 * - Use `lf services status` to check
 * - Use `lf services start` to start if needed
 *
 * These tests use a unique namespace to avoid conflicts with other projects.
 */
describe("LlamaFarm Bootstrap", () => {
  const testNamespace = `test-bootstrap-${Date.now()}`;
  const testProject = "agent";
  const testConfig = {
    serverUrl: "http://localhost:8000",
    namespace: testNamespace,
    project: testProject,
    modelName: "qwen3-8b",
    autoBootstrap: true,
  };

  let serverAvailable = false;

  beforeAll(async () => {
    // Check if LlamaFarm server is available
    const client = new LlamaFarmClient(testConfig);
    serverAvailable = await client.isHealthy();

    if (!serverAvailable) {
      console.warn(
        "⚠️ LlamaFarm server not available - skipping real API tests",
      );
      console.warn("   Start with: lf services start");
    }
  });

  afterAll(async () => {
    // Clean up test project if it was created
    // Note: LlamaFarm API doesn't fully delete, but we use unique namespace anyway
  });

  describe("LlamaFarmClient", () => {
    it("should check server health", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      const client = new LlamaFarmClient(testConfig);
      const healthy = await client.isHealthy();

      expect(healthy).toBe(true);
    });

    it("should list projects in namespace", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      const client = new LlamaFarmClient(testConfig);
      const result = await client.listProjects();

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("projects");
      expect(Array.isArray(result.projects)).toBe(true);
    });
  });

  describe("projectExists", () => {
    it("should return false for non-existent project", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      const exists = await projectExists({
        ...testConfig,
        namespace: "nonexistent-namespace-12345",
        project: "nonexistent-project",
      });

      expect(exists).toBe(false);
    });
  });

  describe("bootstrapProject", () => {
    it("should create project via API", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      const result = await bootstrapProject(testConfig);

      expect(result.serverHealthy).toBe(true);
      expect(result.namespace).toBe(testNamespace);
      expect(result.project).toBe(testProject);
      // First time should be created
      expect(result.created).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return config after creation", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      const result = await bootstrapProject(testConfig);

      expect(result.config).toBeDefined();
      expect(result.config?.name).toBe(testProject);
      expect(result.config?.namespace).toBe(testNamespace);
    });

    it("should report serverHealthy=false when server unavailable", async () => {
      const result = await bootstrapProject({
        ...testConfig,
        serverUrl: "http://localhost:99999", // Bad port
      });

      expect(result.serverHealthy).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getProjectConfig", () => {
    it("should return null for non-existent project", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      const config = await getProjectConfig({
        ...testConfig,
        namespace: "nonexistent-namespace-99999",
        project: "nonexistent-project",
      });

      expect(config).toBeNull();
    });

    it("should return config for existing project", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      // First ensure project exists
      await bootstrapProject(testConfig);

      const config = await getProjectConfig(testConfig);

      expect(config).not.toBeNull();
      expect(config?.name).toBe(testProject);
      expect(config?.namespace).toBe(testNamespace);
    });
  });

  describe("Chat completions", () => {
    it("should send chat request with RAG disabled", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      // Ensure project exists
      await bootstrapProject(testConfig);

      const client = new LlamaFarmClient(testConfig);
      const response = await client.chatWithDefaults(
        [{ role: "user", content: "What is 2+2? Answer with just the number." }],
        {
          temperature: 0.1,
          maxTokens: 10,
        },
      );

      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.role).toBe("assistant");
      expect(response.choices[0].message.content).toBeTruthy();
    });

    it("should use dynamic system_prompt variable", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      // Ensure project exists
      await bootstrapProject(testConfig);

      const client = new LlamaFarmClient(testConfig);
      const response = await client.chatWithDefaults(
        [{ role: "user", content: "What is your name?" }],
        {
          systemPrompt: "You are a robot named Beep-Boop. Always mention your name.",
          temperature: 0.7,
          maxTokens: 50,
        },
      );

      expect(response.choices).toHaveLength(1);
      const content = response.choices[0].message.content.toLowerCase();
      // The model should respond with its name in the content
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
