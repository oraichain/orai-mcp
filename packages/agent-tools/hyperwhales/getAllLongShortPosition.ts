import { Tool } from "langchain/tools";
import { z } from "zod";
import NodeCache from "node-cache";

export class GetAllLongShortPositionTool extends Tool {
  cache = new NodeCache({ stdTTL: 30 });
  name = "GetAllLongShortPositionsTool";
  description = `
  Fetches the all latest long/short positions of whales across multiple coins. 
  Each call can retrieve up to 50 positions.
  The output will return total and data to know when to stop fetching. 
  If total is greater than offset, keep fetching by increasing offset by the amount of limit.

  Inputs (JSON string):
  offset: number (default: 0) - The starting position index.
  limit: number (max: 50) - The number of positions to fetch.

  Output:
  total: number - The total number of available positions, useful for pagination.
  data: array - A list of long/short positions.
  `;

  // @ts-ignore
  schema = z.object({
    offset: z.number(),
    limit: z.number().lte(50),
  });

  constructor(protected readonly CG_API_KEY: string) {
    super();
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    if (!_input.offset && _input.offset !== 0) {
      throw new Error("Please input offset");
    }

    if (!_input.limit) {
      throw new Error("Please input limit");
    }

    const cacheKey = `getAllLongShortPosition-${_input.offset}-${_input.limit}`;
    const cachedResult = this.cache.get<string>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const response = await fetch(
      "https://open-api-v3.coinglass.com/api/hyperliquid/whale-position",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "CG-API-KEY": this.CG_API_KEY,
        },
      }
    );
    const res = await response.json();
    const total = res.data.length;
    const data = res.data.slice(
      Number(_input.offset),
      Number(_input.offset) + Number(_input.limit)
    );

    this.cache.set(cacheKey, JSON.stringify({ total, data }));
    return JSON.stringify({
      total,
      data,
    });
  }
}

if (import.meta.vitest) {
  const { describe, it } = import.meta.vitest;

  describe.skip("HyperWhalesTool", () => {
    it("should fetch latest long/short positions on multiple coins of whales", async () => {
      // TODO: add key before running this test
      const tool = new GetAllLongShortPositionTool("");
      const result = await tool.invoke({ offset: 0, limit: 10 });
      console.log(result);
    });
  });
}
