import { Tool } from "langchain/tools";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { z } from "zod";

export class OraichainBroadcastTxTool extends Tool {
  name = "oraichain_broadcast_tx";
  description = `Broadcast a signed transaction to the network.

  Inputs (input is a JSON string):
  signedTx: string - The signed transaction in base64 format
  `;

  // @ts-ignore
  schema = z.object({
    signedTx: z.string().describe("The signed transaction in base64 format"),
  });

  constructor(private oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const txHash = await this.oraichainKit.broadcastTxSync(input.signedTx);

      return JSON.stringify({
        status: "success",
        message: `Transaction successfully broadcasted with hash: ${txHash}`,
        data: { txHash },
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}

export class OraichainBroadcastTxFromBytesTool extends Tool {
  name = "oraichain_broadcast_tx_from_bytes";
  description = `Broadcast a signed transaction to the network using signed body bytes, auth bytes and signature.

  Inputs (input is a JSON string):
  signedBodyBytes: string - The signed transaction body in base64 format
  signedAuthBytes: string - The signed transaction auth info in base64 format
  signatures: string[] - The signatures for the transaction in base64 format
  `;

  // @ts-ignore
  schema = z.object({
    signedBodyBytes: z
      .string()
      .describe("The signed transaction body in base64 format"),
    signedAuthBytes: z
      .string()
      .describe("The signed transaction auth info in base64 format"),
    signatures: z.array(
      z.string().describe("The signatures for the transaction in base64 format")
    ),
  });

  constructor(private oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const txHash =
        await this.oraichainKit.broadcastTxSyncFromDirectSignDocAndSignature(
          input.signedBodyBytes,
          input.signedAuthBytes,
          input.signatures
        );

      return JSON.stringify({
        status: "success",
        message: `Transaction successfully broadcasted with hash: ${txHash}`,
        data: { txHash },
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}

export class OraichainBroadcastSignDocTool extends Tool {
  name = "oraichain_broadcast_sign_doc";
  description = `Broadcast a sign doc base64 to the network.

  Inputs (input is a JSON string):
  signDocBase64: string - The sign doc base64
  publicKey: string - The public key
  signature: string - The signature
  `;

  // @ts-ignore
  schema = z.object({
    signDocBase64: z.string().describe("The sign doc base64"),
    publicKey: z.string().describe("The public key"),
    signature: z.string().describe("The signature"),
  });

  constructor(private oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const txHash = await this.oraichainKit.broadcastSignDocBase64(
        input.signDocBase64,
        input.publicKey,
        input.signature
      );

      return JSON.stringify({
        status: "success",
        message: `Transaction successfully broadcasted with hash: ${txHash}`,
        data: { txHash },
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  describe("BroadcastTools", () => {
    const mockBroadcastTx = vi.fn();
    const mockOraichainKit = {
      broadcastTxSync: mockBroadcastTx,
    } as unknown as OraichainAgentKit;

    const tool = new OraichainBroadcastTxTool(mockOraichainKit);

    it("should successfully broadcast a transaction", async () => {
      const input = {
        signedTx: "base64EncodedTxBytes",
      };

      const mockResponse = {
        txHash: "hash123",
        height: "100",
        code: 0,
        rawLog: "success",
      };

      mockBroadcastTx.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.txHash).toEqual(mockResponse);
      expect(mockBroadcastTx).toHaveBeenCalledWith(input.signedTx);
    });

    it("should handle invalid input", async () => {
      const input = {
        // Missing required fields
      };

      try {
        await tool.invoke(input);
      } catch (error) {
        expect(error.message).toContain(
          "Received tool input did not match expected schema"
        );
      }
    });

    it("should handle broadcast errors", async () => {
      const input = {
        signedTx: "base64EncodedTxBytes",
      };

      const errorMessage = "Failed to broadcast transaction";
      mockBroadcastTx.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
