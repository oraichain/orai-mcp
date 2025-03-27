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
          volume24h: pool.day.volume || 0,
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
  const { describe, it, expect, vi, beforeEach } = import.meta.vitest;

  describe("LpFetchRaydiumPoolTool", () => {
    const tool = new LpFetchRaydiumPoolTool();

    // Mock data based on actual Raydium API response
    const mockRaydiumResponse = {
      id: "decf7a74-c06a-4041-bb51-d206e348cd69",
      success: true,
      data: {
        count: 2,
        data: [
          {
            type: "Concentrated",
            programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
            id: "AS5MV3ear4NZPMWXbCsEz3AdbCaXEnq4ChdaWsvLgkcM",
            mintA: {
              chainId: 101,
              address: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
              programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              logoURI:
                "https://img-v1.raydium.io/icon/USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA.png",
              symbol: "USDS",
              name: "USDS",
              decimals: 6,
              tags: ["hasFreeze"],
              extensions: {},
            },
            mintB: {
              chainId: 101,
              address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              logoURI:
                "https://img-v1.raydium.io/icon/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png",
              symbol: "USDC",
              name: "USD Coin",
              decimals: 6,
              tags: ["hasFreeze"],
              extensions: {},
            },
            rewardDefaultPoolInfos: "Clmm",
            rewardDefaultInfos: [
              {
                mint: {
                  chainId: 101,
                  address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
                  programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                  logoURI:
                    "https://img-v1.raydium.io/icon/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png",
                  symbol: "RAY",
                  name: "Raydium",
                  decimals: 6,
                  tags: [],
                  extensions: {},
                },
                perSecond: "827",
                startTime: "1732636800",
                endTime: "1735056000",
              },
              {
                mint: {
                  chainId: 101,
                  address: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
                  programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                  logoURI:
                    "https://img-v1.raydium.io/icon/USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA.png",
                  symbol: "USDS",
                  name: "USDS",
                  decimals: 6,
                  tags: ["hasFreeze"],
                  extensions: {},
                },
                perSecond: "8267",
                startTime: "1742897704",
                endTime: "1744712104",
              },
            ],
            price: 1.0000842121006,
            mintAmountA: 41947996.20663,
            mintAmountB: 48340767.77597,
            feeRate: 0.0001,
            openTime: "1732326834",
            tvl: 90292235.32,
            day: {
              volume: 1569293.1011868552,
              volumeQuote: 1569376.4383226607,
              volumeFee: 156.92931011868555,
              apr: 0.34876928351304953,
              feeApr: 0.06,
              priceMin: 0.9999739861837732,
              priceMax: 1.0001991621454571,
              rewardApr: [0, 0.28876928351304954],
            },
            week: {
              volume: 14143354.780770907,
              volumeQuote: 14144154.638686636,
              volumeFee: 1414.3354780770908,
              apr: 0.3387692835130495,
              feeApr: 0.05,
              priceMin: 0.9998044336462996,
              priceMax: 1.0001991621454571,
              rewardApr: [0, 0.28876928351304954],
            },
            month: {
              volume: 145550429.95299333,
              volumeQuote: 145559186.58781603,
              volumeFee: 14555.042995299336,
              apr: 0.47876928351304954,
              feeApr: 0.19,
              priceMin: 0.9977728285077953,
              priceMax: 1.0006464124111183,
              rewardApr: [0, 0.28876928351304954],
            },
            pooltype: [],
            farmUpcomingCount: 0,
            farmOngoingCount: 1,
            farmFinishedCount: 0,
            config: {
              id: "9iFER3bpjf1PTTCQCfTRu17EJgvsxo9pVyA9QWwEuX4x",
              index: 4,
              protocolFeeRate: 120000,
              tradeFeeRate: 100,
              tickSpacing: 1,
              fundFeeRate: 40000,
              defaultRange: 0.001,
              defaultRangePoint: [0.001, 0.003, 0.005, 0.008, 0.01],
            },
            burnPercent: 0,
          },
          {
            type: "Concentrated",
            programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
            id: "GEacZ94pW7egZsPLgNWXrWBnA5qPTfbRUU5epdfjaLF2",
            mintA: {
              chainId: 101,
              address: "So11111111111111111111111111111111111111112",
              programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              logoURI:
                "https://img-v1.raydium.io/icon/So11111111111111111111111111111111111111112.png",
              symbol: "WSOL",
              name: "Wrapped SOL",
              decimals: 9,
              tags: [],
              extensions: {},
            },
            mintB: {
              chainId: 101,
              address: "Hg8bKz4mvs8KNj9zew1cEF9tDw1x2GViB4RFZjVEmfrD",
              programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              logoURI: "",
              symbol: "",
              name: "",
              decimals: 9,
              tags: [],
              extensions: {},
            },
            rewardDefaultPoolInfos: "Clmm",
            rewardDefaultInfos: [],
            price: 61.4168944059307,
            mintAmountA: 86412.557354291,
            mintAmountB: 6649146.309850961,
            feeRate: 0.0025,
            openTime: "0",
            tvl: 26886521.36,
            day: {
              volume: 3154599.0152863422,
              volumeQuote: 1454265.714449167,
              volumeFee: 7886.497538215855,
              apr: 10.71,
              feeApr: 10.71,
              priceMin: 60.64278574047677,
              priceMax: 66.88398125995913,
              rewardApr: [],
            },
            week: {
              volume: 25329626.33774948,
              volumeQuote: 14617324.203896848,
              volumeFee: 63324.06584437371,
              apr: 7.07,
              feeApr: 7.07,
              priceMin: 60.64278574047677,
              priceMax: 106.40076738003232,
              rewardApr: [],
            },
            month: {
              volume: 54269680.35323649,
              volumeQuote: 102286512.87249725,
              volumeFee: 135674.20088309125,
              apr: 6.06,
              feeApr: 6.06,
              priceMin: 60.64278574047677,
              priceMax: 1432.1276049668486,
              rewardApr: [],
            },
            pooltype: [],
            farmUpcomingCount: 0,
            farmOngoingCount: 0,
            farmFinishedCount: 0,
            config: {
              id: "E64NGkDLLCdQ2yFNPcavaKptrEgmiQaNykUuLC1Qgwyp",
              index: 1,
              protocolFeeRate: 120000,
              tradeFeeRate: 2500,
              tickSpacing: 60,
              fundFeeRate: 40000,
              defaultRange: 0.1,
              defaultRangePoint: [0.01, 0.05, 0.1, 0.2, 0.5],
            },
            burnPercent: 99.99,
          },
        ],
        hasNextPage: true,
      },
    };

    beforeEach(() => {
      vi.resetAllMocks();
      global.fetch = vi.fn();
    });

    it("should successfully fetch pools with default parameters", async () => {
      // Mock hasNextPage to be false to avoid pagination loop
      const modifiedResponse = {
        ...mockRaydiumResponse,
        data: {
          ...mockRaydiumResponse.data,
          hasNextPage: false,
        },
      };

      // Setup mock to properly handle URL and return response with hasNextPage: false
      global.fetch = vi.fn().mockImplementation((url) => {
        // Check if URL has the expected format
        if (url.toString().includes("api-v3.raydium.io/pools/info/list")) {
          return Promise.resolve({
            ok: true,
            json: async () => modifiedResponse,
          });
        }

        // Fallback for unexpected URLs
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data).toBeDefined();
      expect(parsedResult.data.count).toBeGreaterThan(0);

      // Verify the filtered data structure
      const firstPool = parsedResult.data.data[0];
      expect(firstPool).toHaveProperty("symbol_mintA");
      expect(firstPool).toHaveProperty("symbol_mintB");
      expect(firstPool).toHaveProperty("feeRate");
      expect(firstPool).toHaveProperty("tvl");
      expect(firstPool).toHaveProperty("currentPrice");
      expect(firstPool).toHaveProperty("aprDay");
    }, 10000); // Increase timeout to 10 seconds

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("API Error"));

      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe("API Error");
    });

    it("should handle non-OK response from API", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toContain(
        "API request failed with status 500"
      );
    });

    it("should handle custom parameters", async () => {
      // Mock hasNextPage to be false to avoid pagination loop
      const modifiedResponse = {
        ...mockRaydiumResponse,
        data: {
          ...mockRaydiumResponse.data,
          hasNextPage: false,
        },
      };

      let requestUrl = "";

      // Setup mock to capture and validate the request URL
      global.fetch = vi.fn().mockImplementation((url) => {
        requestUrl = url.toString();
        return Promise.resolve({
          ok: true,
          json: async () => modifiedResponse,
        });
      });

      // Call with custom parameters
      const result = await tool.invoke({
        poolType: "standard",
        poolSortField: "volume24h",
        sortType: "asc",
      });

      // Verify URL contains the custom parameters
      expect(requestUrl).toContain("poolType=standard");
      expect(requestUrl).toContain("poolSortField=volume24h");
      expect(requestUrl).toContain("sortType=asc");

      const parsedResult = JSON.parse(result);
      expect(parsedResult.status).toBe("success");
    }, 10000);
  });
}
