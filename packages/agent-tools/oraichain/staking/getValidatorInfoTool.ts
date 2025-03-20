import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";

export class GetValidatorInfoTool extends Tool {
  name = "getValidatorInfo";
  description = `Get validator information including commission on Oraichain.

  Inputs (input is a JSON string):
  validatorAddress: string - The address of the validator
  `;

  // @ts-ignore
  schema = z.object({
    validatorAddress: z.string().describe("The address of the validator"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const validator = await this.oraichainKit.queryClient.staking.validator(
        input.validatorAddress
      );
      const commission =
        await this.oraichainKit.queryClient.distribution.validatorCommission(
          input.validatorAddress
        );

      return JSON.stringify({
        status: "success",
        data: {
          validator: validator.validator,
          commission: commission.commission,
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
