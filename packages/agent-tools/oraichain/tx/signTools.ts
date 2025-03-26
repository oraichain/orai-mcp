import { Tool } from "langchain/tools";
import { z } from "zod";
import { OraichainAgentKitWithSigner } from "@oraichain/agent-kit";

export class OraichainSignTool extends Tool {
  name = "oraichain_sign_direct";
  description = `Sign a transaction directly.

  Inputs (input is an object):
  signDocBase64: string - The sign doc base64
  accountIndex: number - The account index
  `;

  // @ts-ignore
  schema = z.object({
    signDocBase64: z.string().describe("The sign doc base64"),
    accountIndex: z.number().optional().describe("The account index"),
    direct: z
      .boolean()
      .optional()
      .describe("Whether to sign directly or via amino")
      .default(true),
  });

  constructor(private oraichainKit: OraichainAgentKitWithSigner) {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const response = await this.oraichainKit.sign(
        input.signDocBase64,
        input.accountIndex,
        input.direct
      );

      return JSON.stringify({
        status: "success",
        message: `Transaction successfully signed with account index ${input.accountIndex}, signature ${response.signature}, signDoc ${response.signDoc}`,
        data: response,
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

  describe("OraichainSignTool", () => {
    const mockSign = vi.fn();
    const mockOraichainKitWithSigner = {
      sign: mockSign,
    } as unknown as OraichainAgentKitWithSigner;

    const tool = new OraichainSignTool(mockOraichainKitWithSigner);

    it("should successfully sign a transaction", async () => {
      const input = {
        signDocBase64: "base64EncodedSignDoc",
        accountIndex: 0,
        direct: true,
      };

      const mockResponse = {
        signature: "signature123",
        signDoc: "signedDoc123",
      };

      mockSign.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data).toEqual(mockResponse);
      expect(mockSign).toHaveBeenCalledWith(
        input.signDocBase64,
        input.accountIndex,
        input.direct
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

    it("should handle signing errors", async () => {
      const input = {
        signDocBase64: "base64EncodedSignDoc",
        accountIndex: 0,
        direct: true,
      };

      const errorMessage = "Failed to sign transaction";
      mockSign.mockRejectedValueOnce(new Error(errorMessage));

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe(errorMessage);
    });

    it("should use default direct value when not provided", async () => {
      const input = {
        signDocBase64: "base64EncodedSignDoc",
        accountIndex: 0,
      };

      const mockResponse = {
        signature: "signature123",
        signDoc: "signedDoc123",
      };

      mockSign.mockResolvedValueOnce(mockResponse);

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(mockSign).toHaveBeenCalledWith(
        input.signDocBase64,
        input.accountIndex,
        true // default value
      );
    });
  });
}
