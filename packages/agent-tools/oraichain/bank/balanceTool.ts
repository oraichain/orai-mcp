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
        input.denom
      );

      return JSON.stringify({
        status: "success",
        message: `Balance of ${input.address} is ${coin.amount}${coin.denom}`,
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
