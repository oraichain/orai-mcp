import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { makeSignBytes } from "@cosmjs/proto-signing";

export class VoteTool extends Tool {
  name = "vote";
  description = `Vote on a governance proposal on Oraichain.

  Inputs (input is a JSON string):
  voter: string - The address of the voter
  proposalId: string - The ID of the proposal to vote on
  option: number - The vote option (1=YES, 2=ABSTAIN, 3=NO, 4=NO_WITH_VETO)
  publicKey: string - The voter's public key for signing
  `;

  // @ts-ignore
  schema = z.object({
    voter: z.string().describe("The address of the voter"),
    proposalId: z.string().describe("The ID of the proposal to vote on"),
    option: z
      .number()
      .int()
      .min(1)
      .max(4)
      .describe("The vote option (1=YES, 2=ABSTAIN, 3=NO, 4=NO_WITH_VETO)"),
    publicKey: z.string().describe("The voter's public key for signing"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const signDoc = await this.oraichainKit.buildSignDoc(
        input.voter,
        input.publicKey,
        [
          {
            typeUrl: "/cosmos.gov.v1beta1.MsgVote",
            value: {
              proposalId: input.proposalId,
              voter: input.voter,
              option: input.option,
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
