import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { Coin } from "@cosmjs/stargate";
import { makeSignBytes } from "@cosmjs/proto-signing";

export class RedelegateTool extends Tool {
  name = "redelegate";
  description = `Redelegate tokens from one validator to another on Oraichain.

  Inputs (input is a JSON string):
  delegatorAddress: string - The address of the delegator
  validatorSrcAddress: string - The address of the source validator
  validatorDstAddress: string - The address of the destination validator
  amount: string - The amount to redelegate in ORAI
  publicKey: string - The delegator's public key for signing
  `;

  // @ts-ignore
  schema = z.object({
    delegatorAddress: z.string().describe("The address of the delegator"),
    validatorSrcAddress: z
      .string()
      .describe("The address of the source validator"),
    validatorDstAddress: z
      .string()
      .describe("The address of the destination validator"),
    amount: z.string().describe("The amount to redelegate in ORAI"),
    publicKey: z.string().describe("The delegator's public key for signing"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const amount: Coin = {
        denom: "orai",
        amount: input.amount,
      };

      const signDoc = await this.oraichainKit.buildSignDoc(
        input.delegatorAddress,
        input.publicKey,
        [
          {
            typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
            value: {
              delegatorAddress: input.delegatorAddress,
              validatorSrcAddress: input.validatorSrcAddress,
              validatorDstAddress: input.validatorDstAddress,
              amount,
            },
          },
        ],
        "auto",
        ""
      );

      return JSON.stringify({
        status: "success",
        data: {
          signDoc: Buffer.from(makeSignBytes(signDoc)).toString("base64"),
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
