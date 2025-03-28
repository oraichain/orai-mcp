import { Tool } from "langchain/tools";
import { z } from "zod";

export class AnalyzePoolTool extends Tool {
  name = "analyze_poold";
  description = `Analyze pool, calculate correlations, and analyze pools data.

  This tool:
  1. Processes pool data and historical data provided in the input
  2. Calculates correlations between token pairs
  3. Calculates risk metrics and optimal ranges
  4. Returns analyzed data

  The analysis includes:
  - Token pair correlations
  - Price trends (uptrend, downtrend, neutral)
  - Risk assessments
  - Impermanent loss estimations
  - Break-even duration calculations
  
  Parameters:
  - pools: Array of pool data with token pairs, TVL, APR, etc. See example below. {
    "symbol_mintA": "BTC",
    "symbol_mintA_id": "bitcoin",
    "symbol_mintB": "ETH",
    "symbol_mintB_id": "ethereum"
  }
  - historicalData:Object mapping token IDs to their historical price data. The prices data is an array of objects with date and price properties. Example:
  {
    "bitcoin": {
      "prices": [
        [1623456789000, 30000],
        [1623543189000, 31000],    
      ]
    }
  }
  The date is a timestamp in milliseconds.
  `;

  // @ts-ignore
  schema = z.object({
    pools: z.array(z.any()).optional(),
    historicalData: z.record(z.string(), z.any()).optional(),
  });

  constructor() {
    super();
  }

  protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { pools, historicalData } = input;

