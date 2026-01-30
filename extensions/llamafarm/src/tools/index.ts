/**
 * Mock tools for LlamaFarm extension
 */

export { notifyTool } from "./notify.js";
export { controlTool } from "./control.js";
export { moveTool } from "./move.js";

import { notifyTool } from "./notify.js";
import { controlTool } from "./control.js";
import { moveTool } from "./move.js";

/**
 * All mock tools for registration
 */
export const mockTools = [notifyTool, controlTool, moveTool];

/**
 * Get tool schemas in JSON-serializable format for LlamaFarm
 * This can be used to pass tools via the variables field
 */
export function getToolSchemas(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}> {
  return mockTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Serialize tools to a string for the tools_context variable
 */
export function serializeToolsForContext(): string {
  const schemas = getToolSchemas();
  return JSON.stringify(schemas, null, 2);
}
