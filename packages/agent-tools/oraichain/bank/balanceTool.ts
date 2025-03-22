import { Tool } from "langchain/tools";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { z } from "zod";

export class OraichainBalanceTool extends Tool {
  name = "oraichain_balance";
  description = `Get the balance of a Oraichain wallet.

  If you want to get the balance of your first wallet, you don't need to provide the accountIndex.

  Inputs ( input is a JSON string ):
  denom: string, eg: "orai",
  address: string, eg: "orai1...",
  `;

  // @ts-ignore
  schema = z.object({
    denom: z.string().describe("The denomination of the coin"),
    address: z.string().describe("The address of the wallet"),
  });

  constructor(private oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const coin = await this.oraichainKit.getBalance(
        input.address,
        input.denom,
      );
      const amountAfterDecimals = +coin.amount / 10 ** 6;
      const coinAfterDecimals = {
        ...coin,
        amount: amountAfterDecimals.toString(),
      };

      return JSON.stringify({
        status: "success",
        message: `Balance of ${input.address} is ${coinAfterDecimals.amount}${coinAfterDecimals.denom}`,
        data: { coin, address: input.address, denom: input.denom },
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
    const mockGetBalance = vi.fn();
    const mockOraichainKit = {
      getBalance: mockGetBalance,
    } as unknown as OraichainAgentKit;

    const tool = new OraichainBalanceTool(mockOraichainKit);

    it("should successfully get balance", async () => {
      const input = {
        address: "orai1...",
        denom: "orai",
      };

      const mockResponse = {
        amount: "1000000",
        denom: "orai",
      };

      mockGetBalance.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.coin).toEqual(mockResponse);
      expect(mockGetBalance).toHaveBeenCalledWith(input.address, input.denom);
    });

    it("should handle invalid input", async () => {
      const input = {
        // Missing required fields
      };

      try {
        await tool.invoke(input);
      } catch (error) {
        expect(error.message).toContain(
          "Received tool input did not match expected schema",
        );
      }
    });

    it("should handle query errors", async () => {
      const input = {
        address: "orai1...",
        denom: "orai",
      };

      const errorMessage = "Failed to get balance";
      mockGetBalance.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
