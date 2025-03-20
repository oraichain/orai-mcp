import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  JSONRPCMessage,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";

async function main() {
  // const receivedMessages = [];
  const transport = new SSEClientTransport(
    new URL("http://localhost:8080/sse"),
  );

  // Listen for SSE events
  transport.onmessage = (_event: JSONRPCMessage | JSONRPCResponse) => {
    const event = _event as JSONRPCResponse;
    console.log("Received SSE message:", event.result);
  };

  await transport.start();
  console.log("transport started");

  const testMessage: JSONRPCMessage = {
    jsonrpc: "2.0",
    id: "test-1",
    method: "tools/call",
    params: {
      _meta: { progressToken: 0 },
      name: "TOKEN_BALANCE_ACTION",
      arguments: {
        address: "orai1f5nyvnx5ks738d5ys7pwa0evc42v6ff043h6d2",
        denom: "orai",
      },
    },
  };

  await transport.send(testMessage);
}

main();
