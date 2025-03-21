import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { zodToMCPShape } from "./utils.js";
import { Tool } from "langchain/tools";

/**
 * Creates an MCP server from a set of actions
 */
export function createMcpServer(
  tools: Tool[],
  options: {
    name: string;
    version: string;
  }
) {
  // Create MCP server instance
  const server = new McpServer({
    name: options.name,
    version: options.version,
  });

  // Convert each action to an MCP tool
  for (const action of tools) {
    const { result } = zodToMCPShape(action.schema);
    server.tool(action.name, action.description, result, async (params) => {
      try {
        // Execute the action handler with the params directly
        const result = await action.invoke(params);

        // Format the result as MCP tool response
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        console.error("error", error);
        // Handle errors in MCP format
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          ],
        };
      }
    });
  }

  return server;
}