      // Validate input data
      if (!pools || !Array.isArray(pools) || pools.length === 0) {
        return JSON.stringify({
          status: "error",
          message: "Error: No pools data provided in input",
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
      const analyzedPools: any[] = [];

      // Process each pool
      for (const pool of pools) {
        try {
          let tokenASymbol = pool.symbol_mintA?.toUpperCase();
          let tokenBSymbol = pool.symbol_mintB?.toUpperCase();
          let tokenAId = pool.symbol_mintA_id;
          let tokenBId = pool.symbol_mintB_id;

          // Get historical data for both tokens
          if (!historicalData[tokenAId] || !historicalData[tokenBId]) {
            console.warn(
              `Skipping pool ${tokenASymbol}-${tokenBSymbol}: Historical data not found`
            );
            continue;
          }

          const tokenAData = historicalData[tokenAId];
          const tokenBData = historicalData[tokenBId];

          if (
            !tokenAData.prices ||
            !tokenBData.prices ||
            tokenAData.prices.length === 0 ||
            tokenBData.prices.length === 0
          ) {
            console.warn(
              `Skipping pool ${tokenASymbol}-${tokenBSymbol}: Empty historical data`
            );
            continue;
          }

          // Prepare price data in a format suitable for correlation
          const priceDataA = this.preparePriceData(tokenAData.prices);
          const priceDataB = this.preparePriceData(tokenBData.prices);

          // Calculate correlation
          const correlation = this.calculateCorrelation(priceDataA, priceDataB);

          // Calculate drawdown loss
          const currentPriceA = priceDataA[priceDataA.length - 1].price;
          const currentPriceB = priceDataB[priceDataB.length - 1].price;

          // Get 7-day lows
          const weekData = tokenAData.prices.slice(-7);
          const lowPriceA = Math.min(...weekData.map((d: any) => d[1]));

          const weekDataB = tokenBData.prices.slice(-7);
          const lowPriceB = Math.min(...weekDataB.map((d: any) => d[1]));

          const drawdownLoss = this.calculateDrawdownLoss(
            currentPriceA,
            lowPriceA,
            currentPriceB,
            lowPriceB
          );

          // Calculate break-even duration
          const breakEvenDuration = this.calculateBreakEvenDuration(
            drawdownLoss,
            pool.aprDay || 0
          );

          // Estimate price range
          const priceRange = this.estimatePriceRangeFromLows(
            currentPriceA,
            lowPriceA,
            currentPriceB,
            lowPriceB
          );

          // Add to analyzed pools
          const analyzedPool = {
            id: pool.id || "",
            pool_name: `${tokenASymbol}-${tokenBSymbol}`,
            symbol_mintA: tokenASymbol,
            symbol_mintB: tokenBSymbol,
            symbol_mintA_id: tokenAId,
            symbol_mintB_id: tokenBId,
            correlation: correlation,
            drawdown_loss: drawdownLoss,
            break_even_days: breakEvenDuration,
            price_range: priceRange.formatted_range,
          };

          analyzedPools.push(analyzedPool);
        } catch (error: any) {
          console.error(`Error analyzing pool: ${error.message}`);
          continue;
        }
      }

      // Return results
      if (analyzedPools.length > 0) {
        return JSON.stringify({
          status: "success",
          message: `Successfully analyzed ${analyzedPools.length} pools`,
          data: {
            count: analyzedPools.length,
            analyzedPools: analyzedPools,
          },
        });
      } else {
        return JSON.stringify({
          status: "error",
          message: "No pools could be analyzed. Check logs for details.",
        });
      }
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

  // Helper methods
  private preparePriceData(prices: any[]): { date: number; price: number }[] {
    return prices.map((p) => ({
      date: p[0],
      price: p[1],
    }));
  }

  private calculateCorrelation(priceDataA: any[], priceDataB: any[]): number {
    try {
      // Check if arrays are empty
      if (priceDataA.length === 0 || priceDataB.length === 0) {
        return NaN;
      }

      // Check if arrays have different lengths
      if (priceDataA.length !== priceDataB.length) {
        return NaN;
      }

      // Convert to arrays for correlation calculation
      const pricesA = priceDataA.map((d) => d.price);
      const pricesB = priceDataB.map((d) => d.price);

      // Calculate using simple stats formula
      const n = pricesA.length;
      const sumX = pricesA.reduce((a, b) => a + b, 0);
      const sumY = pricesB.reduce((a, b) => a + b, 0);
      const sumXY = pricesA.reduce((a, b, i) => a + b * pricesB[i], 0);
      const sumX2 = pricesA.reduce((a, b) => a + b * b, 0);
      const sumY2 = pricesB.reduce((a, b) => a + b * b, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt(
        (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
      );

      if (denominator === 0) return NaN;

      return numerator / denominator;
    } catch (error) {
      console.error("Error calculating correlation:", error);
      return NaN;
    }
  }

  private calculateDrawdownLoss(
    priceA: number,
    lowA: number,
    priceB: number,
    lowB: number
  ): number {
    try {
      // Ensure we don't have zero or negative prices
      if (priceA <= 0 || lowA <= 0 || priceB <= 0 || lowB <= 0) {
        console.warn(
          "Invalid price values (zero or negative) for drawdown calculation"
        );
        return 0.0;
      }

      // Handle case where low price equals current price
      let drawdownA = 0.005; // Assume minimal 0.5% drawdown
      if (priceA !== lowA) {
        drawdownA = (priceA - lowA) / priceA;
      }

      let drawdownB = 0.005; // Assume minimal 0.5% drawdown
      if (priceB !== lowB) {
        drawdownB = (priceB - lowB) / priceB;
      }

      // Apply a minimum drawdown value to avoid unrealistically low estimates
      drawdownA = Math.max(drawdownA, 0.005); // Minimum 0.5% drawdown
      drawdownB = Math.max(drawdownB, 0.005); // Minimum 0.5% drawdown

      // Calculate loss using formula
      const loss = drawdownA * (1 + drawdownB);

      // Convert to percentage
      const lossPct = loss * 100;

      return lossPct;
    } catch (error) {
      console.error("Error calculating drawdown loss:", error);
      return 0.0; // Default to no loss on error
    }
  }

  private calculateBreakEvenDuration(lossPct: number, apr: number): number {
    try {
      // Handle edge cases
      if (apr <= 0) {
        return 30; // Default to 30 days if APR is zero or negative
      }

      if (lossPct <= 0) {
        return 1; // If no loss, minimal holding period
      }

      // Calculate daily yield
      const dailyYield = apr / 365;

      // Calculate days needed to break even
      const days = lossPct / dailyYield;

      // Round up to nearest day
      return Math.max(Math.ceil(days), 1);
    } catch (error) {
      console.error("Error calculating break-even duration:", error);
      return 30; // Default to 30 days if calculation fails
    }
  }

  private estimatePriceRangeFromLows(
    priceA: number,
    lowA: number,
    priceB: number,
    lowB: number
  ): {
    min_ratio: number;
    max_ratio: number;
    min_pct: number;
    max_pct: number;
    formatted_range: string;
  } {
    try {
      // Calculate current price ratio
      const currentRatio = priceB / priceA;

      // Calculate ratio at lowest prices
      const lowRatio = lowB / lowA;

      // Calculate percent change
      const percentChange = Math.abs((currentRatio - lowRatio) / currentRatio);

      // Ensure minimum range of 5%
      const adjustedPercentChange = Math.max(percentChange, 0.05);

      // Set range based on calculation
      const minRatio = currentRatio * (1 - adjustedPercentChange);
      const maxRatio = currentRatio * (1 + adjustedPercentChange);

      // Calculate percentage representation
      const minPct = (minRatio / currentRatio - 1) * 100;
      const maxPct = (maxRatio / currentRatio - 1) * 100;

      // Format as string
      const formattedRange = `${minPct.toFixed(1)}% to ${maxPct.toFixed(1)}% from current`;

      return {
        min_ratio: minRatio,
        max_ratio: maxRatio,
        min_pct: minPct,
        max_pct: maxPct,
        formatted_range: formattedRange,
      };
    } catch (error) {
      console.error("Error estimating price range from lows:", error);
      return {
        min_ratio: 0,
        max_ratio: 0,
        min_pct: -0,
        max_pct: 0,
        formatted_range: "-0% to 0% from current",
      };
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach } = import.meta.vitest;

  describe("AnalyzeMarketTrendTool", () => {
    let tool: AnalyzePoolTool;

    beforeEach(() => {
      tool = new AnalyzePoolTool();
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
