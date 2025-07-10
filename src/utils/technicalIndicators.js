class TechnicalIndicators {
  // Simple Moving Average
  static sma(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  // Exponential Moving Average
  static ema(prices, period, prevEMA = null) {
    if (prices.length === 0) return null;
    
    const currentPrice = prices[prices.length - 1];
    const multiplier = 2 / (period + 1);
    
    if (prevEMA === null) {
      if (prices.length < period) return null;
      // Use SMA as initial EMA
      const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
      return sum / period;
    }
    
    return (currentPrice - prevEMA) * multiplier + prevEMA;
  }

  // Relative Strength Index
  static rsi(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // MACD (Moving Average Convergence Divergence)
  static macd(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return null;
    
    const fastEMA = this.ema(prices, fastPeriod);
    const slowEMA = this.ema(prices, slowPeriod);
    
    if (!fastEMA || !slowEMA) return null;
    
    const macdLine = fastEMA - slowEMA;
    
    // For signal line, we would need historical MACD values
    // This is a simplified version
    return {
      macd: macdLine,
      signal: null, // Would need historical data
      histogram: null
    };
  }

  // Bollinger Bands
  static bollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;
    
    const sma = this.sma(prices, period);
    if (!sma) return null;
    
    const recentPrices = prices.slice(-period);
    const variance = recentPrices.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;
    
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  // Stochastic Oscillator
  static stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
      return null;
    }
    
    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    if (highestHigh === lowestLow) return { k: 50, d: 50 };
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // For %D, we would need historical %K values
    return {
      k: k,
      d: null // Would need historical %K values
    };
  }

  // Williams %R
  static williamsR(highs, lows, closes, period = 14) {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    if (highestHigh === lowestLow) return -50;
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  // Average True Range
  static atr(highs, lows, closes, period = 14) {
    if (highs.length < 2 || lows.length < 2 || closes.length < 2) {
      return null;
    }
    
    const trueRanges = [];
    
    for (let i = 1; i < Math.min(highs.length, lows.length, closes.length); i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    if (trueRanges.length < period) return null;
    
    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
  }

  // Volume Weighted Average Price (simplified)
  static vwap(prices, volumes) {
    if (prices.length !== volumes.length || prices.length === 0) return null;
    
    let totalVolume = 0;
    let totalPriceVolume = 0;
    
    for (let i = 0; i < prices.length; i++) {
      totalPriceVolume += prices[i] * volumes[i];
      totalVolume += volumes[i];
    }
    
    return totalVolume > 0 ? totalPriceVolume / totalVolume : null;
  }

  // Money Flow Index
  static mfi(highs, lows, closes, volumes, period = 14) {
    if (highs.length < period + 1 || lows.length < period + 1 || 
        closes.length < period + 1 || volumes.length < period + 1) {
      return null;
    }
    
    const typicalPrices = [];
    const rawMoneyFlows = [];
    
    for (let i = 0; i < Math.min(highs.length, lows.length, closes.length, volumes.length); i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(typicalPrice);
      rawMoneyFlows.push(typicalPrice * volumes[i]);
    }
    
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let i = 1; i < Math.min(typicalPrices.length, period + 1); i++) {
      if (typicalPrices[i] > typicalPrices[i - 1]) {
        positiveFlow += rawMoneyFlows[i];
      } else if (typicalPrices[i] < typicalPrices[i - 1]) {
        negativeFlow += rawMoneyFlows[i];
      }
    }
    
    if (negativeFlow === 0) return 100;
    
    const moneyRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyRatio));
  }
}

module.exports = TechnicalIndicators;
