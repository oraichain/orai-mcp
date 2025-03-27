import { Tool } from "langchain/tools";
import { z } from "zod";

export class CoinGeckoTopTokensTool extends Tool {
  name = "coingecko_top_tokens";
  description = `Fetch top 300 tokens by market cap from CoinGecko.

  This tool fetches detailed information about cryptocurrencies including:
  - Market cap rank
  - Symbol
  - Name
  - Current price
  - Market cap
  - 24h volume
  - 24h price change
  - 7d price change

  Returns the data directly in the response.
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
  const { describe, it, expect, vi } = import.meta.vitest;

  describe("CoinGeckoTopTokensTool", () => {
    const tool = new CoinGeckoTopTokensTool();

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
      // Mock fetch to simulate an error
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("API Error"));

      const result = await tool.invoke("");
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toBe("API Error");
    });
  });
}
