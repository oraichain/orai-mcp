import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { Coin } from "@cosmjs/stargate";
import { makeSignBytes } from "@cosmjs/proto-signing";

export class UndelegateTool extends Tool {
  name = "undelegate";
  description = `Undelegate tokens from a validator on Oraichain.

  Inputs (input is an object):
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

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  vi.mock("@cosmjs/proto-signing", () => ({
    makeSignBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  }));

  describe("UndelegateTool", () => {
    const mockBuildSignDoc = vi.fn();
    const mockOraichainKit = {
      buildSignDoc: mockBuildSignDoc,
    } as unknown as OraichainAgentKit;

    const tool = new UndelegateTool(mockOraichainKit);

    it("should successfully create an undelegation transaction", async () => {
      const input = {
        delegatorAddress: "orai1...",
        validatorAddress: "oraivaloper1...",
        amount: "1000000",
        publicKey: "base64PublicKey",
      };

      const mockSignDoc = {
        /* mock sign doc structure */
      };
      mockBuildSignDoc.mockResolvedValueOnce(mockSignDoc);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.signDoc).toBe("AQID"); // base64 of [1,2,3]
      expect(mockBuildSignDoc).toHaveBeenCalledWith(
        input.delegatorAddress,
        input.publicKey,
        [
          {
            typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
            value: {
              delegatorAddress: input.delegatorAddress,
              validatorAddress: input.validatorAddress,
              amount: {
                denom: "orai",
                amount: input.amount,
              },
            },
          },
        ],
        "auto",
        ""
      );
    });

    it("should handle invalid input", async () => {
      const input = {
        // Missing required fields
        delegatorAddress: "orai1...",
      };

      try {
        await tool.invoke(input);
      } catch (error) {
        expect(error.message).toContain(
          "Received tool input did not match expected schema"
        );
      }
    });

    it("should handle buildSignDoc errors", async () => {
      const input = {
        delegatorAddress: "orai1...",
        validatorAddress: "oraivaloper1...",
        amount: "1000000",
        publicKey: "base64PublicKey",
      };

      const errorMessage = "Failed to build sign doc";
      mockBuildSignDoc.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
