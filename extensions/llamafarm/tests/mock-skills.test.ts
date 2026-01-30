import { describe, it, expect, beforeAll } from "vitest";

import { notifyTool } from "../src/tools/notify.js";
import { controlTool } from "../src/tools/control.js";
import { moveTool } from "../src/tools/move.js";
import { mockTools, getToolSchemas, serializeToolsForContext } from "../src/tools/index.js";
import { LlamaFarmClient } from "../src/client.js";
import { bootstrapProject } from "../src/bootstrap.js";

/**
 * Mock skills tests - tests the tool implementations and their integration
 * with LlamaFarm's tool calling capability.
 *
 * Prerequisites:
 * - LlamaFarm server running on http://localhost:8000
 */
describe("Mock Skills", () => {
  const testConfig = {
    serverUrl: "http://localhost:8000",
    namespace: `test-tools-${Date.now()}`,
    project: "agent",
    modelName: "qwen3-8b",
    autoBootstrap: true,
  };

  let serverAvailable = false;

  beforeAll(async () => {
    const client = new LlamaFarmClient(testConfig);
    serverAvailable = await client.isHealthy();

    if (!serverAvailable) {
      console.warn("⚠️ LlamaFarm server not available - skipping real API tests");
    }
  });

  describe("Tool Registration", () => {
    it("should export all three mock tools", () => {
      expect(mockTools).toHaveLength(3);
      expect(mockTools.map((t) => t.name)).toContain("llamafarm-notify");
      expect(mockTools.map((t) => t.name)).toContain("llamafarm-control");
      expect(mockTools.map((t) => t.name)).toContain("llamafarm-move");
    });

    it("should have valid tool schemas", () => {
      for (const tool of mockTools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("parameters");
        expect(tool).toHaveProperty("execute");
        expect(typeof tool.execute).toBe("function");
      }
    });
  });

  describe("notifyTool", () => {
    it("should execute with required parameters", async () => {
      const result = await notifyTool.execute("test-id", {
        message: "Test notification",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("Test notification");
    });

    it("should accept optional level parameter", async () => {
      const result = await notifyTool.execute("test-id", {
        message: "Warning message",
        level: "warn",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.level).toBe("warn");
    });

    it("should return error for empty message", async () => {
      const result = await notifyTool.execute("test-id", {
        message: "",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("controlTool", () => {
    it("should execute with required parameters", async () => {
      const result = await controlTool.execute("test-id", {
        action: "start",
        target: "device-1",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe("start");
      expect(parsed.target).toBe("device-1");
    });

    it("should accept optional options parameter", async () => {
      const result = await controlTool.execute("test-id", {
        action: "set",
        target: "thermostat",
        options: { temperature: 72 },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.options).toEqual({ temperature: 72 });
    });
  });

  describe("moveTool", () => {
    it("should execute with required parameters", async () => {
      const result = await moveTool.execute("test-id", {
        destination: "kitchen",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.destination).toBe("kitchen");
    });

    it("should accept optional speed parameter", async () => {
      const result = await moveTool.execute("test-id", {
        destination: "bedroom",
        speed: "fast",
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.speed).toBe("fast");
    });
  });

  describe("Tool Schema Serialization", () => {
    it("should generate valid OpenAI-format tool schemas", () => {
      const schemas = getToolSchemas();

      expect(schemas).toHaveLength(3);
      for (const schema of schemas) {
        expect(schema.type).toBe("function");
        expect(schema.function).toHaveProperty("name");
        expect(schema.function).toHaveProperty("description");
        expect(schema.function).toHaveProperty("parameters");
      }
    });

    it("should serialize tools to JSON string", () => {
      const serialized = serializeToolsForContext();

      expect(typeof serialized).toBe("string");
      const parsed = JSON.parse(serialized);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
    });
  });

  describe("LlamaFarm Tool Integration", () => {
    it("should pass tools to LlamaFarm via variables", async () => {
      if (!serverAvailable) {
        console.warn("Skipping - server not available");
        return;
      }

      // Ensure project exists
      await bootstrapProject(testConfig);

      const client = new LlamaFarmClient(testConfig);
      const toolSchemas = getToolSchemas();

      // Send a chat request with tools passed as a variable
      // Note: The model may or may not call tools depending on the prompt
      const response = await client.chat({
        messages: [
          {
            role: "user",
            content: "Send a test notification with the message 'Hello World'",
          },
        ],
        stream: false,
        rag_enabled: false,
        temperature: 0.1,
        max_tokens: 200,
        tools: toolSchemas,
      });

      expect(response.choices).toHaveLength(1);
      // The response could be either a tool call or a text response
      // depending on how the model interprets the request
      expect(response.choices[0].message).toBeDefined();
    });
  });
});
