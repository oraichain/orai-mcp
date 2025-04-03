import { StructuredTool } from "langchain/tools";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { z } from "zod";

export class OraichainTokenTransferTool extends StructuredTool {
  name = "oraichain_token_transfer";
  description = `Generate a transfer message for a token with an amount to a recipient address.

  Inputs (input is an object):
  senderAddress: string - The sender address
  recipient: string - The recipient address
  publicKey: string - The public key of the sender
  amount: {
    amount: string - The amount of tokens to transfer
    denom: string - The denom of the token to transfer
  }
  `;

  schema = z.object({
    senderAddress: z.string().describe("The sender address"),
    recipient: z.string().describe("The recipient address"),
    publicKey: z.string().describe("The public key of the sender"),
    amount: z.object({
      amount: z.string().describe("The amount of tokens to transfer"),
      denom: z.string().describe("The denom of the token to transfer"),
    }),
  });

  constructor(private oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const message = await this.oraichainKit.transfer(
        input.senderAddress,
        input.publicKey,
        input.recipient,
        input.amount
      );

      return JSON.stringify({
        status: "success",
        message: `Successfully generated a transfer message for ${input.amount.amount}${input.amount.denom} from ${input.senderAddress} to ${input.recipient}`,
        data: message,
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

  describe("TransferTool", () => {
    const mockTransfer = vi.fn();
    const mockOraichainKit = {
      transfer: mockTransfer,
    } as unknown as OraichainAgentKit;

    const tool = new OraichainTokenTransferTool(mockOraichainKit);

    it("should successfully create a transfer transaction", async () => {
      const input = {
        senderAddress: "orai1...",
        recipient: "orai1...",
        publicKey: "base64PublicKey",
        amount: {
          amount: "1000000",
          denom: "orai",
        },
      };

      const mockResponse = {
        txHash: "hash123",
        height: "100",
        code: 0,
        rawLog: "success",
      };

      mockTransfer.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data).toEqual(mockResponse);
      expect(mockTransfer).toHaveBeenCalledWith(
        input.senderAddress,
        input.publicKey,
        input.recipient,
        input.amount
      );
    });

    it("should handle invalid input", async () => {
      const input = {
        // Missing required fields
        senderAddress: "orai1...",
      };

      try {
        await tool.invoke(input);
      } catch (error) {
        expect(error.message).toContain(
          "Received tool input did not match expected schema"
        );
      }
    });

    it("should handle transfer errors", async () => {
      const input = {
        senderAddress: "orai1...",
        recipient: "orai1...",
        publicKey: "base64PublicKey",
        amount: {
          amount: "1000000",
          denom: "orai",
        },
      };

      const errorMessage = "Failed to transfer";
      mockTransfer.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
