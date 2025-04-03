import { StructuredTool } from "langchain/tools";
import { OraichainAgentKitWithSigner } from "@oraichain/agent-kit";
import { z } from "zod";

export class OraichainAccountTool extends StructuredTool {
  name = "agent_oraichain_account";
  description = `Get the account information of your Oraichain signer wallet. This wallet can be used to sign and broadcast transactions. 

  Use it to get the account information of your signer wallet, then you can use it to sign and broadcast transactions.

  If you want to get your simple current account information, you don't need to provide the accountIndex.

  Inputs ( input is an object ):
  accountIndex: number, eg: 0,
  `;

  schema = z.object({
    accountIndex: z.number().optional().describe("The index of the wallet"),
  });

  constructor(private oraichainKit: OraichainAgentKitWithSigner) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { address, pubkey, sequence, accountNumber } =
        await this.oraichainKit.getSignerInfo(input.accountIndex);

      return JSON.stringify({
        status: "success",
        message: `Account information of ${address} with accountIndex ${input.accountIndex} is ${pubkey}, sequence: ${sequence}, accountNumber: ${accountNumber}`,
        data: {
          address,
          accountIndex: input.accountIndex,
          pubkey,
          sequence,
          accountNumber,
        },
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

  describe("BalanceTool", () => {
    const mockGetSignerInfo = vi.fn();
    const mockOraichainKit = {
      getSignerInfo: mockGetSignerInfo,
    } as unknown as OraichainAgentKitWithSigner;

    const tool = new OraichainAccountTool(mockOraichainKit);

    it("should successfully get balance", async () => {
      const input = {
        address: "orai1...",
        accountIndex: 0,
      };

      const mockResponse = {
        address: "orai1...",
        accountIndex: 0,
      };

      mockGetSignerInfo.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.accountInfo).toEqual(mockResponse);
      expect(mockGetSignerInfo).toHaveBeenCalledWith(input.accountIndex);
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

    it("should handle query errors", async () => {
      const input = {
        address: "orai1...",
        denom: "orai",
      };

      const errorMessage = "Failed to get account information";
      mockGetSignerInfo.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
