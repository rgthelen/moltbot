import { describe, it, expect, vi, beforeEach } from "vitest";

import { createLlamaFarmProvider, buildChatEndpoint } from "../src/provider.js";
import { DEFAULT_CONFIG } from "../src/types.js";

describe("LlamaFarm Provider", () => {
  describe("buildChatEndpoint", () => {
    it("should build correct endpoint URL", () => {
      const endpoint = buildChatEndpoint("http://localhost:8000", "moltbot", "agent");
      expect(endpoint).toBe("http://localhost:8000/v1/projects/moltbot/agent");
    });

    it("should handle custom server URL", () => {
      const endpoint = buildChatEndpoint("http://custom:9000", "my-org", "my-bot");
      expect(endpoint).toBe("http://custom:9000/v1/projects/my-org/my-bot");
    });
  });

  describe("createLlamaFarmProvider", () => {
    it("should create provider with correct ID", () => {
      const provider = createLlamaFarmProvider();
      expect(provider.id).toBe("llamafarm");
    });

    it("should have correct label", () => {
      const provider = createLlamaFarmProvider();
      expect(provider.label).toBe("LlamaFarm");
    });

    it("should have aliases", () => {
      const provider = createLlamaFarmProvider();
      expect(provider.aliases).toContain("llama-farm");
      expect(provider.aliases).toContain("lf");
    });

    it("should have auth methods", () => {
      const provider = createLlamaFarmProvider();
      expect(provider.auth).toHaveLength(1);
      expect(provider.auth[0].id).toBe("local");
      expect(provider.auth[0].kind).toBe("custom");
    });

    describe("auth flow", () => {
      let provider: ReturnType<typeof createLlamaFarmProvider>;
      let mockPrompter: {
        text: ReturnType<typeof vi.fn>;
      };
      let mockCtx: {
        prompter: typeof mockPrompter;
        config: Record<string, unknown>;
        runtime: Record<string, unknown>;
        isRemote: boolean;
        openUrl: ReturnType<typeof vi.fn>;
        oauth: { createVpsAwareHandlers: ReturnType<typeof vi.fn> };
      };

      beforeEach(() => {
        provider = createLlamaFarmProvider();

        mockPrompter = {
          text: vi.fn(),
        };

        mockCtx = {
          prompter: mockPrompter,
          config: {},
          runtime: {},
          isRemote: false,
          openUrl: vi.fn(),
          oauth: { createVpsAwareHandlers: vi.fn() },
        };
      });

      it("should prompt for server URL, namespace, project, and model", async () => {
        mockPrompter.text
          .mockResolvedValueOnce("http://localhost:8000") // serverUrl
          .mockResolvedValueOnce("moltbot") // namespace
          .mockResolvedValueOnce("agent") // project
          .mockResolvedValueOnce("qwen3-8b"); // modelName

        const authMethod = provider.auth[0];
        const result = await authMethod.run(mockCtx as never);

        expect(mockPrompter.text).toHaveBeenCalledTimes(4);
        expect(result.profiles).toHaveLength(1);
        expect(result.profiles[0].profileId).toBe("llamafarm:local");
      });

      it("should pass system_prompt via variables field (documented in notes)", async () => {
        mockPrompter.text
          .mockResolvedValueOnce("http://localhost:8000")
          .mockResolvedValueOnce("moltbot")
          .mockResolvedValueOnce("agent")
          .mockResolvedValueOnce("qwen3-8b");

        const authMethod = provider.auth[0];
        const result = await authMethod.run(mockCtx as never);

        // The notes should mention variables field
        expect(result.notes?.some((n) => n.includes("variables"))).toBe(true);
        expect(result.notes?.some((n) => n.includes("system_prompt"))).toBe(true);
      });

      it("should pass tools via variables field (documented in notes)", async () => {
        mockPrompter.text
          .mockResolvedValueOnce("http://localhost:8000")
          .mockResolvedValueOnce("moltbot")
          .mockResolvedValueOnce("agent")
          .mockResolvedValueOnce("qwen3-8b");

        const authMethod = provider.auth[0];
        const result = await authMethod.run(mockCtx as never);

        // The notes should mention tools_context
        expect(result.notes?.some((n) => n.includes("tools_context"))).toBe(true);
      });

      it("should return configPatch with provider settings", async () => {
        mockPrompter.text
          .mockResolvedValueOnce("http://localhost:8000")
          .mockResolvedValueOnce("moltbot")
          .mockResolvedValueOnce("agent")
          .mockResolvedValueOnce("qwen3-8b");

        const authMethod = provider.auth[0];
        const result = await authMethod.run(mockCtx as never);

        expect(result.configPatch?.models?.providers?.llamafarm).toBeDefined();
        const providerConfig = result.configPatch?.models?.providers?.llamafarm as Record<
          string,
          unknown
        >;
        expect(providerConfig.baseUrl).toBe(
          "http://localhost:8000/v1/projects/moltbot/agent",
        );
        expect(providerConfig.api).toBe("openai-completions");
      });

      it("should return correct default model reference", async () => {
        mockPrompter.text
          .mockResolvedValueOnce("http://localhost:8000")
          .mockResolvedValueOnce("moltbot")
          .mockResolvedValueOnce("agent")
          .mockResolvedValueOnce("my-model");

        const authMethod = provider.auth[0];
        const result = await authMethod.run(mockCtx as never);

        expect(result.defaultModel).toBe("llamafarm/my-model");
      });
    });
  });
});
