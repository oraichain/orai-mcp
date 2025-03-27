import { Tool } from "langchain/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export class CoinGeckoTopTokensTool extends Tool {
  name = "coingecko_top_tokens";
  description = `Fetch top 300 tokens by market cap from CoinGecko.

  This tool fetches detailed information about cryptocurrencies including:
  - Market cap rank
  - Symbol
  - Name
  - Current price in USD
  - Market capitalization
  - 24h trading volume
  - 24h price change percentage
  - 7d price change percentage

  No input parameter is needed. The tool will fetch data from CoinGecko API directly.
  Returns data in JSON format with token information sorted by market cap.
  
  Note: Data is cached locally to avoid rate limiting issues with the CoinGecko API.
  `;

  // @ts-ignore
  schema = z.object({
    input: z.string().optional(),
  });

  constructor() {
    super();
  }

  protected async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    try {
      // We need to fetch 3 pages to get top 300 tokens
      const allTokens = [];

      // Fetch data from CoinGecko for pages 1, 2, and 3
      for (let page = 1; page <= 3; page++) {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?" +
            new URLSearchParams({
              vs_currency: "usd",
              order: "market_cap_desc",
              per_page: "100",
              page: page.toString(),
              sparkline: "false",
              price_change_percentage: "24h,7d",
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
            `API request failed with status ${response.status} on page ${page}`
          );
        }

        const tokens = await response.json();
        allTokens.push(...tokens);

        // Add a small delay to avoid rate limiting
        if (page < 3) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Format data
      const formattedTokens = allTokens.map((token: any) => ({
        id: token.id,
        rank: token.market_cap_rank,
        symbol: token.symbol.toUpperCase(),
        name: token.name,
        price_usd: token.current_price,
        market_cap: token.market_cap,
        volume_24h: token.total_volume,
        change_24h: token.price_change_percentage_24h?.toFixed(2) || "N/A",
        change_7d:
          token.price_change_percentage_7d_in_currency?.toFixed(2) || "N/A",
      }));

      // save to file
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const filePath = path.join(__dirname, "top-tokens.json");
      fs.writeFileSync(filePath, JSON.stringify(formattedTokens, null, 2));

      return JSON.stringify({
        status: "success",
        message: `Successfully fetched ${formattedTokens.length} tokens`,
        data: {
          count: formattedTokens.length,
          tokens: formattedTokens,
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
  const { describe, it, expect, vi, beforeEach, afterEach } = import.meta
    .vitest;

  describe("CoinGeckoTopTokensTool", () => {
    const tool = new CoinGeckoTopTokensTool();

    const mockResponseData = [
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image:
          "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400",
        current_price: 87340,
        market_cap: 1732978404621,
        market_cap_rank: 1,
        fully_diluted_valuation: 1732980326028,
        total_volume: 22337331688,
        high_24h: 88268,
        low_24h: 85863,
        price_change_24h: -906.6881909918739,
        price_change_percentage_24h: -1.02745,
        market_cap_change_24h: -11689290971.870605,
        market_cap_change_percentage_24h: -0.67,
        circulating_supply: 19842506,
        total_supply: 19842528,
        max_supply: 21000000,
        ath: 108786,
        ath_change_percentage: -19.711,
        ath_date: "2025-01-20T09:11:54.494Z",
        atl: 67.81,
        atl_change_percentage: 128707.1178,
        atl_date: "2013-07-06T00:00:00.000Z",
        roi: null,
        last_updated: "2025-03-27T07:32:06.213Z",
      },
      {
        id: "ethereum",
        symbol: "eth",
        name: "Ethereum",
        image:
          "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628",
        current_price: 2025.31,
        market_cap: 244309535159,
        market_cap_rank: 2,
        fully_diluted_valuation: 244309535159,
        total_volume: 13306304530,
        high_24h: 2075.57,
        low_24h: 1985.69,
        price_change_24h: -46.678190532190456,
        price_change_percentage_24h: -2.25282,
        market_cap_change_24h: -5107092439.299561,
        market_cap_change_percentage_24h: -2.04762,
        circulating_supply: 120646923.0201429,
        total_supply: 120646923.0201429,
        max_supply: null,
        ath: 4878.26,
        ath_change_percentage: -58.46389,
        ath_date: "2021-11-10T14:24:19.604Z",
        atl: 0.432979,
        atl_change_percentage: 467876.59434,
        atl_date: "2015-10-20T00:00:00.000Z",
        roi: {
          times: 30.006654151084646,
          currency: "btc",
          percentage: 3000.6654151084645,
        },
        last_updated: "2025-03-27T07:32:12.404Z",
      },
    ];

    // Create a large mock response by duplicating the sample data
    const createMockPage = (page: number) => {
      const result = [];
      for (let i = 0; i < 50; i++) {
        // 50 items * 2 sample tokens = 100 tokens per page
        const index = (page - 1) * 100 + i * 2;
        // Clone and modify objects to give them unique ranks
        const btcClone = {
          ...mockResponseData[0],
          id: `bitcoin-${index}`,
          market_cap_rank: index + 1,
        };
        const ethClone = {
          ...mockResponseData[1],
          id: `ethereum-${index + 1}`,
          market_cap_rank: index + 2,
        };
        result.push(btcClone, ethClone);
      }
      return result;
    };

    beforeEach(() => {
      // Setup mock for fetch
      global.fetch = vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createMockPage(1)),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createMockPage(2)),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createMockPage(3)),
          })
        );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should successfully fetch tokens", async () => {
      const result = await tool.invoke("");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.count).toBe(300);
      expect(Array.isArray(parsedResult.data.tokens)).toBe(true);
      expect(parsedResult.data.tokens.length).toBe(300);

      // Check token structure
      const firstToken = parsedResult.data.tokens[0];
      expect(firstToken).toHaveProperty("rank");
      expect(firstToken).toHaveProperty("symbol");
      expect(firstToken).toHaveProperty("name");
      expect(firstToken).toHaveProperty("price_usd");
      expect(firstToken).toHaveProperty("market_cap");
      expect(firstToken).toHaveProperty("volume_24h");
      expect(firstToken).toHaveProperty("change_24h");
      expect(firstToken).toHaveProperty("change_7d");
    });

    it("should handle API errors", async () => {
      // Override the fetch mock for this test
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("API Error"));

      const result = await tool.invoke("");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe("API Error");
    });
  });
}
