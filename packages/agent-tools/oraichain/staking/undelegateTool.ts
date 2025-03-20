import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { Coin } from "@cosmjs/stargate";
import { makeSignBytes } from "@cosmjs/proto-signing";

export class UndelegateTool extends Tool {
  name = "undelegate";
  description = `Undelegate tokens from a validator on Oraichain.

  Inputs (input is a JSON string):
  delegatorAddress: string - The address of the delegator
  validatorAddress: string - The address of the validator to undelegate from
  amount: string - The amount to undelegate in ORAI
  publicKey: string - The delegator's public key for signing
  `;

  // @ts-ignore
  schema = z.object({
    delegatorAddress: z.string().describe("The address of the delegator"),
    validatorAddress: z
      .string()
      .describe("The address of the validator to undelegate from"),
    amount: z.string().describe("The amount to undelegate in ORAI"),
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
            typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
            value: {
              delegatorAddress: input.delegatorAddress,
              validatorAddress: input.validatorAddress,
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
