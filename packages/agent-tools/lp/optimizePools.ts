import { Tool } from "langchain/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Default minimum values
const MIN_TVL = 200000; // Minimum TVL in USD
const MIN_VOLUME_24H = 50000; // Minimum 24-hour volume in USD

// Utility functions
const calculateDrawdownLoss = (
  priceA: number,
  lowA: number,
  priceB: number,
  lowB: number
): number => {
  try {
    // Ensure we don't have zero or negative prices
    if (priceA <= 0 || lowA <= 0 || priceB <= 0 || lowB <= 0) {
      console.warn(
        "Invalid price values (zero or negative) for drawdown calculation"
      );
      return 0.0;
    }

    // Handle case where low price equals current price
    let drawdownA = priceA === lowA ? 0.005 : (priceA - lowA) / priceA;
    let drawdownB = priceB === lowB ? 0.005 : (priceB - lowB) / priceB;

    // Apply a minimum drawdown value to avoid unrealistically low estimates
    drawdownA = Math.max(drawdownA, 0.005); // Minimum 0.5% drawdown
    drawdownB = Math.max(drawdownB, 0.005); // Minimum 0.5% drawdown

    // Calculate loss using formula
    const loss = drawdownA * (1 + drawdownB);

    // Convert to percentage
    const lossPct = loss * 100;

    return lossPct;
  } catch (error) {
    console.error(`Error calculating drawdown loss: ${error}`);
    return 0.0; // Default to no loss on error
  }
};

const calculateBreakEvenDuration = (lossPct: number, apr: number): number => {
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
    console.error(`Error calculating break-even duration: ${error}`);
    return 30; // Default to 30 days if calculation fails
  }
};

const estimatePriceRangeFromLows = (
  priceA: number,
  lowA: number,
  priceB: number,
  lowB: number
): {
  minRatio: number;
  maxRatio: number;
  minPct: number;
  maxPct: number;
  formattedRange: string;
} => {
  try {
    // Calculate current price ratio
    const currentRatio = priceB / priceA;

    // Calculate ratio at lowest prices
    const lowRatio = lowB / lowA;

    // Calculate percent change
    const percentChange = Math.abs((currentRatio - lowRatio) / currentRatio);

    // Ensure minimum range of 5%
    const adjustedPercentChange = Math.max(percentChange, 0.05);

    // Set range based on direction of movement
    const minRatio = currentRatio * (1 - adjustedPercentChange);
    const maxRatio = currentRatio * (1 + adjustedPercentChange);

    // Calculate percentage representation
    const minPct = (minRatio / currentRatio - 1) * 100;
    const maxPct = (maxRatio / currentRatio - 1) * 100;

    // Format as string
    const formattedRange = `${minPct.toFixed(1)}% to ${maxPct.toFixed(1)}% from current`;

    return {
      minRatio,
      maxRatio,
      minPct,
      maxPct,
      formattedRange,
    };
  } catch (error) {
    console.error(`Error estimating price range from lows: ${error}`);
    return {
      minRatio: 0,
      maxRatio: 0,
      minPct: 0,
      maxPct: 0,
      formattedRange: "0% to 0% from current",
    };
  }
};

const assessRiskLevel = (
  correlation: number,
  tokenATrend: string,
  tokenBTrend: string,
  _ilRisk: number
): string => {
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
    console.error(`Error assessing risk level: ${error}`);
    return "Medium"; // Default to medium risk
  }
};

// Main optimizer tool
export class OptimizePoolsTool extends Tool {
  name = "optimize_pools";
  description = `Optimize and recommend liquidity pools based on analyzed data.
  This tool analyzes pool data to provide optimized liquidity pool recommendations by:
  1. Filtering pools based on TVL, volume, and APY parameters
  2. Calculating drawdown loss based on 7-day price lows
  3. Calculating break-even duration for each pool
  4. Estimating optimal price ranges based on historical data
  5. Assessing risk levels for each pool
  6. Sorting pools by efficiency (APY to loss ratio)
  
  Parameters:
  - minTvl: Minimum TVL in USD for pool filtering (default: ${MIN_TVL})
  - minVolume24h: Minimum 24-hour volume in USD for pool filtering (default: ${MIN_VOLUME_24H})
  - minApy: Minimum APY percentage for pool filtering (default: 5.0)
  
  These are just suggestions for pools that might be suitable. Please consider additional factors before making a decision.`;

