import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { makeSignBytes } from "@cosmjs/proto-signing";

export class ClaimCommissionTool extends Tool {
  name = "claimCommission";
  description = `Claim validator commission rewards on Oraichain.

  Inputs (input is a JSON string):
  validatorAddress: string - The address of the validator
  publicKey: string - The validator's public key for signing
  `;

  // @ts-ignore
  schema = z.object({
    validatorAddress: z.string().describe("The address of the validator"),
    publicKey: z.string().describe("The validator's public key for signing"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const signDoc = await this.oraichainKit.buildSignDoc(
        input.validatorAddress,
        input.publicKey,
        [
          {
            typeUrl:
              "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission",
            value: {
              validatorAddress: input.validatorAddress,
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
