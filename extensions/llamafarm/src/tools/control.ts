/**
 * Mock control tool for LlamaFarm extension
 */

import { Type } from "@sinclair/typebox";

export const controlTool = {
  name: "llamafarm-control",
  description: "Execute a control action on a target. This is a mock implementation for testing.",
  parameters: Type.Object({
    action: Type.String({ description: "The action to perform (e.g., 'start', 'stop', 'restart')" }),
    target: Type.String({ description: "The target to control (e.g., 'service', 'device')" }),
    options: Type.Optional(
      Type.Object({}, { additionalProperties: true, description: "Optional action parameters" }),
    ),
  }),

  async execute(_id: string, params: Record<string, unknown>) {
    const action = String(params.action ?? "");
    const target = String(params.target ?? "");
    const options = (params.options as Record<string, unknown>) ?? {};

    if (!action.trim()) {
      return {
        content: [{ type: "text", text: "Error: action is required" }],
        isError: true,
      };
    }

    if (!target.trim()) {
      return {
        content: [{ type: "text", text: "Error: target is required" }],
        isError: true,
      };
    }

    // Mock implementation - just log and return success
    console.log(`[MOCK CONTROL] action=${action} target=${target} options=${JSON.stringify(options)}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            action,
            target,
            status: "completed",
            options,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };
  },
};
