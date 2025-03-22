import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { Coin } from "@cosmjs/stargate";
import { makeSignBytes } from "@cosmjs/proto-signing";

/**
 * A tool for delegating ORAI tokens to a validator on the Oraichain network.
 * This tool creates and signs a delegation transaction that allows users to stake their tokens with a validator.
 *
 * @remarks
 * The tool uses the Cosmos SDK staking module's MsgDelegate message type.
 * The fee for the transaction is automatically calculated by the chain.
 *
 * @example
 * ```typescript
 * const input = {
 *   delegatorAddress: "orai1...",
 *   validatorAddress: "oraivaloper1...",
 *   amount: "1000000",
 *   publicKey: "base64EncodedPublicKey"
 * };
 * const result = await delegateTool.invoke(input);
 * ```
 */
export class DelegateTool extends Tool {
  name = "delegate";
  description = `Delegate tokens to a validator on Oraichain.

  Inputs:
  delegatorAddress: string - The address of the delegator.
  validatorAddress: string - The address of the validator to delegate to.
  amount: string - The amount to delegate to. If the denom is fully uppercase, multiply the input amount by 10^6. If the denom is fully lowercase, let it be.
  denom: string - The denom of the amount to delegate to.
  publicKey: string - The delegator's public key for signing.
  `;

  // @ts-ignore
  schema = z.object({
    delegatorAddress: z.string().describe("The address of the delegator"),
    validatorAddress: z
      .string()
      .describe("The address of the validator to delegate to"),
    amount: z
      .string()
      .describe(
        "The amount to delegate to. If the denom is fully uppercase, multiply the input amount by 10^6. If the denom is fully lowercase, let it be."
      ),
    denom: z.string().describe("The denom of the amount to delegate to."),
    publicKey: z.string().describe("The delegator's public key for signing"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const amount: Coin = {
        denom: input.denom,
        amount: input.amount,
      };

      const signDoc = await this.oraichainKit.buildSignDoc(
        input.delegatorAddress,
        input.publicKey,
        [
          {
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
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

  describe("DelegateTool", () => {
    const mockBuildSignDoc = vi.fn();
    const mockOraichainKit = {
      buildSignDoc: mockBuildSignDoc,
    } as unknown as OraichainAgentKit;

    const tool = new DelegateTool(mockOraichainKit);

    it("should successfully create a delegation transaction", async () => {
      const input = {
        delegatorAddress: "orai1g4h64ksa6jqgae22h8pxfcaksg93ldj48jy2r7",
        validatorAddress: "oraivaloper1s395lfdpv9l5y38nwr07xs0jq5jhhqs7mjt68c",
        amount: "1000000.0", // Added decimal for clarity
        publicKey: "AytM0l1GZg4Z5YCLoWjmqD+5qKzM5tN8EzrKtlGmH7g=", // Sample base64 pubkey
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
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
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
