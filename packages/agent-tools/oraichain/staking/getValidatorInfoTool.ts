import { StructuredTool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";

export class GetValidatorInfoTool extends StructuredTool {
  name = "get_validator_info";
  description = `Get validator information including commission on Oraichain given a validator address.

  Inputs (input is an object):
  validatorAddress: string - The address of the validator
  `;

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

      return JSON.stringify(
        {
          status: "success",
          data: {
            validator: validator.validator,
            commission: commission.commission,
          },
        },
        (_, value) => {
          // If the value is a BigInt, convert it to a string with "n" suffix
          if (typeof value === "bigint") {
            return value.toString();
          }
          return value; // Otherwise, return the value unchanged
        }
      );
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}

export class GetAllValidatorsInfoTool extends StructuredTool {
  name = "get_all_validators_info";
  description = `Get all validators information including commission on Oraichain. You don't need to provide any input. This tool is useful when you want to get all validators information.

  It will return a list of validators with their information including moniker, operator address, commission rate, etc. You should use this tool when users want to ask you about a validator without knowing the validator address, but only know the moniker.

  Inputs (input is empty)
  `;

  schema = z.object({});

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const validators =
        await this.oraichainKit.queryClient.staking.validators(
          "BOND_STATUS_BONDED"
        );

      const validatorsWithCommission = await Promise.all(
        validators.validators.map(async (validator) => {
          const commission =
            await this.oraichainKit.queryClient.distribution.validatorCommission(
              validator.operatorAddress
            );

          return {
            validator,
            commission: commission.commission,
          };
        })
      );

      return JSON.stringify(
        {
          status: "success",
          data: validatorsWithCommission,
        },
        (_, value) => {
          // If the value is a BigInt, convert it to a string with "n" suffix
          if (typeof value === "bigint") {
            return value.toString();
          }
          return value; // Otherwise, return the value unchanged
        }
      );
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

  describe("GetValidatorInfoTool", () => {
    const mockValidator = vi.fn();
    const mockValidatorCommission = vi.fn();
    const mockOraichainKit = {
      queryClient: {
        staking: {
          validator: mockValidator,
        },
        distribution: {
          validatorCommission: mockValidatorCommission,
        },
      },
    } as unknown as OraichainAgentKit;

    const tool = new GetValidatorInfoTool(mockOraichainKit);

    it("should successfully get validator info", async () => {
      const input = {
        validatorAddress: "oraivaloper1...",
      };

      const mockValidatorResponse = {
        validator: {
          operatorAddress: input.validatorAddress,
          consensusPubkey: {
            type: "tendermint/PubKeyEd25519",
            value: "base64EncodedPublicKey",
          },
          jailed: false,
          status: "BOND_STATUS_BONDED",
          tokens: "1000000000",
          delegatorShares: "1000000000.000000000000000000",
          description: {
            moniker: "Test Validator",
            identity: "",
            website: "",
            securityContact: "",
            details: "",
          },
          unbondingHeight: "0",
          unbondingTime: "1970-01-01T00:00:00Z",
          commission: {
            commissionRates: {
              rate: "0.100000000000000000",
              maxRate: "0.200000000000000000",
              maxChangeRate: "0.010000000000000000",
            },
            updateTime: "1970-01-01T00:00:00Z",
          },
          minSelfDelegation: "1",
        },
      };

      const mockCommissionResponse = {
        commission: {
          commission: [
            {
              denom: "orai",
              amount: "100000",
            },
          ],
        },
      };

      mockValidator.mockResolvedValueOnce(mockValidatorResponse);
      mockValidatorCommission.mockResolvedValueOnce(mockCommissionResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data).toEqual({
        validator: mockValidatorResponse.validator,
        commission: mockCommissionResponse.commission,
      });
      expect(mockValidator).toHaveBeenCalledWith(input.validatorAddress);
      expect(mockValidatorCommission).toHaveBeenCalledWith(
        input.validatorAddress
      );
    });

    it("should handle invalid input", async () => {
      const input = {
        // Missing required fields
      };

      try {
        await tool.invoke(input);
      } catch (error) {
        expect(error.message).toContain(
          "Received tool input did not match expected schema"
        );
      }
    });

    it("should handle query errors", async () => {
      const input = {
        validatorAddress: "oraivaloper1...",
      };

      const errorMessage = "Failed to get validator info";
      mockValidator.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
