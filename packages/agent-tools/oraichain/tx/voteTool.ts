/// <reference types="vitest/importMeta" />

import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKit } from "@oraichain/agent-kit";
import { makeSignBytes } from "@cosmjs/proto-signing";

/**
 * A tool for voting on governance proposals on the Oraichain network.
 * This tool creates and signs a transaction that allows users to cast their vote on active proposals.
 *
 * @remarks
 * The tool uses the Cosmos SDK governance module's MsgVote message type.
 * The fee for the transaction is automatically calculated by the chain.
 *
 * @example
 * ```typescript
 * const input = {
 *   voterAddress: "orai1...",
 *   proposalId: "1",
 *   option: "VOTE_OPTION_YES",
 *   publicKey: "base64EncodedPublicKey"
 * };
 * const result = await voteTool.invoke(input);
 * ```
 */
export class VoteTool extends Tool {
  name = "vote";
  description = `Vote on a governance proposal on Oraichain.

  Inputs:
  voterAddress: string - The address of the voter
  proposalId: string - The ID of the proposal to vote on
  option: string - The voting option (VOTE_OPTION_YES, VOTE_OPTION_NO, VOTE_OPTION_NO_WITH_VETO, VOTE_OPTION_ABSTAIN)
  publicKey: string - The voter's public key for signing
  `;

  // @ts-ignore
  schema = z.object({
    voterAddress: z.string().describe("The address of the voter"),
    proposalId: z.string().describe("The ID of the proposal to vote on"),
    option: z.string().describe("The voting option"),
    publicKey: z.string().describe("The voter's public key for signing"),
  });

  constructor(private readonly oraichainKit: OraichainAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const signDoc = await this.oraichainKit.buildSignDoc(
        input.voterAddress,
        input.publicKey,
        [
          {
            typeUrl: "/cosmos.gov.v1beta1.MsgVote",
            value: {
              voter: input.voterAddress,
              proposalId: input.proposalId,
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

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  vi.mock("@cosmjs/proto-signing", () => ({
    makeSignBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  }));

  describe("VoteTool", () => {
    const mockBuildSignDoc = vi.fn();
    const mockOraichainKit = {
      buildSignDoc: mockBuildSignDoc,
    } as unknown as OraichainAgentKit;

    const tool = new VoteTool(mockOraichainKit);

    it("should successfully create a vote transaction", async () => {
      const input = {
        voterAddress: "orai1...",
        proposalId: "1",
        option: "VOTE_OPTION_YES",
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
        input.voterAddress,
        input.publicKey,
        [
          {
            typeUrl: "/cosmos.gov.v1beta1.MsgVote",
            value: {
              voter: input.voterAddress,
              proposalId: input.proposalId,
              option: input.option,
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
        voterAddress: "orai1...",
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
        voterAddress: "orai1...",
        proposalId: "1",
        option: "VOTE_OPTION_YES",
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
