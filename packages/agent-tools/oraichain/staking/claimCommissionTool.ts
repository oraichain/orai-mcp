import { StructuredTool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { makeSignBytes } from "@cosmjs/proto-signing";

export class ClaimCommissionTool extends StructuredTool {
  name = "claimCommission";
  description = `Claim validator commission rewards on Oraichain.

  Inputs (input is an object):
  validatorAddress: string - The address of the validator
  publicKey: string - The validator's public key for signing
  `;

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

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  vi.mock("@cosmjs/proto-signing", () => ({
    makeSignBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  }));

  describe("ClaimCommissionTool", () => {
    const mockBuildSignDoc = vi.fn();
    const mockOraichainKit = {
      buildSignDoc: mockBuildSignDoc,
    } as unknown as OraichainAgentKit;

    const tool = new ClaimCommissionTool(mockOraichainKit);

    it("should successfully create a claim commission transaction", async () => {
      const input = {
        validatorAddress: "oraivaloper1...",
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
    });

    it("should handle invalid input", async () => {
      const input = {
        // Missing required fields
        validatorAddress: "oraivaloper1...",
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
        validatorAddress: "oraivaloper1...",
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
