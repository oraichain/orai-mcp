import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";

export class GetDelegationsTool extends Tool {
  name = "getDelegations";
  description = `Get all delegations for a delegator on Oraichain.

  Inputs (input is a JSON string):
  delegatorAddress: string - The address of the delegator
  `;

  // @ts-ignore
  schema = z.object({
    delegatorAddress: z.string().describe("The address of the delegator"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const delegations =
        await this.oraichainKit.queryClient.staking.delegatorDelegations(
          input.delegatorAddress
        );

      return JSON.stringify({
        status: "success",
        data: {
          delegations: delegations.delegationResponses,
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
