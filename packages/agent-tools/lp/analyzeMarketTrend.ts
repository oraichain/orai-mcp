import { Tool } from "langchain/tools";
import { z } from "zod";

export class AnalyzeMarketTrendTool extends Tool {
  name = "analyze_market_trend";
  description = `Analyze market trends, calculate correlations, and analyze pools data.

  This tool:
  1. Processes token data provided in the input
  2. Analyzes price trends using EMA

  The analysis includes:
  - Price trends (uptrend, downtrend, neutral)

  
  Parameters:
  - tokens: Array of token data with symbol, id.
  - historicalData: Object mapping token IDs to their historical price data. The prices data is an array of objects with date and price properties. Example:
  {
    "bitcoin": {
      "prices": [
        [1623456789000, 30000],
        [1623543189000, 31000],    
      ]
    }
  }
  The date is a timestamp in milliseconds.

  Returns:
  - status: "success" or "error"
  - message: "Successfully analyzed <count> tokens" or error message
  - data: {
    count: <number of tokens analyzed>,
    analyzedTokens: <array of analyzed tokens>
  }
  `;

  // @ts-ignore
  schema = z.object({
    tokens: z.array(z.any()).optional(),
    historicalData: z.record(z.string(), z.any()).optional(),
  });

  constructor() {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { tokens, historicalData } = input;

      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return JSON.stringify({
          status: "error",
          message: "Error: No tokens data provided in input",
        });
      }

      if (
        !historicalData ||
        typeof historicalData !== "object" ||
        Object.keys(historicalData).length === 0
      ) {
        return JSON.stringify({
          status: "error",
          message: "Error: No historical data provided in input",
        });
      }

      // Initialize results array
      const analyzedTokens: any[] = [];

      // Process each pool
      for (const token of tokens) {
        try {
          const tokenId = token.id;

          // Get historical data for both tokens
          if (!historicalData[tokenId]) {
            continue;
          }

          const priceData = historicalData[tokenId].prices;

          if (!priceData || priceData.length === 0) {
            console.warn(`Skipping token ${tokenId}: Empty historical data`);
            continue;
          }

          // Calculate EMA and determine trends
          const tokenAWithEma = this.calculateEma(priceData, 21);

          const tokenATrend = this.determineTrend(tokenAWithEma);

          analyzedTokens.push({
            id: tokenId,
            symbol: token.symbol,
            trend: tokenATrend,
          });
          console.log(`Analyzed pool ${tokenId}: Trend=${tokenATrend}`);
        } catch (error: any) {
          console.error(`Error analyzing pool: ${error.message}`);
          continue;
        }
      }

      // Return results

      return JSON.stringify({
        status: "success",
        message: `Successfully analyzed ${analyzedTokens.length} tokens`,
        data: {
          count: analyzedTokens.length,
          analyzedTokens,
        },
      });
    } catch (error: any) {
      const errorMsg = `Error in market trend analysis: ${error.message}`;
      console.error(errorMsg);
      return JSON.stringify({
        status: "error",
        message: errorMsg,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }

  private calculateEma(priceData: any[], period: number = 21): any[] {
    try {
      if (priceData.length === 0) {
        return priceData;
      }

      const alpha = 2 / (period + 1);
      const result = [...priceData];
      let ema = priceData[0].price;

      for (let i = 0; i < priceData.length; i++) {
        ema = (priceData[i].price - ema) * alpha + ema;
        result[i] = { ...result[i], ema };
      }

      return result;
    } catch (error) {
      console.error("Error calculating EMA:", error);
      return priceData;
    }
  }

  private determineTrend(priceDataWithEma: any[]): string {
    try {
      // Get the last few data points
      const recentData = priceDataWithEma.slice(-5);

      // Check if EMA is available
      if (!recentData[0].ema) {
        return "neutral";
      }

      // Check if price is above EMA
      const priceAboveEma =
        recentData[recentData.length - 1].price >
        recentData[recentData.length - 1].ema;

      // Check if EMA is rising
      const emaRising =
        recentData[recentData.length - 1].ema >
        recentData[recentData.length - 3].ema;

      if (priceAboveEma && emaRising) {
        return "uptrend";
      } else if (!priceAboveEma && !emaRising) {
        return "downtrend";
      } else {
        return "neutral";
      }
    } catch (error) {
      console.error("Error determining trend:", error);
      return "neutral";
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach } = import.meta.vitest;

  describe("AnalyzeMarketTrendTool", () => {
    let tool: AnalyzeMarketTrendTool;

    beforeEach(() => {
      tool = new AnalyzeMarketTrendTool();
      // vi.spyOn(console, "log").mockImplementation(() => {});
      // vi.spyOn(console, "warn").mockImplementation(() => {});
      // vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should handle missing input data gracefully", async () => {
      const result = await tool.invoke({});
      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("error");
      expect(parsedResult.message).toContain("No pools data provided");
    });

    it("should analyze pools correctly from input data", async () => {
      // Mock input data
      const mockPools = [
        {
          symbol_mintA: "BTC",
          symbol_mintB: "ETH",
          feeRate: 0.0001,
          tvl: 3500000,
          currentPrice: 208.27,
          volume24h: 954022.68,
          aprDay: 30693.1,
          dayPriceMin: 208.24,
          dayPriceMax: 208.29,
          aprWeek: 3530.46,
          weekPriceMin: 208.24,
          weekPriceMax: 208.29,
          aprMonth: 1412.18,
          monthPriceMin: 208.24,
          monthPriceMax: 208.29,
        },
      ];

      const mockTokens = [
        { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
        { id: "ethereum", symbol: "ETH", name: "Ethereum" },
      ];

      const mockHistoricalData = {
        bitcoin: {
          prices: [
            [1623456789000, 30000],
            [1623543189000, 31000],
            [1623629589000, 32000],
            [1623715989000, 31500],
            [1623802389000, 32500],
            [1623888789000, 33000],
            [1623975189000, 32000],
          ],
        },
        ethereum: {
          prices: [
            [1623456789000, 2000],
            [1623543189000, 2100],
            [1623629589000, 2200],
            [1623715989000, 2150],
            [1623802389000, 2250],
            [1623888789000, 2300],
            [1623975189000, 2200],
          ],
        },
      };

      const result = await tool.invoke({
        pools: mockPools,
        tokens: mockTokens,
        historicalData: mockHistoricalData,
      });

      const parsedResult = JSON.parse(result);

      expect(parsedResult.status).toBe("success");
      expect(parsedResult.data.count).toBe(1);
      expect(parsedResult.data.analyzedPools.length).toBe(1);
      expect(parsedResult.data.analyzedPools[0].token_a).toBe("BTC");
      expect(parsedResult.data.analyzedPools[0].token_b).toBe("ETH");
      expect(parsedResult.data.analyzedPools[0]).toHaveProperty("correlation");
      expect(parsedResult.data.analyzedPools[0]).toHaveProperty(
        "token_a_trend"
      );
      expect(parsedResult.data.analyzedPools[0]).toHaveProperty(
        "break_even_days"
      );
      expect(parsedResult.data.analyzedPools[0]).toHaveProperty("risk_level");
    });
  });
}
