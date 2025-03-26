import { Tool } from "langchain/tools";
import { z } from "zod";

export class LpFetchRaydiumPoolTool extends Tool {
  name = "lp_fetch_raydium_pool";
  description = `Get all pool information from Raydium API.

  This tool fetches detailed information about Raydium liquidity pools including:
  - Pool type (Concentrated, Standard)
  - Token pairs (mintA, mintB) with their details
  - Current price and TVL
  - Price range (min/max) for different timeframes (day, week, month)
  - Volume, fees, and APR statistics for different timeframes (day, week, month)
  - Pool configuration and farm status

  The response includes:
  - Pool ID and program ID
  - Token information (symbol, name, decimals)
  - Price and liquidity data (current price, historical price ranges)
  - Fee rates and trading metrics
  - APR breakdowns (trading fees + rewards)
  - Farm status (upcoming, ongoing, finished counts)
  - Market information for pools with OrderBook
  - LP token details and burn percentages

  Parameters (provide as JSON string):
  - poolType: "all" | "standard" | "concentrated" | "allFarm" | "standardFarm" | "concentratedFarm"
  - poolSortField: "default" |"liquidity" | "volume24h" | "fee24h" | "apr24h" | "volume7d" | "fee7d" | "apr7d" | "volume30d" | "fee30d" | "apr30d"
  - sortType: "asc" | "desc"
  `;

  // @ts-ignore
  schema = z.object({
    poolType: z
      .enum([
        "all",
        "standard",
        "concentrated",
        "allFarm",
        "standardFarm",
        "concentratedFarm",
      ])
      .optional(),
    poolSortField: z
      .enum([
        "default",
        "liquidity",
        "volume24h",
        "fee24h",
        "apr24h",
        "volume7d",
        "fee7d",
        "apr7d",
        "volume30d",
        "fee30d",
        "apr30d",
      ])
      .optional(),
    sortType: z.enum(["asc", "desc"]).optional(),
  });

  constructor() {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://raydium.io",
        Referer: "https://raydium.io/",
      };

      let allPools: any[] = [];
      let currentPage = 1;
      let hasNextPage = true;
      const MAX_POOLS = 300;

      while (hasNextPage && allPools.length < MAX_POOLS) {
        const queryParams = new URLSearchParams({
          poolType: input.poolType || "all",
          poolSortField: input.poolSortField || "liquidity",
          sortType: input.sortType || "desc",
          pageSize: "1000",
          page: currentPage.toString(),
        });

        const response = await fetch(
          `https://api-v3.raydium.io/pools/info/list?${queryParams.toString()}`,
          { headers }
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const responseData = await response.json();

        if (!responseData.success) {
          throw new Error("Failed to fetch pool data");
        }

        const {
          data: { data: pools, hasNextPage: nextPage },
        } = responseData;

        // Filter pools to include only the requested fields
        const filteredPools = pools.map((pool: any) => ({
          symbol_mintA: pool.mintA.symbol,
          symbol_mintB: pool.mintB.symbol,
          feeRate: pool.feeRate,
          tvl: pool.tvl,
          currentPrice: pool.price,
          aprDay: pool.day?.apr || 0,
          dayPriceMin: pool.day?.priceMin || 0,
          dayPriceMax: pool.day?.priceMax || 0,
          aprWeek: pool.week?.apr || 0,
          weekPriceMin: pool.week?.priceMin || 0,
          weekPriceMax: pool.week?.priceMax || 0,
          aprMonth: pool.month?.apr || 0,
          monthPriceMin: pool.month?.priceMin || 0,
          monthPriceMax: pool.month?.priceMax || 0,
        }));

        // Add pools up to the MAX_POOLS limit
        const remainingSpace = MAX_POOLS - allPools.length;
        const poolsToAdd = filteredPools.slice(0, remainingSpace);
        allPools = allPools.concat(poolsToAdd);

        // Stop if we've reached the limit
        if (allPools.length >= MAX_POOLS) {
          break;
        }

        hasNextPage = nextPage;
        currentPage++;

        // Add a small delay between requests to avoid rate limiting
        if (hasNextPage) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return JSON.stringify({
        status: "success",
        message: `Successfully fetched top ${allPools.length} Raydium pools with filtered data`,
        data: {
          count: allPools.length,
          data: allPools,
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

  describe("LpFetchRaydiumPoolTool", () => {
    const tool = new LpFetchRaydiumPoolTool();

    it("should successfully fetch pools with default parameters", async () => {
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data).toBeDefined();
    });

    it("should handle custom parameters", async () => {
      const input = {
        input: JSON.stringify({
          poolType: "standard",
          poolSortField: "liquidity",
          sortType: "desc",
        }),
      };

      const result = await tool.invoke(input);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data).toBeDefined();
    });

    it("should handle API errors", async () => {
      // Mock fetch to simulate an error
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("API Error"));

      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe("API Error");
    });
  });
}
