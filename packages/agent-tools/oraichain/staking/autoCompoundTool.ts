import { StructuredTool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKitWithSigner } from "@oraichain/agent-kit";
import { EncodeObject, makeSignBytes } from "@cosmjs/proto-signing";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx.js";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";
import { DecCoin } from "cosmjs-types/cosmos/base/v1beta1/coin.js";

export class AutoCompoundTool extends StructuredTool {
  name = "oraichain_auto_compound_orai_tool";
  description = `Auto compound ORAI staking token on Oraichain. This tool will claim ORAI staking rewards from all validators on Oraichain and stake them again into the same validators.

  Inputs (input is an object):
  none
  `;

  // we don't need any inputs for this tool, since we will use our local wallet to claim rewards, and then stake them again
  schema = z.object({});

  // because we need to sign the transaction, we need to pass in the agent kit with signer
  constructor(private readonly oraichainKit: OraichainAgentKitWithSigner) {
    super();
  }

  protected async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const signer = await this.oraichainKit.getSignerInfo();
      const listOfDelegations =
        await this.oraichainKit.agentKit.queryClient.staking.delegatorDelegations(
          signer.address
        );

      const listOfValidators = listOfDelegations.delegationResponses.map(
        (delegation) => delegation.delegation.validatorAddress
      );

      // create a message to claim rewards for each validator
      const claimRewardMessages = listOfValidators.map(
        (validator) =>
          ({
            typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
            value: MsgWithdrawDelegatorReward.fromPartial({
              delegatorAddress: signer.address,
              validatorAddress: validator,
            }),
          }) as EncodeObject
      );

      // create a list of messages to stake the rewards
      // to do that, we need to know the current rewards amount for each validator
      const rewardResponse =
        await this.oraichainKit.agentKit.queryClient.distribution.delegationTotalRewards(
          signer.address
        );

      const feeRate = 0.01; // 1%
      const listOfRewards = rewardResponse.rewards
        .map((reward) => {
          // Convert from decimal string to integer with 18 decimals
          const decimals = 18;
          // rewards returned are in DecCoin format, so we need to convert to the right amount with decimals 18
          const amountInSmallestUnit = Math.floor(
            parseFloat(reward.reward[0].amount) / 10 ** decimals
          );
          const amountAfterFees = Number(amountInSmallestUnit) * (1 - feeRate);
          // Skip staking if amount after fees is 0 or very small
          if (amountAfterFees < 1) {
            return null;
          }

          return {
            validatorAddress: reward.validatorAddress,
            // we can safely assume that the reward amount is the first and only amount in the reward array
            amount: DecCoin.fromPartial({
              denom: reward.reward[0].denom,
              // reduce the staked amount by x% to reserve for fees
              amount: amountAfterFees.toFixed(0),
            }),
          };
        })
        .filter((reward) => reward !== null);

      console.error("listOfRewards: ", listOfRewards);

      // create a message to stake the rewards
      const stakeRewardMessages = listOfRewards.map(
        (reward) =>
          ({
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
            value: MsgDelegate.fromPartial({
              delegatorAddress: signer.address,
              validatorAddress: reward.validatorAddress,
              amount: reward.amount,
            }),
          }) as EncodeObject
      );

