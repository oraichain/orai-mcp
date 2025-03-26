import { Tool } from "langchain/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

interface HistoricalData {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

interface CacheData {
  timestamp: number;
  data: HistoricalData;
}

interface TokenCache {
  [tokenId: string]: CacheData;
}

export class CoinGeckoHistoricalDataTool extends Tool {
  name = "coingecko_historical_data";
  description = `Fetch historical data for a list of tokens from CoinGecko.

  This tool fetches detailed historical information about cryptocurrencies including:
  - Price history
  - Market cap history
  - Volume history
  
  Input should be a comma-separated list of token IDs (e.g., "bitcoin,ethereum").
  Data is cached for 1 hour to respect rate limits.

  Returns the historical data for each token.
  `;

  private cacheDir: string;
  private cacheFile: string;
  private cacheValidityPeriod: number; // in milliseconds

  constructor(
    cacheDir: string = "./cache",
    cacheValidityPeriod: number = 3600000 // 1 hour in milliseconds
  ) {
    super();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    this.cacheDir = path.join(__dirname, cacheDir);
    this.cacheFile = path.join(this.cacheDir, "historical_data_cache.json");
    this.cacheValidityPeriod = cacheValidityPeriod;
    this.initializeCache();
  }

  // @ts-ignore
  schema = z.object({
    input: z.string().min(1, "Token list cannot be empty"),
  });

  private initializeCache(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.cacheFile)) {
      fs.writeFileSync(this.cacheFile, JSON.stringify({}));
    }
  }

  private loadCache(): TokenCache {
    try {
      const cacheContent = fs.readFileSync(this.cacheFile, "utf-8");
      return JSON.parse(cacheContent);
    } catch (error) {
      return {};
    }
  }

  private saveCache(cache: TokenCache): void {
    fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
  }

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

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const tokenIds = input.input
        .split(",")
        .map((id: string) => id.trim().toLowerCase());
      const cache = this.loadCache();
      const result: { [tokenId: string]: HistoricalData } = {};
      const errors: string[] = [];

      for (const tokenId of tokenIds) {
        try {
          if (cache[tokenId] && this.isCacheValid(cache[tokenId])) {
            result[tokenId] = cache[tokenId].data;
          } else {
            // Add delay between requests to respect rate limits
            if (Object.keys(result).length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 500)); // 5s delay
            }

            const data = await this.fetchTokenData(tokenId);
            result[tokenId] = data;
            cache[tokenId] = {
              timestamp: Date.now(),
              data,
            };
          }
        } catch (error: any) {
          errors.push(`Error fetching ${tokenId}: ${error.message}`);
        }
      }

      // Save updated cache
      this.saveCache(cache);

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
}

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  describe("CoinGeckoHistoricalDataTool", () => {
    const tool = new CoinGeckoHistoricalDataTool("./test_cache");

    it("should fetch and cache historical data", async () => {
      const result = await tool.invoke("bitcoin");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.bitcoin).toBeDefined();
      expect(parsedResult.data.bitcoin.prices).toBeDefined();
      expect(parsedResult.data.bitcoin.market_caps).toBeDefined();
      expect(parsedResult.data.bitcoin.total_volumes).toBeDefined();
    });

    it("should use cached data when available", async () => {
      // First call to cache data
      await tool.invoke("ethereum");

      // Mock fetch to ensure it's not called again
      const fetchSpy = vi.spyOn(global, "fetch");

      // Second call should use cache
      const result = await tool.invoke("ethereum");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(parsedResult.data.ethereum).toBeDefined();
    });

    it("should handle invalid token IDs", async () => {
      const result = await tool.invoke("invalid-token-id");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("partial_success");
      expect(parsedResult.errors).toBeDefined();
      expect(parsedResult.errors.length).toBe(1);
    });
  });
}
