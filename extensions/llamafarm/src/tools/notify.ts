/**
 * Mock notification tool for LlamaFarm extension
 */

import { Type } from "@sinclair/typebox";

export const notifyTool = {
  name: "llamafarm-notify",
  description: "Send a notification message. This is a mock implementation for testing.",
  parameters: Type.Object({
    message: Type.String({ description: "The notification message to send" }),
    level: Type.Optional(
      Type.Union([Type.Literal("info"), Type.Literal("warn"), Type.Literal("error")], {
        description: "Notification level (info, warn, error). Default: info",
      }),
    ),
    title: Type.Optional(Type.String({ description: "Optional notification title" })),
  }),

  async execute(_id: string, params: Record<string, unknown>) {
    const message = String(params.message ?? "");
    const level = String(params.level ?? "info");
    const title = params.title ? String(params.title) : undefined;

    if (!message.trim()) {
      return {
        content: [{ type: "text", text: "Error: message is required" }],
        isError: true,
      };
    }

    // Mock implementation - just log and return success
    const logPrefix = title ? `[${title}]` : "";
    console.log(`[MOCK NOTIFY ${level.toUpperCase()}] ${logPrefix} ${message}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            notified: true,
            level,
            message,
            title: title ?? null,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    };
  },
};
