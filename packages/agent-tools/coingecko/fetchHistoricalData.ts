import { Tool } from "langchain/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// import { tokenPriceHistory } from "./cache/tokenPriceHistory.js";

interface HistoricalData {
  prices: [number, number][]; // [timestamp, price]
}

interface CacheData {
  timestamp: number;
  data: HistoricalData;
}

interface FileCache {
  [tokenId: string]: CacheData;
}

export class CoinGeckoHistoricalDataTool extends Tool {
  name = "coingecko_historical_data";
  description = `Fetch historical data for a list of tokens from CoinGecko.

  This tool fetches detailed historical information about cryptocurrencies including:
  - Price history (daily prices for the last 30 days)
  - Market cap history
  - Volume history
  
  Input:
  - tokenIds: Array of token IDs to fetch historical data for, separated by commas. Limit 30 tokens per request. 
  So to fetch data for 300 tokens, you need to call the tool 10 times.
  Data is cached for 1 hour to respect CoinGecko API rate limits.

  The historical data collected by this tool is stored internally and used by other tools in the system:
  - AnalyzeMarketTrend tool uses this data to calculate correlations and identify price trends
  - OptimizePools tool uses this data to evaluate price ranges and estimate impermanent loss risks
  
  Returns a summary of the data fetching operation, including success status and any errors encountered.
  `;

  private cacheValidityPeriod: number; // in milliseconds
  private cacheFilePath: string;
  private apiKey: string;

  constructor(
    cacheValidityPeriod: number = 3600000, // 1 hour in milliseconds
    apiKey: string = "",
    cacheFilePath: string = "historical-data.json"
  ) {
    super();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    this.cacheValidityPeriod = cacheValidityPeriod;
    this.apiKey = apiKey;
    this.cacheFilePath = path.join(__dirname, cacheFilePath);
    this.initializeCache();
  }

