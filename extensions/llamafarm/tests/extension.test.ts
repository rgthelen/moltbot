import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MoltbotPluginApi, PluginLogger } from "../../../src/plugins/types.js";

import register, { PLUGIN_ID, PLUGIN_NAME, PLUGIN_VERSION, DEFAULT_CONFIG } from "../index.js";

describe("LlamaFarm Extension", () => {
  let mockApi: MoltbotPluginApi;
  let mockLogger: PluginLogger;
  let registeredServices: Array<{ id: string; start: unknown; stop?: unknown }>;
  let registeredHooks: Array<{ hookName: string; handler: unknown }>;

  beforeEach(() => {
    registeredServices = [];
    registeredHooks = [];

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockApi = {
      id: PLUGIN_ID,
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description: "Test plugin",
      source: "test",
      config: {} as never,
      pluginConfig: {},
      runtime: {} as never,
      logger: mockLogger,
      registerTool: vi.fn(),
      registerHook: vi.fn(),
      registerHttpHandler: vi.fn(),
      registerHttpRoute: vi.fn(),
      registerChannel: vi.fn(),
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn((service) => {
        registeredServices.push(service);
      }),
      registerProvider: vi.fn(),
      registerCommand: vi.fn(),
      resolvePath: vi.fn((p) => p),
      on: vi.fn((hookName, handler) => {
        registeredHooks.push({ hookName, handler });
      }),
    };
  });

  describe("Extension Loading", () => {
    it("should load without errors", () => {
      expect(() => register(mockApi)).not.toThrow();
    });

    it("should register as plugin with correct ID", () => {
      expect(PLUGIN_ID).toBe("llamafarm");
    });

    it("should have correct plugin name", () => {
      expect(PLUGIN_NAME).toBe("LlamaFarm");
    });

    it("should have a version string", () => {
      expect(PLUGIN_VERSION).toMatch(/^\d{4}\.\d+\.\d+/);
    });

    it("should log registration message", () => {
      register(mockApi);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("LlamaFarm extension registered"),
      );
    });
  });

  describe("Config Schema", () => {
    it("should have default config values", () => {
      expect(DEFAULT_CONFIG.serverUrl).toBe("http://localhost:8000");
      expect(DEFAULT_CONFIG.namespace).toBe("moltbot");
      expect(DEFAULT_CONFIG.project).toBe("agent");
      expect(DEFAULT_CONFIG.modelName).toBe("qwen3-8b");
      expect(DEFAULT_CONFIG.autoBootstrap).toBe(true);
    });

    it("should use custom config when provided", () => {
      mockApi.pluginConfig = {
        serverUrl: "http://custom:9000",
        namespace: "custom-ns",
        project: "custom-proj",
      };

      register(mockApi);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("http://custom:9000"),
      );
    });

    it("should merge partial config with defaults", () => {
      mockApi.pluginConfig = {
        namespace: "my-org",
      };

      register(mockApi);

      // Should still use default serverUrl
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:8000"),
      );
    });
  });

  describe("Service Registration", () => {
    it("should register health check service", () => {
      register(mockApi);

      expect(registeredServices.length).toBe(1);
      expect(registeredServices[0].id).toBe("llamafarm-health");
      expect(typeof registeredServices[0].start).toBe("function");
    });
  });

  describe("Hook Registration", () => {
    it("should register gateway_start hook", () => {
      register(mockApi);

      const gatewayHook = registeredHooks.find((h) => h.hookName === "gateway_start");
      expect(gatewayHook).toBeDefined();
      expect(typeof gatewayHook?.handler).toBe("function");
    });
  });
});
