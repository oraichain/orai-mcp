import { Tool } from "langchain/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export class AnalyzeMarketTrendTool extends Tool {
  name = "analyze_market_trend";
  description = `Analyze market trends, calculate correlations, and analyze pools data.

  This tool:
  1. Processes pool data and token data provided in the input
  2. Calculates correlations between token pairs
  3. Analyzes price trends using EMA
  4. Calculates risk metrics and optimal ranges
  5. Returns analyzed data

  The analysis includes:
  - Token pair correlations
  - Price trends (uptrend, downtrend, neutral)
  - Risk assessments
  - Impermanent loss estimations
  - Break-even duration calculations
  
  Parameters:
  - pools: Array of pool data with token pairs, TVL, APR, etc.
  - tokens: Array of token data with symbol, id, etc.
  - historicalData: Object mapping token IDs to their historical price data
  `;

  // @ts-ignore
  schema = z.object({
    // pools: z.array(z.any()).optional(),
    // tokens: z.array(z.any()).optional(),
    // historicalData: z.record(z.string(), z.any()).optional(),
  });

  constructor() {
    super();
  }

  // read pools from file
  private readPoolsFromFile(): any[] {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, "raydium-pools.json");
    const pools = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return pools;
  }

  // read tokens from file
  private readTokensFromFile(): any[] {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, "../coingecko", "top-tokens.json");
    const tokens = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return tokens;
  }

  // read historical data from file
  private readHistoricalDataFromFile(): any {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(
      __dirname,
      "../coingecko",
      "historical-data.json"
    );
    const historicalData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return historicalData;
  }

  protected async _call(_input: z.infer<typeof this.schema>): Promise<string> {
    try {
      // const { pools, tokens, historicalData } = input;
      const pools = this.readPoolsFromFile();
      const tokens = this.readTokensFromFile();
      const historicalData = this.readHistoricalDataFromFile();

      // Validate input data
      if (!pools || !Array.isArray(pools) || pools.length === 0) {
        return JSON.stringify({
          status: "error",
          message: "Error: No pools data provided in input",
        });
      }

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

      console.log(
        `Analyzing ${pools.length} pools with ${tokens.length} tokens`
      );

      // Create a dictionary to map token symbols to their IDs
      const tokenMap = new Map();
      tokens.forEach((token: any) => {
        if (token.symbol) {
          tokenMap.set(token.symbol.toUpperCase(), token.id);
        }
      });

      // Initialize results array
      const analyzedPools: any[] = [];

      // Process each pool
      for (const pool of pools) {
        try {
          let tokenASymbol = pool.symbol_mintA?.toUpperCase();
          let tokenBSymbol = pool.symbol_mintB?.toUpperCase();
          if (tokenASymbol === "WSOL") {
            tokenASymbol = "SOL";
          }
          if (tokenBSymbol === "WSOL") {
            tokenBSymbol = "SOL";
          }

          // Skip if token symbols are not found in our token map
          if (!tokenMap.has(tokenASymbol) || !tokenMap.has(tokenBSymbol)) {
            console.warn(
              `Skipping pool ${tokenASymbol}-${tokenBSymbol}: Token not found in token map`
            );
            continue;
          }

          const tokenAId = tokenMap.get(tokenASymbol);
          const tokenBId = tokenMap.get(tokenBSymbol);

          // Get historical data for both tokens
          if (!historicalData[tokenAId] || !historicalData[tokenBId]) {
            console.warn(
              `Skipping pool ${tokenASymbol}-${tokenBSymbol}: Historical data not found`
            );
            continue;
          }

          const tokenAData = historicalData[tokenAId].data;
          const tokenBData = historicalData[tokenBId].data;

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

          // Calculate EMA and determine trends
          const tokenAWithEma = this.calculateEma(priceDataA, 21);
          const tokenBWithEma = this.calculateEma(priceDataB, 21);

          const tokenATrend = this.determineTrend(tokenAWithEma);
          const tokenBTrend = this.determineTrend(tokenBWithEma);

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

          // Assess risk level based on correlation and trends
          const riskLevel = this.assessRiskLevel(
            correlation,
            tokenATrend,
            tokenBTrend,
            drawdownLoss
          );

          // Add to analyzed pools
          const analyzedPool = {
            pool_name: `${tokenASymbol}-${tokenBSymbol}`,
            token_a: tokenASymbol,
            token_b: tokenBSymbol,
            token_a_id: tokenAId,
            token_b_id: tokenBId,
            correlation: correlation,
            token_a_trend: tokenATrend,
            token_b_trend: tokenBTrend,
            tvl: pool.tvl || 0,
            volume_24h: pool.volume24h || 0,
            apy_24h: pool.aprDay || 0,
            apy_7d: pool.aprWeek || 0,
            fee: pool.feeRate || 0,
            drawdown_loss: drawdownLoss,
            break_even_days: breakEvenDuration,
            price_range: priceRange.formatted_range,
            risk_level: riskLevel,
            id: pool.id || "",
          };

          analyzedPools.push(analyzedPool);
          console.log(
            `Analyzed pool ${tokenASymbol}-${tokenBSymbol}: Correlation=${correlation}, A Trend=${tokenATrend}, B Trend=${tokenBTrend}`
          );
        } catch (error: any) {
          console.error(`Error analyzing pool: ${error.message}`);
          continue;
        }
      }

      // save to file
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const filePath = path.join(__dirname, "analyzed-pools.json");
      fs.writeFileSync(filePath, JSON.stringify(analyzedPools, null, 2));

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

  private assessRiskLevel(
    correlation: number,
    tokenATrend: string,
    tokenBTrend: string,
    _ilRisk: number
  ): string {
    try {
      // High correlation with both tokens in same trend = Lower IL risk
      const sameTrend = tokenATrend === tokenBTrend;
      const highCorrelation = Math.abs(correlation) > 0.7;

      // Both in downtrend is high risk regardless of correlation
      if (tokenATrend === "downtrend" && tokenBTrend === "downtrend") {
        return "High";
      }

      // High correlation and same trend = Low risk
      if (highCorrelation && sameTrend) {
        return "Low";
      }

      // High correlation but different trends = Medium risk
      if (highCorrelation && !sameTrend) {
        return "Medium";
      }

      // Low correlation = Higher risk
      if (Math.abs(correlation) < 0.3) {
        return "High";
      }

      // Default to Medium risk
      return "Medium";
    } catch (error) {
      console.error("Error assessing risk level:", error);
      return "Medium"; // Default to medium risk
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