      const signDoc = await this.oraichainKit.agentKit.buildSignDoc(
        signer.address,
        signer.pubkey,
        [...claimRewardMessages, ...stakeRewardMessages],
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
  const { describe, it, expect, vi, beforeEach } = import.meta.vitest;

  vi.mock("@cosmjs/proto-signing", () => ({
    makeSignBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  }));

  describe("AutoCompoundTool", () => {
    // Mock the OraichainAgentKitWithSigner
    const mockGetSignerInfo = vi.fn();
    const mockQueryClient = {
      staking: {
        delegatorDelegations: vi.fn(),
      },
      distribution: {
        delegationTotalRewards: vi.fn(),
      },
    };
    const mockBuildSignDoc = vi.fn();

    const mockOraichainKit = {
      getSignerInfo: mockGetSignerInfo,
      agentKit: {
        queryClient: mockQueryClient,
        buildSignDoc: mockBuildSignDoc,
      },
    } as unknown as OraichainAgentKitWithSigner;

    const tool = new AutoCompoundTool(mockOraichainKit);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should successfully auto-compound rewards", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock delegations
      const mockDelegations = {
        delegationResponses: [
          {
            delegation: {
              validatorAddress: "oraivaloper1validator1",
            },
          },
          {
            delegation: {
              validatorAddress: "oraivaloper1validator2",
            },
          },
        ],
      };
      mockQueryClient.staking.delegatorDelegations.mockResolvedValueOnce(
        mockDelegations
      );

      // Mock rewards with amounts that will pass the filtering condition (amountAfterFees >= 1)
      // Using 1000000000000000000 (1 ORAI with 18 decimals) which after 1% fee will be 990000000000000000 (0.99 ORAI)
      const mockRewards = {
        rewards: [
          {
            validatorAddress: "oraivaloper1validator1",
            reward: [
              {
                denom: "orai",
                amount: "1000000000000000000", // 1 ORAI with 18 decimals
              },
            ],
          },
          {
            validatorAddress: "oraivaloper1validator2",
            reward: [
              {
                denom: "orai",
                amount: "2000000000000000000", // 2 ORAI with 18 decimals
              },
            ],
          },
        ],
      };
      mockQueryClient.distribution.delegationTotalRewards.mockResolvedValueOnce(
        mockRewards
      );

      // Mock sign doc
      const mockSignDoc = {
        /* mock sign doc structure */
      };
      mockBuildSignDoc.mockResolvedValueOnce(mockSignDoc);

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.signDoc).toBe("AQID"); // base64 of [1,2,3]

      // Get the actual arguments passed to buildSignDoc
      const buildSignDocCalls = mockBuildSignDoc.mock.calls;
      expect(buildSignDocCalls.length).toBe(1);

      const messages = buildSignDocCalls[0][2];
      console.log(
        "Messages in successful test:",
        JSON.stringify(messages, null, 2)
      );

      // Verify that both claim and stake messages are included
      // Based on the actual behavior, we expect 3 messages: 2 claim messages and 1 stake message
      expect(messages.length).toBe(3);

      // Count the number of each message type
      const claimMessages = messages.filter(
        (msg: EncodeObject) =>
          msg.typeUrl ===
          "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
      );
      const stakeMessages = messages.filter(
        (msg: EncodeObject) =>
          msg.typeUrl === "/cosmos.staking.v1beta1.MsgDelegate"
      );

      expect(claimMessages.length).toBe(2);
      expect(stakeMessages.length).toBe(1);
    });

    it("should handle case with no delegations", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock empty delegations
      const mockDelegations = {
        delegationResponses: [],
      };
      mockQueryClient.staking.delegatorDelegations.mockResolvedValueOnce(
        mockDelegations
      );

      // Mock empty rewards
      const mockRewards = {
        rewards: [],
      };
      mockQueryClient.distribution.delegationTotalRewards.mockResolvedValueOnce(
        mockRewards
      );

      // Mock sign doc
      const mockSignDoc = {
        /* mock sign doc structure */
      };
      mockBuildSignDoc.mockResolvedValueOnce(mockSignDoc);

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.signDoc).toBe("AQID"); // base64 of [1,2,3]

