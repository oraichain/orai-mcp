import { Tool } from "langchain/tools";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { z } from "zod";

export class OraichainTokenTransferTool extends Tool {
  name = "oraichain_token_transfer";
  description = `Transfer a token with an amount to a recipient address.

  Inputs (input is a JSON string):
  senderAddress: string - The sender address
  recipient: string - The recipient address
  publicKey: string - The public key of the sender
  amount: {
    amount: string - The amount of tokens to transfer
    denom: string - The denom of the token to transfer
  }
  `;

  // @ts-ignore
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
        message: `Successfully transferred ${input.amount.amount}${input.amount.denom} from ${input.senderAddress} to ${input.recipient}`,
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
