#!/usr/bin/env node

import "dotenv/config";
import {
  OraichainAgentKit,
  OraichainAgentKitWithSigner,
} from "@oraichain/agent-kit";
import { Tool } from "langchain/tools";
import { createMcpServer } from "./mcpServer.js";
import {
  OraichainBalanceTool,
  DelegateTool,
  OraichainTokenTransferTool,
  OraichainBroadcastTxTool,
  OraichainBroadcastTxFromBytesTool,
  OraichainBroadcastSignDocTool,
  GetDelegationsTool,
  GetValidatorInfoTool,
  RedelegateTool,
  UndelegateTool,
  ClaimCommissionTool,
  OraichainSignTool,
  OraichainAccountTool,
  GetAllValidatorsInfoTool,
  OraichainTxHashInfoTool,
} from "@oraichain/agent-tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { oraichainRpcUrl, mnemonic } from "./config.js";

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
  tools: Tool[],
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

async function main() {
  const agent = await OraichainAgentKit.connect(oraichainRpcUrl);

  const ORAICHAIN_ACTIONS = [
    new OraichainBalanceTool(agent),
    new DelegateTool(agent),
    new GetDelegationsTool(agent),
    new GetValidatorInfoTool(agent),
    new GetAllValidatorsInfoTool(agent),
    new RedelegateTool(agent),
    new UndelegateTool(agent),
    new ClaimCommissionTool(agent),
    new OraichainTokenTransferTool(agent),
    new OraichainBroadcastTxTool(agent),
    new OraichainBroadcastTxFromBytesTool(agent),
    new OraichainBroadcastSignDocTool(agent),
    new OraichainTxHashInfoTool(agent),
  ];

  if (mnemonic) {
    const agentWithSigner =
      await OraichainAgentKitWithSigner.connectWithAgentKit(agent, mnemonic);

    const SIGNER_ACTIONS = [
      new OraichainSignTool(agentWithSigner),
      new OraichainAccountTool(agentWithSigner),
    ];
    ORAICHAIN_ACTIONS.push(...(SIGNER_ACTIONS as any));
  }

  startMcpServer(ORAICHAIN_ACTIONS as any, {
    name: "oraichain-agent-stdio",
    version: "0.0.1",
  });
}

main();
