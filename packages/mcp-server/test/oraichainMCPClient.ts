import * as readline from "readline";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  CompiledStateGraph,
  MemorySaver,
  StateType,
} from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatMistralAI } from "@langchain/mistralai";
import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Runnable, RunnableToolLike } from "@langchain/core/runnables";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { DynamicJsonSchema, jsonSchemaToZod } from "./utils";

// Configuration

// MCP Message interface
interface MCPMessage {
  type: string;
  context?: string;
  data?: any;
}

function validateEnvironment(): void {
  const missingVars: string[] = [];
  const requiredVars = ["MISTRAL_API_KEY"];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}

validateEnvironment();

async function initializeAgent(tools: BindToolsInput[]) {
  const llm = new ChatMistralAI({
    modelName: "mistral-large-latest",
    temperature: 0.3,
    apiKey: process.env.MISTRAL_API_KEY!,
  });

  const memory = new MemorySaver();

  return createReactAgent({
    llm,
    tools: tools as RunnableToolLike[],
    // checkpointSaver: memory,
    messageModifier: `
      You are a helpful agent running on the client side. You can process prompts locally and call the MCP server
      for blockchain interactions using the 'mcp_tool'. Be concise and helpful. If a tool call fails with a 5XX error,
      ask the user to try again later. If the user requests something beyond your tools, suggest they implement it
      using the Oraichain Agent Kit.
    `,
  });
}

class MCPClient {
  constructor(
    private readonly mcp: Client,
    private readonly agent: CompiledStateGraph<StateType<{}>, any>
  ) {}

  static async connectToServer(serverScriptPath: string) {
    // Initialize transport and connect to server
    // Determine script type and appropriate command
    const isJs = serverScriptPath.endsWith(".js");
    const isTs = serverScriptPath.endsWith(".ts");
    const isPy = serverScriptPath.endsWith(".py");
    if (!isJs && !isPy && !isTs) {
      throw new Error("Server script must be a .js, .ts or .py file");
    }
    const command = isPy
      ? process.platform === "win32"
        ? "python"
        : "python3"
      : "tsx";
    const transport = new StdioClientTransport({
      command,
      args: [serverScriptPath],
    });

    const mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
    mcp.connect(transport);
    const toolsResult = await mcp.listTools();
    const tools = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description!,
      schema: jsonSchemaToZod(tool.inputSchema as DynamicJsonSchema),
    }));
    const agent = await initializeAgent(tools);
    const client = new MCPClient(mcp, agent);

    // List available tools
    return client;
  }

  async processQuery(query: string) {
    /**
     * Process a query using Claude and available tools
     *
     * @param query - The user's input query
     * @returns Processed response as a string
     */

    const response = await this.agent.invoke({
      messages: [new HumanMessage(query)],
    });
    // console.debug("response: ", response.messages);

    // Process response and handle tool calls
    const finalText: any[] = [];

    for (const msg of response.messages) {
      if (msg instanceof AIMessage) {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Handle tool calls
          for (const toolCall of msg.tool_calls) {
            // console.debug("tool call: ", toolCall);
            const result = await this.mcp.callTool({
              name: toolCall.name,
              arguments: toolCall.args,
            });

            const response = await this.agent.invoke({
              messages: [new HumanMessage(JSON.stringify(result.content))],
            });
            // console.debug("response: ", response);
            finalText.push(
              response.messages[response.messages.length - 1].content
            );
          }
        }
      }
    }
    return finalText.join("\n");
  }

  async chatLoop() {
    /**
     * Run an interactive chat loop
     */
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message: string = await new Promise((resolve) =>
          rl.question("\nQuery: ", (answer) => resolve(answer))
        );
        if (message.toLowerCase() === "quit") {
          break;
        }
        try {
          const response = await this.processQuery(message);
          console.log("\n" + response);
        } catch (error) {
          console.error("Error processing query:", error);
        }
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    /**
     * Clean up resources
     */
    await this.mcp.close();
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node build/index.js <path_to_server_script>");
    return;
  }
  const mpcClient = await MCPClient.connectToServer(process.argv[2]);
  try {
    await mpcClient.chatLoop();
  } finally {
    await mpcClient.cleanup();
    process.exit(0);
  }
}

main();

// query balance of wallet orai14h0n2nlfrfz8tn9usfyjrxqd23fhj9a0ec0pm7 with denom orai

// with denom factory/orai17hyr3eg92fv34fdnkend48scu32hn26gqxw3hnwkfy904lk9r09qqzty42/XuanDang, query for me wallet balance orai1g4h64yjt0fvzv5v2j8tyfnpe5kmnetejvfgs7g
