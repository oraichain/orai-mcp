import "dotenv/config";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { StructuredTool } from "langchain/tools";
import { createMcpServer } from "../src/mcpServer";
import {
  OraichainBalanceTool,
  DelegateTool,
  OraichainTokenTransferTool,
  OraichainBroadcastTxTool,
  OraichainBroadcastTxFromBytesTool,
  OraichainBroadcastSignDocTool,
} from "@oraichain/agent-tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Helper to start the MCP server with stdio transport
 *
 * @param actions - The actions to expose to the MCP server
 * @param solanaAgentKit - The Solana agent kit
 * @param options - The options for the MCP server
 * @returns The MCP server
 * @throws Error if the MCP server fails to start
 * @example
 * import { ACTIONS } from "./actions";
 * import { startMcpServer } from "./mcpWrapper";
 *
 * const solanaAgentKit = new SolanaAgentKit();
 *
 * startMcpServer(ACTIONS, solanaAgentKit, {
 *   name: "solana-actions",
 *   version: "1.0.0"
 * });
 */
export async function startMcpServer(
  tools: StructuredTool[],
  options: {
    name: string;
    version: string;
  }
) {
  try {
    const server = createMcpServer(tools, options);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // console.log("MCP server started");
    return server;
  } catch (error) {
    console.error("Error starting MCP server", error);
    throw error;
  }
}

(async () => {
  const agent = await OraichainAgentKit.connect(process.env.RPC_URL!);
  const ORAICHAIN_ACTIONS = [
    new OraichainBalanceTool(agent),
    new DelegateTool(agent),
    new OraichainTokenTransferTool(agent),
    new OraichainBroadcastTxTool(agent),
    new OraichainBroadcastTxFromBytesTool(agent),
    new OraichainBroadcastSignDocTool(agent),
  ];

  startMcpServer(ORAICHAIN_ACTIONS as any, {
    name: "oraichain-agent-stdio",
    version: "0.0.1",
  });
})();
