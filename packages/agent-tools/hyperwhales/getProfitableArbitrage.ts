import { Tool } from "langchain/tools";
import { z } from "zod";

export class GetProfitableArbitrageTool extends Tool {
  name = "GetProfitableArbitrageTool";
  description = `A tool for profitable arbitrage opportunities between centralized-exchanges

  Inputs: (input is a JSON string):
  usd: number - amount of USD to spend on arbitrage. Ex: if you have 10000 usd, you can set usd equal 10000,
  limit: number - number of positions to receive. Default is 30.

  Output:
  The output will be a list of arbitrage opportunities.
  With each opportunity:
  - The field profit should be in currency unit, precisely in usd.
  - The field fee should be in currency unit, precisely in usd.
  - The field takerFee and makerFee is the relative in percentage.
  `;

  // @ts-ignore
  schema = z.object({
    usd: z.number().optional(),
    limit: z.number().optional(),
  });

  constructor(protected readonly CG_API_KEY: string) {
    super();
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    const response = await fetch(
      `https://open-api-v3.coinglass.com/api/futures/fundingRate/arbitrage?usd=${_input.usd}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "CG-API-KEY": this.CG_API_KEY,
        },
      }
    );
    const res = await response.json();
    const data = res.data.slice(0, Number(_input.limit));
    return JSON.stringify(data);
  }
}

if (import.meta.vitest) {
  const { describe, it } = import.meta.vitest;

  describe.skip("HyperWhalesTool", () => {
    it("should fetch profitable arbitrage opportunities between centralized-exchanges", async () => {
      // TODO: add key before running this test
      const tool = new GetProfitableArbitrageTool("");
      const result = await tool.invoke({ usd: 10000, limit: 10 });
      console.log(result);
    });
  });
}
