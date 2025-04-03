import { StructuredTool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";

export class GetDelegationsTool extends StructuredTool {
  name = "getDelegations";
  description = `Get all delegations for a delegator on Oraichain.

  Inputs (input is an object):
  delegatorAddress: string - The address of the delegator
  `;

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

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  describe("GetDelegationsTool", () => {
    const mockDelegatorDelegations = vi.fn();
    const mockOraichainKit = {
      queryClient: {
        staking: {
          delegatorDelegations: mockDelegatorDelegations,
        },
      },
    } as unknown as OraichainAgentKit;

    const tool = new GetDelegationsTool(mockOraichainKit);

    it("should successfully get delegations", async () => {
      const input = {
        delegatorAddress: "orai1...",
      };

      const mockResponse = {
        delegationResponses: [
          {
            delegation: {
              delegatorAddress: input.delegatorAddress,
              validatorAddress: "oraivaloper1...",
              shares: "1000000",
            },
            balance: {
              denom: "orai",
              amount: "1000000",
            },
          },
        ],
      };

      mockDelegatorDelegations.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.delegations).toEqual(
        mockResponse.delegationResponses
      );
      expect(mockDelegatorDelegations).toHaveBeenCalledWith(
        input.delegatorAddress
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
        delegatorAddress: "orai1...",
      };

      const errorMessage = "Failed to get delegations";
      mockDelegatorDelegations.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
