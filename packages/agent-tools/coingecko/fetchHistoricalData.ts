import { Tool } from "langchain/tools";
import { z } from "zod";

interface HistoricalData {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

interface CacheData {
  timestamp: number;
  data: HistoricalData;
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

  private cacheValidityPeriod: number; // in milliseconds
  private cache: Map<string, CacheData>;

  constructor(
    cacheValidityPeriod: number = 3600000 // 1 hour in milliseconds
  ) {
    super();
    this.cacheValidityPeriod = cacheValidityPeriod;
    this.cache = new Map<string, CacheData>();
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
      const result: { [tokenId: string]: HistoricalData } = {};
      const errors: string[] = [];

      for (const tokenId of tokenIds) {
        try {
          const cachedData = this.cache.get(tokenId);
          if (cachedData && this.isCacheValid(cachedData)) {
            result[tokenId] = cachedData.data;
          } else {
            // Add delay between requests to respect rate limits
            if (Object.keys(result).length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5s delay
            }

            const data = await this.fetchTokenData(tokenId);
            result[tokenId] = data;
            this.cache.set(tokenId, {
              timestamp: Date.now(),
              data,
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
}

if (import.meta.vitest) {
  const { describe, it, expect, vi, beforeEach, afterEach } = import.meta
    .vitest;

  describe("CoinGeckoHistoricalDataTool", () => {
    const tool = new CoinGeckoHistoricalDataTool();

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
      market_caps: [
        [1740528000000, 1759750360550.3337],
        [1740614400000, 1664314955447.7466],
        [1740700800000, 1679555320077.2097],
        [1740787200000, 1674754437110.342],
        [1740873600000, 1705564098300.8237],
        [1740960000000, 1868321705444.4878],
        [1741046400000, 1708198960874.3418],
        [1741132800000, 1731441668069.6523],
        [1741219200000, 1797706868227.531],
        [1741305600000, 1782785866811.654],
        [1741392000000, 1720436931689.2776],
        [1741478400000, 1708605516770.228],
        [1741564800000, 1602073794580.0344],
        [1741651200000, 1563547150147.7332],
        [1741737600000, 1642997419531.6057],
        [1741824000000, 1662502658717.542],
        [1741910400000, 1608477373718.186],
        [1741996800000, 1665725559905.8198],
        [1742083200000, 1674173293916.4658],
        [1742169600000, 1638672153483.722],
        [1742256000000, 1667799227887.438],
        [1742342400000, 1642578274105.806],
        [1742428800000, 1721565138141.278],
        [1742515200000, 1672550706502.8184],
        [1742601600000, 1666749159154.2927],
        [1742688000000, 1662574363663.653],
        [1742774400000, 1702009594329.4495],
        [1742860800000, 1732715331970.134],
        [1742947200000, 1735368473904.4885],
        [1743033600000, 1724854479045.6724],
        [1743060914000, 1733773052645.4683],
      ],
      total_volumes: [
        [1740528000000, 96742453402.56294],
        [1740614400000, 69277430795.68657],
        [1740700800000, 305190442156.92804],
        [1740787200000, 80695237175.07367],
        [1740873600000, 30634474722.6359],
        [1740960000000, 61859112550.80991],
        [1741046400000, 68715362745.4567],
        [1741132800000, 65863356680.42408],
        [1741219200000, 51606642859.81411],
        [1741305600000, 47555759124.64708],
        [1741392000000, 63216440874.73251],
        [1741478400000, 18809360803.37126],
        [1741564800000, 32013406240.51754],
        [1741651200000, 49983692766.22745],
        [1741737600000, 56404462275.083046],
        [1741824000000, 41782186208.59073],
        [1741910400000, 32583592654.882656],
        [1741996800000, 28571483950.074646],
        [1742083200000, 10761796127.312485],
        [1742169600000, 21638031633.118767],
        [1742256000000, 19659366246.596867],
        [1742342400000, 24557570268.85276],
        [1742428800000, 33871216993.304657],
        [1742515200000, 27579127651.06656],
        [1742601600000, 18091004975.919056],
        [1742688000000, 7771134681.982918],
        [1742774400000, 12617587530.619724],
        [1742860800000, 27270889835.1835],
        [1742947200000, 30351832942.705593],
        [1743033600000, 25522877558.700558],
        [1743060914000, 25166848393.233765],
      ],
    };

    beforeEach(() => {
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
    });

    it("should fetch and cache historical data", async () => {
      const result = await tool.invoke("bitcoin");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.bitcoin).toBeDefined();
      expect(parsedResult.data.bitcoin.prices).toBeDefined();
      expect(parsedResult.data.bitcoin.market_caps).toBeDefined();
      expect(parsedResult.data.bitcoin.total_volumes).toBeDefined();

      // Check if the mock data was properly returned
      expect(parsedResult.data.bitcoin.prices.length).toBe(31);
      expect(parsedResult.data.bitcoin.prices[0][1]).toBe(88755.7693356979);
    });

    it("should use cached data when available", async () => {
      // Mock the cache to contain ethereum data
      const mockCacheData: CacheData = {
        timestamp: Date.now(),
        data: mockMarketChartResponse as HistoricalData,
      };
      vi.spyOn(tool["cache"], "get").mockReturnValue(mockCacheData);
      vi.spyOn(tool as any, "isCacheValid").mockReturnValue(true);

      // Second call should use cache
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
  });
}
