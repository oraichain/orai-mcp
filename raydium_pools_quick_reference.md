# Raydium Concentrated Liquidity Pools - Quick Reference

## Top Recommendations by Risk Profile

| Risk Level | Pool Name  | APY (7d) | Optimal Range    | Break-even | Efficiency Ratio |
| ---------- | ---------- | -------- | ---------------- | ---------- | ---------------- |
| **Low**    | SOL-BONK   | 88.66%   | -6.2% to +6.2%   | 26 days    | 11.47            |
| **Medium** | SOL-MEOW   | 328.39%  | -17.4% to +17.4% | 5 days     | 38.88            |
| **High**   | USDC-AI16Z | 81.27%   | -5.0% to +5.0%   | 3 days     | 81.27            |

## Key Performance Metrics

### Top 5 Pools by APY

```
SOL-MEOW      ████████████████████████████████████████████  328.39%
SOL-BONK      █████████████  88.66%
USDC-AI16Z    ████████████  81.27%
SOL-PENGU     ███████████  71.45%
RAY-USDT      █████████  61.15%
```

### Top 5 Pools by Efficiency Ratio

```
USDC-AI16Z    ████████████████████████████████████████████  81.27
SOL-MEOW      ███████████████████  38.88
SOL-BONK      █████  11.47
SOL-PENGU     ████  9.45
SOL-USDT      ████  8.11
```

### Top 5 Pools by Volume (24h)

```
SOL-USDC      ████████████████████████████████████████████  $47.92M
SOL-USDT      ███  $1.17M
SOL-PENGU     ██  $0.73M
SOL-TRUMP     █  $0.64M
SOL-USDT      █  $0.17M
```

## Pool Selection Decision Tree

```
Start
  |
  ├── Low Risk Tolerance?
  |     ├── Yes → SOL-BONK (88.66% APY, -6.2% to +6.2% range)
  |     |        SOL-PENGU (71.45% APY, -5.0% to +5.0% range)
  |     |
  |     └── No → Continue
  |
  ├── Medium Risk Tolerance?
  |     ├── Yes → SOL-MEOW (328.39% APY, -17.4% to +17.4% range)
  |     |        SOL-AI16Z (50.43% APY, -5.0% to +5.0% range)
  |     |
  |     └── No → Continue
  |
  └── High Risk Tolerance?
        ├── Yes → USDC-AI16Z (81.27% APY, -5.0% to +5.0% range)
        |        SOL-USDT (55.94% APY, -7.4% to +7.4% range)
        |
        └── No → Reconsider risk profile
```

## Quick Strategy Guide

### Short-Term Strategy (1-2 weeks)

- **Best Pool**: USDC-AI16Z
- **Key Benefit**: 3-day break-even period
- **Management**: Daily monitoring required
- **Risk Level**: High

### Medium-Term Strategy (2-4 weeks)

- **Best Pool**: SOL-MEOW
- **Key Benefit**: 5-day break-even, exceptional APY
- **Management**: Weekly monitoring
- **Risk Level**: Medium

### Long-Term Strategy (1-3 months)

- **Best Pool**: SOL-BONK
- **Key Benefit**: Excellent stability with high APY
- **Management**: Bi-weekly monitoring
- **Risk Level**: Low

## Token Correlation Matrix

### (for top token pairs)

| Token Pair | Correlation | Trend Alignment   | Risk        |
| ---------- | ----------- | ----------------- | ----------- |
| SOL-TRUMP  | 0.926       | Opposing          | Medium      |
| SOL-RAY    | 0.849       | Aligned           | Low         |
| SOL-CHEX   | 0.878       | Partially Aligned | Medium      |
| SOL-GRASS  | 0.797       | Opposing          | Medium      |
| SOL-BONK   | 0.767       | Aligned           | Low         |
| SOL-PENGU  | 0.716       | Aligned           | Low         |
| SOL-USDC   | 0.300       | Aligned           | Medium-High |
| SOL-USDT   | 0.120       | Partially Aligned | High        |

## Price Range Optimization Cheat Sheet

1. **For highly correlated pairs (>0.8)**

   - Recommended range: ±5-7% from current price
   - Example: SOL-RAY with -5.8% to +5.8% range

2. **For moderately correlated pairs (0.5-0.8)**

   - Recommended range: ±7-12% from current price
   - Example: SOL-BONK with -6.2% to +6.2% range

3. **For low correlation pairs (<0.5)**

   - Recommended range: ±10-15% from current price
   - Example: RAY-USDT with -14.0% to +14.0% range

4. **For high volatility tokens**

   - Add extra 5-10% buffer to standard range
   - Example: SOL-MEOW with -17.4% to +17.4% range

5. **For stablecoin pairs**
   - Asymmetric range (tighter on stablecoin side)
   - Example: SOL-USDC with range slightly skewed upward
