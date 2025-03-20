import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Readable } from "stream";
import { IncomingMessage } from "http";
import { OraichainAgentKit } from "../agent-kit/oraichain";
import { createMcpServer } from "./mcpServer";
import { oraichainRpcUrl, serverPort } from "./config";
import HyperExpress from "hyper-express";
import cors from "cors";
import { version } from "./package.json";
import {
  OraichainBalanceTool,
  OraichainBroadcastSignDocTool,
  OraichainBroadcastTxFromBytesTool,
  OraichainBroadcastTxTool,
  DelegateTool,
  OraichainTokenTransferTool,
} from "@oraichain/agent-tools";

const app = new HyperExpress.Server({ fast_buffers: true });
const port = Number(serverPort);

// Extend HyperExpress Response with writeHead
declare module "hyper-express" {
  interface Response {
    writeHead(name: string, value: string | string[]): Response;
    writeHead(statusCode: number, headers?: Record<string, string>): Response;
  }
}

// Add writeHead method to HyperExpress Response since SSEServerTransport uses it internally
HyperExpress.Response.prototype.writeHead = function (
  statusCodeOrName: number | string,
  headersOrValue?: Record<string, string> | string | string[]
) {
  if (typeof statusCodeOrName === "number") {
    this.status(statusCodeOrName);
    if (
      headersOrValue &&
      typeof headersOrValue === "object" &&
      !Array.isArray(headersOrValue)
    ) {
      this.set(headersOrValue);
    }
  } else {
    this.set(statusCodeOrName, headersOrValue as string | string[]);
  }
  return this;
};

const sessions: Record<string, SSEServerTransport> = {};
let server: McpServer;

app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

app.use(async (req, res) => {
  // if json post
  if (
    req.method === "POST" &&
    req.headers["content-type"] === "application/json"
  ) {
    req.body = await req.json();
  }
});

app.post("/", async (req, res) => {
  res.json(req.body);
});

app.get("/", async (req, res) => {
  res.json("Success!!");
});

app.get("/version", async (req, res) => {
  res.json({ version });
});

app.get("/sse", async (req, res) => {
  try {
    if (!server) {
      throw new Error("Server not initialized");
    }

    const connectionId = Date.now().toString();
    const transport = new SSEServerTransport("/messages", res as any);

    await server.connect(transport);
    console.log(`SSE connection established: ${connectionId}`);
    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions[sessionId] = transport;
    }

    req.on("close", () => {
      delete sessions[sessionId];
      console.log(`Connection ${connectionId} closed`);
    });
  } catch (error) {
    console.error("SSE setup error:", error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    return res.status(400).send("Missing sessionId parameter");
  }

  const session = sessions[sessionId];

  if (!session?.handlePostMessage) {
    return res
      .status(503)
      .send(`No active SSE connection for session ${sessionId}`);
  }

  // Access the parsed body from express.json()
  const body = req.body;
  console.log("POST /messages body:", body);

  // Reconstruct the request stream from the parsed body
  const rawBody = JSON.stringify(body);
  const newReqStream = Readable.from(rawBody);

  // Create a new IncomingMessage-like object
  // handlePostMessage needs a readable stream
  // when we interrupt the request (express.json()) -> make stream not readable
  // so we need to reconstruct it
  const newReq: IncomingMessage = Object.assign(newReqStream, {
    headers: req.headers,
    method: req.method,
    url: req.url,
    // Required IncomingMessage properties with defaults or copied values
    aborted: req.destroyed ?? false,
    // Add other properties if needed by handlePostMessage
  }) as IncomingMessage;

  try {
    await session.handlePostMessage(newReq, res as any);
  } catch (error) {
    console.error("Error in POST /messages:", error);
    res
      .status(400)
      .json({ error: "Failed to process message", details: error.message });
  }
});

app.listen(port, "0.0.0.0", async () => {
  try {
    const agent = await OraichainAgentKit.connect(oraichainRpcUrl);
    const ORAICHAIN_ACTIONS = [
      new OraichainBalanceTool(agent),
      new DelegateTool(agent),
      new OraichainTokenTransferTool(agent),
      new OraichainBroadcastTxTool(agent),
      new OraichainBroadcastTxFromBytesTool(agent),
      new OraichainBroadcastSignDocTool(agent),
    ];

    server = createMcpServer(ORAICHAIN_ACTIONS as any, {
      name: "oraichain-mcp-server",
      version: "0.0.1",
    });
    console.log(`Server listening on port ${port}`);
  } catch (error) {
    console.error("Server initialization failed:", error);
    process.exit(1);
  }
});