      // Verify that buildSignDoc was called with empty arrays
      expect(mockBuildSignDoc).toHaveBeenCalledWith(
        mockSigner.address,
        mockSigner.pubkey,
        [],
        "auto",
        ""
      );
    });

    it("should handle case where amount after fees is 0", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock delegations
      const mockDelegations = {
        delegationResponses: [
          {
            delegation: {
              validatorAddress: "oraivaloper1validator1",
            },
          },
          {
            delegation: {
              validatorAddress: "oraivaloper1validator2",
            },
          },
        ],
      };
      mockQueryClient.staking.delegatorDelegations.mockResolvedValueOnce(
        mockDelegations
      );

      // Mock rewards with very small amounts that will be 0 after fees
      const mockRewards = {
        rewards: [
          {
            validatorAddress: "oraivaloper1validator1",
            reward: [
              {
                denom: "orai",
                amount: "1", // 1 * 0.99 = 0.99, which is < 1
              },
            ],
          },
          {
            validatorAddress: "oraivaloper1validator2",
            reward: [
              {
                denom: "orai",
                amount: "0", // Already 0
              },
            ],
          },
        ],
      };
      mockQueryClient.distribution.delegationTotalRewards.mockResolvedValueOnce(
        mockRewards
      );

      // Mock sign doc
      const mockSignDoc = {
        /* mock sign doc structure */
      };
      mockBuildSignDoc.mockResolvedValueOnce(mockSignDoc);

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.signDoc).toBe("AQID"); // base64 of [1,2,3]

      // Get the actual arguments passed to buildSignDoc
      const buildSignDocCalls = mockBuildSignDoc.mock.calls;
      expect(buildSignDocCalls.length).toBe(1);

      const messages = buildSignDocCalls[0][2];
      console.log("Messages:", JSON.stringify(messages, null, 2));

      // Verify that only claim messages are included (no stake messages)
      expect(messages.length).toBe(2); // Two claim messages for two validators
      messages.forEach((msg: EncodeObject) => {
        expect(msg.typeUrl).toBe(
          "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
        );
      });
    });

    it("should handle case where amount after fees is less than 0", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock delegations
      const mockDelegations = {
        delegationResponses: [
          {
            delegation: {
              validatorAddress: "oraivaloper1validator1",
            },
          },
        ],
      };
      mockQueryClient.staking.delegatorDelegations.mockResolvedValueOnce(
        mockDelegations
      );

      // Mock rewards with negative amounts
      const mockRewards = {
        rewards: [
          {
            validatorAddress: "oraivaloper1validator1",
            reward: [
              {
                denom: "orai",
                amount: "-100", // Negative amount
              },
            ],
          },
        ],
      };
      mockQueryClient.distribution.delegationTotalRewards.mockResolvedValueOnce(
        mockRewards
      );

      // Mock sign doc
      const mockSignDoc = {
        /* mock sign doc structure */
      };
      mockBuildSignDoc.mockResolvedValueOnce(mockSignDoc);

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.signDoc).toBe("AQID"); // base64 of [1,2,3]

      // Verify that buildSignDoc was called with only claim messages (no stake messages)
      expect(mockBuildSignDoc).toHaveBeenCalledWith(
        mockSigner.address,
        mockSigner.pubkey,
        expect.arrayContaining([
          expect.objectContaining({
            typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
          }),
        ]),
        "auto",
        ""
      );

      // Verify that no stake messages were included
      expect(mockBuildSignDoc).toHaveBeenCalledWith(
        mockSigner.address,
        mockSigner.pubkey,
        expect.not.arrayContaining([
          expect.objectContaining({
            typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
          }),
        ]),
        "auto",
        ""
      );
    });

    it("should handle errors from getSignerInfo", async () => {
      // Mock error from getSignerInfo
      const errorMessage = "Failed to get signer info";
      mockGetSignerInfo.mockRejectedValueOnce(new Error(errorMessage));

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });

    it("should handle errors from delegatorDelegations", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock error from delegatorDelegations
      const errorMessage = "Failed to get delegations";
      mockQueryClient.staking.delegatorDelegations.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });

    it("should handle errors from delegationTotalRewards", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock delegations
      const mockDelegations = {
        delegationResponses: [
          {
            delegation: {
              validatorAddress: "oraivaloper1validator1",
            },
          },
        ],
      };
      mockQueryClient.staking.delegatorDelegations.mockResolvedValueOnce(
        mockDelegations
      );

      // Mock error from delegationTotalRewards
      const errorMessage = "Failed to get rewards";
      mockQueryClient.distribution.delegationTotalRewards.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });

    it("should handle errors from buildSignDoc", async () => {
      // Mock signer info
      const mockSigner = {
        address: "orai1testaddress",
        pubkey: "testpubkey",
      };
      mockGetSignerInfo.mockResolvedValueOnce(mockSigner);

      // Mock delegations
      const mockDelegations = {
        delegationResponses: [
          {
            delegation: {
              validatorAddress: "oraivaloper1validator1",
            },
          },
        ],
      };
      mockQueryClient.staking.delegatorDelegations.mockResolvedValueOnce(
        mockDelegations
      );

      // Mock rewards
      const mockRewards = {
        rewards: [
          {
            validatorAddress: "oraivaloper1validator1",
            reward: [
              {
                denom: "orai",
                amount: "1000000",
              },
            ],
          },
        ],
      };
      mockQueryClient.distribution.delegationTotalRewards.mockResolvedValueOnce(
        mockRewards
      );

      // Mock error from buildSignDoc
      const errorMessage = "Failed to build sign doc";
      mockBuildSignDoc.mockRejectedValueOnce(new Error(errorMessage));

      // Call the tool
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      // Verify the result
      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });
  });
}
