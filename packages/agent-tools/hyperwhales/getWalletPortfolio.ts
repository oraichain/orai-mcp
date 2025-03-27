import { Tool } from "langchain/tools";
import { z } from "zod";
import NodeCache from "node-cache";

export class GetWalletPortfolioTool extends Tool {
  cache = new NodeCache({ stdTTL: 30 });
  name = "GetWalletPortfolioTool";
  description = `
  Fetches the portfolio of a wallet.

  Inputs (JSON string):
  address: string - The address of the whale.

  Output (JSON string):
  The data will contain the portfolio of the wallet.
  `;

  // @ts-ignore
  schema = z.object({
    address: z.string(),
  });

  constructor(protected readonly ZERION_API_KEY: string) {
    super();
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    const cacheKey = `getWalletPortfolio-${_input.address}`;
    const cachedResult = this.cache.get<string>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const response = await fetch(
      `https://api.zerion.io/v1/wallets/${_input.address}/portfolio?filter[positions]=no_filter`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `BASIC ${this.ZERION_API_KEY}`,
        },
      }
    );

    const res = await response.json();
    const data = res?.data;
    this.cache.set(cacheKey, JSON.stringify(data || ""));
    return JSON.stringify(data || "");
  }
}

if (import.meta.vitest) {
  const { describe, it } = import.meta.vitest;

  describe("HyperWhalesTool", () => {
    it("should fetch latest long/short positions on multiple coins of whales", async () => {
      // TODO: add key before running this test
      const tool = new GetWalletPortfolioTool("");
      const result = await tool.invoke({
        address: "0xeadc152ac1014ace57c6b353f89adf5faffe9d55",
      });
      console.log(result);
    });
  }, 60000);
}