  private initializeCache(): void {
    if (!fs.existsSync(this.cacheFilePath)) {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify({}), "utf-8");
    }
  }

  private readCache(): FileCache {
    try {
      const cacheContent = fs.readFileSync(this.cacheFilePath, "utf-8");
      return JSON.parse(cacheContent);
    } catch (error) {
      console.warn("Failed to read cache file, initializing empty cache");
      return {};
    }
  }

  private writeCache(cache: FileCache): void {
    try {
      fs.writeFileSync(
        this.cacheFilePath,
        JSON.stringify(cache, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to write to cache file:", error);
    }
  }

  private getCachedData(tokenId: string): CacheData | null {
    const cache = this.readCache();
    return cache[tokenId] || null;
  }

  private setCachedData(tokenId: string, data: CacheData): void {
    const cache = this.readCache();
    cache[tokenId] = data;
    this.writeCache(cache);
  }

  // @ts-ignore
  schema = z.object({
    input: z.string().min(1, "Token list cannot be empty"),
  });

  private isCacheValid(cacheData: CacheData): boolean {
    const now = Date.now();
    return now - cacheData.timestamp < this.cacheValidityPeriod;
  }

  private async fetchTokenData(tokenId: string): Promise<HistoricalData> {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?` +
        new URLSearchParams({
          vs_currency: "usd",
          days: "30",
          interval: "daily",
        }),
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "x-cg-demo-api-key": this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch data for ${tokenId}: ${response.statusText}`
      );
    }

    return await response.json();
  }

  // // read top tokens from file
  // private readTopTokensFromFile(): any[] {
  //   const __filename = fileURLToPath(import.meta.url);
  //   const __dirname = path.dirname(__filename);
  //   const filePath = path.join(__dirname, "top-tokens.json");
  //   const tokens = JSON.parse(fs.readFileSync(filePath, "utf8"));
  //   return tokens;
  // }
  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const tokenIds = input.input
        .split(",")
        .map((id: string) => id.trim().toLowerCase());
      const result: { [tokenId: string]: HistoricalData } = {};
      const errors: string[] = [];

      // const tokens = this.readTopTokensFromFile();

      for (const tokenId of tokenIds) {
        // const tokenId = token.id;
        try {
          const cachedData = this.getCachedData(tokenId);
          if (cachedData && this.isCacheValid(cachedData)) {
            result[tokenId] = cachedData.data;
          } else {
            // Add delay between requests to respect rate limits
            if (Object.keys(result).length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s delay
            }

            const data = await this.fetchTokenData(tokenId);

            result[tokenId] = {
              prices: data.prices,
            };
            this.setCachedData(tokenId, {
              timestamp: Date.now(),
              data: {
                prices: data.prices,
              },
            });
          }
        } catch (error: any) {
          errors.push(`Error fetching ${tokenId}: ${error.message}`);
        }
      }

      return JSON.stringify({
        status: errors.length === 0 ? "success" : "partial_success",
        message: `Fetched historical data for ${Object.keys(result).length} tokens${
          errors.length > 0 ? ` with ${errors.length} errors` : ""
        }`,
        errors: errors.length > 0 ? errors : undefined,
        data: result,
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }

  public clearExpiredCache(): void {
    const cache = this.readCache();
    const now = Date.now();
    let entriesRemoved = 0;

    for (const [tokenId, cacheData] of Object.entries(cache)) {
      if (now - cacheData.timestamp >= this.cacheValidityPeriod) {
        delete cache[tokenId];
        entriesRemoved++;
      }
    }

    if (entriesRemoved > 0) {
      this.writeCache(cache);
      console.log(`Cleared ${entriesRemoved} expired cache entries`);
    }
  }

  public clearCache(): void {
    this.writeCache({});
    console.log("Cache cleared successfully");
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, vi, beforeEach, afterEach } = import.meta
    .vitest;

  describe("CoinGeckoHistoricalDataTool", () => {
    const testCachePath = path.join(process.cwd(), "test-coingecko-cache.json");
    const tool = new CoinGeckoHistoricalDataTool(3600000, "", testCachePath);

    // Sample mock response for market chart data
    const mockMarketChartResponse = {
      prices: [
        [1740528000000, 88755.7693356979],
        [1740614400000, 83900.11496524839],
        [1740700800000, 84709.14477847965],
        [1740787200000, 84441.9012237131],
        [1740873600000, 86005.25629681018],
        [1740960000000, 94261.53286538439],
        [1741046400000, 86124.71418722175],
        [1741132800000, 87310.80531078295],
        [1741219200000, 90604.08098523637],
        [1741305600000, 90001.40087607042],
        [1741392000000, 86773.33597555371],
        [1741478400000, 86142.9833586432],
        [1741564800000, 80751.13893300897],
        [1741651200000, 78783.94057934263],
        [1741737600000, 82799.1080292053],
        [1741824000000, 83884.24578828987],
        [1741910400000, 81098.90052436228],
        [1741996800000, 83971.70916064628],
        [1742083200000, 84391.69087647168],
        [1742169600000, 82610.61750343916],
        [1742256000000, 84075.36559694471],
        [1742342400000, 82780.03048688271],
        [1742428800000, 86815.44109470697],
        [1742515200000, 84270.84358966233],
        [1742601600000, 84009.532917822],
        [1742688000000, 83793.30854192551],
        [1742774400000, 85787.70914901773],
        [1742860800000, 87327.72969669085],
        [1742947200000, 87520.58391530563],
        [1743033600000, 86960.8555491039],
        [1743060914000, 87430.55401845432],
      ],
    };

    beforeEach(() => {
      // Clear test cache file before each test
      if (fs.existsSync(testCachePath)) {
        fs.unlinkSync(testCachePath);
      }

      // Mock fetch for market chart data
      global.fetch = vi.fn().mockImplementation((url) => {
        // For invalid token IDs
        if (url.includes("invalid-token-id")) {
          return Promise.resolve({
            ok: false,
            statusText: "Not Found",
          });
        }

        if (url.includes("/market_chart")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMarketChartResponse),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMarketChartResponse),
        });
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      // Clean up test cache file
      if (fs.existsSync(testCachePath)) {
        fs.unlinkSync(testCachePath);
      }
    });

    it("should fetch and cache historical data", async () => {
      const result = await tool.invoke("bitcoin");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.bitcoin).toBeDefined();
      expect(parsedResult.data.bitcoin.prices).toBeDefined();

      // Verify data was cached to file
      const cacheContent = JSON.parse(fs.readFileSync(testCachePath, "utf-8"));
      expect(cacheContent.bitcoin).toBeDefined();
      expect(cacheContent.bitcoin.data.prices).toEqual(
        mockMarketChartResponse.prices
      );
    });

    it("should use cached data when available", async () => {
      // Pre-populate cache file
      const mockCacheData = {
        ethereum: {
          timestamp: Date.now(),
          data: mockMarketChartResponse,
        },
      };
      fs.writeFileSync(testCachePath, JSON.stringify(mockCacheData), "utf-8");

      const result = await tool.invoke("ethereum");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(global.fetch).not.toHaveBeenCalled();
      expect(parsedResult.data.ethereum).toBeDefined();
      expect(parsedResult.data.ethereum.prices).toEqual(
        mockMarketChartResponse.prices
      );
    });

    it("should handle invalid token IDs", async () => {
      const result = await tool.invoke("invalid-token-id");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("partial_success");
      expect(parsedResult.errors).toBeDefined();
      expect(parsedResult.errors.length).toBe(1);
      expect(parsedResult.errors[0]).toContain("invalid-token-id");
    });

    it("should clear expired cache entries", async () => {
      // Pre-populate cache with expired and valid entries
      const now = Date.now();
      const mockCacheData = {
        bitcoin: {
          timestamp: now - 7200000, // 2 hours ago (expired)
          data: mockMarketChartResponse,
        },
        ethereum: {
          timestamp: now - 1800000, // 30 minutes ago (valid)
          data: mockMarketChartResponse,
        },
      };
      fs.writeFileSync(testCachePath, JSON.stringify(mockCacheData), "utf-8");

      tool.clearExpiredCache();

      const cacheContent = JSON.parse(fs.readFileSync(testCachePath, "utf-8"));
      expect(cacheContent.bitcoin).toBeUndefined();
      expect(cacheContent.ethereum).toBeDefined();
    });

    it("should clear entire cache", async () => {
      // Pre-populate cache
      const mockCacheData = {
        bitcoin: {
          timestamp: Date.now(),
          data: mockMarketChartResponse,
        },
      };
      fs.writeFileSync(testCachePath, JSON.stringify(mockCacheData), "utf-8");

      tool.clearCache();

      const cacheContent = JSON.parse(fs.readFileSync(testCachePath, "utf-8"));
      expect(Object.keys(cacheContent).length).toBe(0);
    });
  });
}
