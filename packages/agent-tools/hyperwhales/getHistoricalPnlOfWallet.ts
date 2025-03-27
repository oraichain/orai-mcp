import { Tool } from "langchain/tools";
import { z } from "zod";
import NodeCache from "node-cache";

export class GetHistoricalPnlOfWalletTool extends Tool {
  cache = new NodeCache({ stdTTL: 30 });
  name = "GetHistoricalPnlOfWalletTool";
  description = `
  Fetches the historical profit and loss of each wallet. This can be used to fetched pnl of whales or normal user.

  Inputs (JSON string):
  address: string - The address of the whale.

  Output (JSON string):
  The data will contain the total profit and loss of the whale by specific time range and in total.
  Also including their current trading positions.
  `;

  // @ts-ignore
  schema = z.object({
    address: z.string(),
  });

  constructor(protected readonly FC_API_KEY: string) {
    super();
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    const cacheKey = `getHistoricalPnlOfWhale-${_input.address}`;
    const cachedResult = this.cache.get<string>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.FC_API_KEY}`,
      },
      body: JSON.stringify({
        url: `https://www.coinglass.com/hyperliquid/${_input.address}`,
        formats: ["markdown"],
      }),
    });

    const res = await response.json();
    const data = res?.data;
    this.cache.set(cacheKey, JSON.stringify(data || ""));
    return JSON.stringify(data || "");
  }
}

if (import.meta.vitest) {
  const { describe, it } = import.meta.vitest;

  describe.skip("HyperWhalesTool", () => {
    it("should fetch latest long/short positions on multiple coins of whales", async () => {
      // TODO: add key before running this test
      const tool = new GetHistoricalPnlOfWalletTool("");
      const result = await tool.invoke({
        address: "0x20c2d95a3dfdca9e9ad12794d5fa6fad99da44f5",
      });
      console.log(result);
    });
  }, 60000);
}
