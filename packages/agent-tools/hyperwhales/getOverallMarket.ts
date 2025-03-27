import { Tool } from "langchain/tools";
import { z } from "zod";

export class GetOverallMarketTool extends Tool {
  name = "GetOverallMarketTool";
  description = `
  Fetches the overall market tool which helps to detect data on positions of the market in overall and latest whale activity.

  Inputs (a empty JSON string):

  Output (JSON string):
  The data will contain the information as follows:
  + Total long/short positions in volume
  + Total long/short margin in volume
  + Total long PNL and total short PNL which show the profit and loss of long and short positions in overall market.
  + Latest whale activity which show the latest trade of whales
  `;

  // @ts-ignore
  schema = z.object({});

  constructor(protected readonly FC_API_KEY: string) {
    super();
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.FC_API_KEY}`,
      },
      body: JSON.stringify({
        url: "https://www.coinglass.com/hyperliquid",
        formats: ["markdown"],
      }),
    });

    const res = await response.json();
    const data = res?.data;
    return JSON.stringify(data || "");
  }
}

if (import.meta.vitest) {
  const { describe, it } = import.meta.vitest;

  describe("HyperWhalesTool", () => {
    it("should fetch latest long/short positions on multiple coins of whales", async () => {
      // TODO: add key before running this test
      const tool = new GetOverallMarketTool(
        "fc-23e0e777b26648c5865b826641d443fd"
      );
      const result = await tool.invoke({});
      console.log(result);
    });
  }, 60000);
}
