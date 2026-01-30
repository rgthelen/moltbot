/**
 * Mock move/navigation tool for LlamaFarm extension
 */

import { Type } from "@sinclair/typebox";

export const moveTool = {
  name: "llamafarm-move",
  description: "Navigate or move to a destination. This is a mock implementation for testing.",
  parameters: Type.Object({
    destination: Type.String({ description: "The destination to move to" }),
    speed: Type.Optional(
      Type.Union([Type.Literal("slow"), Type.Literal("normal"), Type.Literal("fast")], {
        description: "Movement speed (slow, normal, fast). Default: normal",
      }),
    ),
    path: Type.Optional(Type.String({ description: "Optional specific path to follow" })),
  }),

  async execute(_id: string, params: Record<string, unknown>) {
    const destination = String(params.destination ?? "");
    const speed = String(params.speed ?? "normal");
    const path = params.path ? String(params.path) : undefined;

    if (!destination.trim()) {
      return {
        content: [{ type: "text", text: "Error: destination is required" }],
        isError: true,
      };
    }

    // Mock implementation - just log and return success
    const pathInfo = path ? ` via ${path}` : "";
    console.log(`[MOCK MOVE] Moving to ${destination}${pathInfo} at ${speed} speed`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            destination,
            speed,
            path: path ?? null,
            status: "arrived",
            distance: Math.floor(Math.random() * 100) + 1, // Mock distance
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };
  },
};
