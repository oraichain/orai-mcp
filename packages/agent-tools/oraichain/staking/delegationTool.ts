import { Tool } from "langchain/tools";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { z } from "zod";

export class OraichainDelegationTool extends Tool {
  name = "oraichain_delegation";
  description = `Get the delegation of a wallet to a validator.

  Inputs (input is a JSON string):
  address: string - The wallet address (delegator)
  validatorAddress: string - The validator address
  `;

  // @ts-ignore
  schema = z.object({
    address: z.string().describe("The wallet address"),
    validatorAddress: z.string().describe("The validator address"),
  });

  constructor(private oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const response = await this.oraichainKit.getDelegation(
        input.address,
        input.validatorAddress
      );

      if (!response.delegationResponse) {
        return JSON.stringify({
          status: "error",
          message: `No delegation found from ${input.address} to validator ${input.validatorAddress}`,
          code: "NO_DELEGATION_FOUND",
        });
      }

      return JSON.stringify({
        status: "success",
        message: `Delegation from ${input.address} to validator ${input.validatorAddress}: ${response.delegationResponse.balance?.amount} ${response.delegationResponse.balance?.denom || "orai"}`,
        data: {
          delegation: response.delegationResponse.delegation,
          balance: response.delegationResponse.balance,
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