  // Fix for schema type issue
  // @ts-ignore
  schema = z.object({
    minTvl: z.number().optional(),
    minVolume24h: z.number().optional(),
    minApy: z.number().optional(),
  });

  constructor() {
    super();
  }

  // read analyzed pools from file
  private readAnalyzedPoolsFromFile(): any[] {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, "analyzed-pools.json");
    const analyzedPools = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return analyzedPools;
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
  protected async _call(input: {
    minTvl?: number;
    minVolume24h?: number;
    minApy?: number;
  }): Promise<string> {
    try {
      // read analyzed pools from file
      const analyzedPools = this.readAnalyzedPoolsFromFile();
      const historicalData = this.readHistoricalDataFromFile();

      // Use provided parameters or default values
      const minTvl = input.minTvl ?? MIN_TVL;
      const minVolume24h = input.minVolume24h ?? MIN_VOLUME_24H;
      const minApy = input.minApy ?? 5.0;

      console.log(
        `Optimizing pools with parameters: minTvl=$${minTvl}, minVolume24h=$${minVolume24h}, minApy=${minApy}%`
      );

      // Check if analyzed pools data is provided
      if (
        !analyzedPools ||
        !Array.isArray(analyzedPools) ||
        analyzedPools.length === 0
      ) {
        return "Error: No analyzed pools data provided";
      }

      // Check if historical data is provided
      if (
        !historicalData ||
        typeof historicalData !== "object" ||
        Object.keys(historicalData).length === 0
      ) {
        return "Error: No historical data provided";
      }

      const pools = analyzedPools;

      // Filter by TVL, 24h volume, and APY
      const filteredPools = pools.filter(
        (pool) =>
          pool.tvl >= minTvl &&
          pool.volume_24h >= minVolume24h &&
          pool.apy_7d >= minApy
      );

      console.log(
        `Filtered ${filteredPools.length} pools from ${pools.length} total pools based on TVL, volume, and APY criteria`
      );

      if (filteredPools.length === 0) {
        return `No pools meet the criteria: TVL >= $${minTvl}, 24h volume >= $${minVolume24h}, APY >= ${minApy}%`;
      }

      // Initialize results
      const recommendedPools = [];

      // Process each filtered pool
      for (const pool of filteredPools) {
        try {
          // Extract data
          const tokenASymbol = pool.token_a;
          const tokenBSymbol = pool.token_b;
          const tokenAId = pool.token_a_id;
          const tokenBId = pool.token_b_id;
          const tokenATrend = pool.token_a_trend;
          const tokenBTrend = pool.token_b_trend;
          const correlation = pool.correlation;
          const apy7d = pool.apy_7d;
          const poolId = pool.id || "";

          // Check if historical data exists for both tokens
          if (!historicalData[tokenAId] || !historicalData[tokenBId]) {
            console.warn(
              `Skipping price range calculation for pool ${tokenASymbol}-${tokenBSymbol}: Historical data not found`
            );
            continue;
          }

          const tokenAData = historicalData[tokenAId].data;
          const tokenBData = historicalData[tokenBId].data;

          if (
            !tokenAData.prices ||
            !tokenBData.prices ||
            tokenAData.prices.length < 7 ||
            tokenBData.prices.length < 7
          ) {
            console.warn(
              `Skipping pool ${tokenASymbol}-${tokenBSymbol}: Not enough historical data (need at least 7 days)`
            );
            continue;
          }

          // Get current prices (most recent in data)
          const priceA = tokenAData.prices[tokenAData.prices.length - 1][1];
          const priceB = tokenBData.prices[tokenBData.prices.length - 1][1];

          // Get 7-day lows (min of last 7 days)
          const last7DaysA = tokenAData.prices
            .slice(-7)
            .map((entry: [number, number]) => entry[1]);
          const last7DaysB = tokenBData.prices
            .slice(-7)
            .map((entry: [number, number]) => entry[1]);
          const lowA = Math.min(...last7DaysA);
          const lowB = Math.min(...last7DaysB);

          // Calculate loss based on drawdown formula
          const lossPct = calculateDrawdownLoss(priceA, lowA, priceB, lowB);

          // Calculate break-even duration
          const minHoldingDays = calculateBreakEvenDuration(lossPct, apy7d);

          // Estimate price range
          const { minRatio, maxRatio, minPct, maxPct, formattedRange } =
            estimatePriceRangeFromLows(priceA, lowA, priceB, lowB);

          // Calculate current price ratio
          const currentRatio = priceB / priceA;

          // Assess risk level
          const riskLevel = assessRiskLevel(
            correlation,
            tokenATrend,
            tokenBTrend,
            lossPct
          );

          // Add to recommended pools
          recommendedPools.push({
            pool_id: poolId,
            pool_name: pool.pool_name,
            token_a: tokenASymbol,
            token_b: tokenBSymbol,
            tvl: pool.tvl,
            volume_24h: pool.volume_24h,
            apy_7d: apy7d,
            correlation: correlation,
            drawdown_loss_pct: lossPct,
            suggested_price_range: formattedRange,
            current_price_ratio: currentRatio,
            min_ratio: minRatio,
            max_ratio: maxRatio,
            min_pct: minPct,
            max_pct: maxPct,
            min_holding_days: minHoldingDays,
            risk_level: riskLevel,
            // Calculate efficiency ratio (APY / loss)
            efficiency: apy7d / Math.max(1.0, lossPct),
          });

          console.log(
            `Optimized pool ${pool.pool_name}: APY=${apy7d.toFixed(2)}%, Loss=${lossPct.toFixed(2)}%, Min Holding=${minHoldingDays} days`
          );
        } catch (error) {
          console.error(
            `Error optimizing pool ${pool.pool_name || "unknown"}: ${error}`
          );
          continue;
        }
      }

      // Sort by efficiency ratio (descending)
      if (recommendedPools.length > 0) {
        recommendedPools.sort((a, b) => b.efficiency - a.efficiency);

        // Create summary of top 5 pools
        // const topPools = recommendedPools.slice(0, 5);
        const topPools = recommendedPools;

        // Build detailed response
        const summary = [];

        summary.push(`Optimized ${recommendedPools.length} liquidity pools`);

        summary.push(`\nMY RECOMMENDED LIQUIDITY POOLS:`);

        topPools.forEach((pool, i) => {
          summary.push(`\n${i + 1}. ${pool.pool_name} Pool:`);
          summary.push(
            `   • TVL: $${pool.tvl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          );
          summary.push(`   • 7-day APY: ${pool.apy_7d.toFixed(2)}%`);
          summary.push(`   • Risk Level: ${pool.risk_level}`);
          summary.push(
            `   • Suggested Price Range: ${pool.suggested_price_range}`
          );
          summary.push(
            `   • Min Holding Period: ${pool.min_holding_days} days`
          );
          summary.push(`   • Efficiency Ratio: ${pool.efficiency.toFixed(2)}`);
        });

        // Add general recommendations
        summary.push(`\nGENERAL RECOMMENDATIONS:`);

        // Risk-based recommendations
        const lowRiskPools = recommendedPools.filter(
          (pool) => pool.risk_level === "Low"
        );
        const highApyPools = recommendedPools.filter(
          (pool) => pool.apy_7d > 20
        );

        if (lowRiskPools.length > 0) {
          const topLowRisk = lowRiskPools[0];
          summary.push(
            `• For Conservative Strategy: Consider ${topLowRisk.pool_name} with ${topLowRisk.apy_7d.toFixed(2)}% APY and ${topLowRisk.risk_level} risk.`
          );
        }

        if (highApyPools.length > 0) {
          const topHighApy = highApyPools[0];
          summary.push(
            `• For High Yield Strategy: Consider ${topHighApy.pool_name} with ${topHighApy.apy_7d.toFixed(2)}% APY, but be aware of the ${topHighApy.risk_level} risk level.`
          );
        }

        // Time-based recommendation
        const shortHoldPools = recommendedPools.filter(
          (pool) => pool.min_holding_days < 10
        );
        if (shortHoldPools.length > 0) {
          const topShortHold = shortHoldPools[0];
          summary.push(
            `• For Short-term Strategy: ${topShortHold.pool_name} requires only ${topShortHold.min_holding_days} days to break even.`
          );
        }

        const result = summary.join("\n");
        console.log(
          `Optimization complete with ${recommendedPools.length} recommended pools`
        );
        return result;
      } else {
        return "No pools could be optimized with your criteria. Try adjusting the parameters.";
      }
    } catch (error) {
      const errorMsg = `Error in liquidity pool optimization: ${error}`;
      console.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("OptimizePoolsTool", () => {
    const tool = new OptimizePoolsTool();

    it("should handle missing analyzed pools data", async () => {
      const result = await tool.invoke({
        analyzedPools: [],
        historicalData: {},
      });
      expect(result).toContain("Error: No analyzed pools data provided");
    });

    it("should handle missing historical data", async () => {
      const result = await tool.invoke({
        analyzedPools: [{ id: "test" }] as any,
        historicalData: {},
      });
      expect(result).toContain("Error: No historical data provided");
    });

    it("should handle empty pools after filtering", async () => {
      const mockPools = [
        {
          id: "pool1",
          pool_name: "USDC-SOL",
          token_a: "USDC",
          token_b: "SOL",
          token_a_id: "usdc",
          token_b_id: "solana",
          token_a_trend: "neutral",
          token_b_trend: "uptrend",
          correlation: 0.75,
          tvl: 1000, // Below minimum
          volume_24h: 1000, // Below minimum
          apy_7d: 2, // Below minimum
        },
      ];

      // Mock minimal historical data
      const mockHistoricalData = {
        usdc: { prices: [[1, 1]] },
        solana: { prices: [[1, 1]] },
      };

      const result = await tool.invoke({
        analyzedPools: mockPools,
        historicalData: mockHistoricalData,
        minTvl: 50000,
        minVolume24h: 10000,
        minApy: 5,
      });

      expect(result).toContain("No pools meet the criteria");
    });

    it("should optimize and recommend pools", async () => {
      // Mock pools data
      const mockPools = [
        {
          id: "pool1",
          pool_name: "USDC-SOL",
          token_a: "USDC",
          token_b: "SOL",
          token_a_id: "usdc",
          token_b_id: "solana",
          token_a_trend: "neutral",
          token_b_trend: "uptrend",
          correlation: 0.75,
          tvl: 100000,
          volume_24h: 50000,
          apy_7d: 15,
        },
      ];

      // Mock token data
      const mockHistoricalData = {
        usdc: {
          prices: [
            [1617580800, 1.0], // timestamp, price
            [1617667200, 1.1],
            [1617753600, 1.2],
            [1617840000, 1.15],
            [1617926400, 1.05],
            [1618012800, 1.1],
            [1618099200, 1.2],
            [1618185600, 1.25],
          ],
        },
        solana: {
          prices: [
            [1617580800, 100.0],
            [1617667200, 105.0],
            [1617753600, 110.0],
            [1617840000, 108.0],
            [1617926400, 102.0],
            [1618012800, 105.0],
            [1618099200, 112.0],
            [1618185600, 118.0],
          ],
        },
      };

      const result = await tool.invoke({
        analyzedPools: mockPools,
        historicalData: mockHistoricalData,
        minTvl: 50000,
        minVolume24h: 10000,
        minApy: 5,
      });

      expect(result).toContain("TOP 5 RECOMMENDED LIQUIDITY POOLS");
      expect(result).toContain("USDC-SOL Pool");
    });
  });
}
