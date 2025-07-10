class MarketAnalyzer {
  constructor() {
    this.priceHistory = [];
    this.volumeHistory = [];
    this.indicators = {};
  }

  addPriceData(price, volume = 0, timestamp = new Date()) {
    this.priceHistory.push({ price, volume, timestamp });
    this.volumeHistory.push(volume);
    
    // Keep only last 1000 data points
    if (this.priceHistory.length > 1000) {
      this.priceHistory.shift();
      this.volumeHistory.shift();
    }
    
    this.updateIndicators();
  }

  updateIndicators() {
    const prices = this.priceHistory.map(d => d.price);
    const volumes = this.priceHistory.map(d => d.volume);
    
    // Update various indicators
    this.indicators.sma20 = this.calculateSMA(prices, 20);
    this.indicators.sma50 = this.calculateSMA(prices, 50);
    this.indicators.ema12 = this.calculateEMA(prices, 12);
    this.indicators.ema26 = this.calculateEMA(prices, 26);
    this.indicators.rsi = this.calculateRSI(prices, 14);
    this.indicators.macd = this.calculateMACD(prices);
    this.indicators.volatility = this.calculateVolatility(prices, 20);
    this.indicators.trend = this.analyzeTrend();
    this.indicators.support = this.findSupport();
    this.indicators.resistance = this.findResistance();
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const multiplier = 2 / (period + 1);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateRSI(prices, period) {
    if (prices.length < period + 1) return null;
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const gains = changes.slice(-period).filter(change => change > 0);
    const losses = changes.slice(-period).filter(change => change < 0).map(Math.abs);
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    if (!ema12 || !ema26) return null;
    
    const macdLine = ema12 - ema26;
    
    return {
      macd: macdLine,
      ema12: ema12,
      ema26: ema26
    };
  }

  calculateVolatility(prices, period) {
    if (prices.length < period) return null;
    
    const recentPrices = prices.slice(-period);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => {
      return sum + Math.pow(price - mean, 2);
    }, 0) / period;
    
    return Math.sqrt(variance);
  }

  analyzeTrend() {
    if (this.priceHistory.length < 20) return 'unknown';
    
    const recent = this.priceHistory.slice(-20);
    const older = this.priceHistory.slice(-40, -20);
    
    if (older.length === 0) return 'unknown';
    
    const recentAvg = recent.reduce((sum, d) => sum + d.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.price, 0) / older.length;
    
    const percentageChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (percentageChange > 2) return 'bullish';
    if (percentageChange < -2) return 'bearish';
    return 'sideways';
  }

  findSupport() {
    if (this.priceHistory.length < 50) return null;
    
    const prices = this.priceHistory.slice(-50).map(d => d.price);
    const lows = [];
    
    // Find local lows
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1] &&
          prices[i] < prices[i - 2] && prices[i] < prices[i + 2]) {
        lows.push(prices[i]);
      }
    }
    
    if (lows.length === 0) return null;
    
    // Find the most common support level (within 1% tolerance)
    const supportLevels = {};
    const tolerance = 0.01;
    
    lows.forEach(low => {
      let foundLevel = false;
      for (const level in supportLevels) {
        if (Math.abs(low - parseFloat(level)) / parseFloat(level) < tolerance) {
          supportLevels[level]++;
          foundLevel = true;
          break;
        }
      }
      if (!foundLevel) {
        supportLevels[low] = 1;
      }
    });
    
    // Return the level with the most touches
    let maxTouches = 0;
    let supportLevel = null;
    
    for (const level in supportLevels) {
      if (supportLevels[level] > maxTouches) {
        maxTouches = supportLevels[level];
        supportLevel = parseFloat(level);
      }
    }
    
    return supportLevel;
  }

  findResistance() {
    if (this.priceHistory.length < 50) return null;
    
    const prices = this.priceHistory.slice(-50).map(d => d.price);
    const highs = [];
    
    // Find local highs
    for (let i = 2; i < prices.length - 2; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1] &&
          prices[i] > prices[i - 2] && prices[i] > prices[i + 2]) {
        highs.push(prices[i]);
      }
    }
    
    if (highs.length === 0) return null;
    
    // Find the most common resistance level (within 1% tolerance)
    const resistanceLevels = {};
    const tolerance = 0.01;
    
    highs.forEach(high => {
      let foundLevel = false;
      for (const level in resistanceLevels) {
        if (Math.abs(high - parseFloat(level)) / parseFloat(level) < tolerance) {
          resistanceLevels[level]++;
          foundLevel = true;
          break;
        }
      }
      if (!foundLevel) {
        resistanceLevels[high] = 1;
      }
    });
    
    // Return the level with the most touches
    let maxTouches = 0;
    let resistanceLevel = null;
    
    for (const level in resistanceLevels) {
      if (resistanceLevels[level] > maxTouches) {
        maxTouches = resistanceLevels[level];
        resistanceLevel = parseFloat(level);
      }
    }
    
    return resistanceLevel;
  }

  getMarketCondition() {
    const currentPrice = this.getCurrentPrice();
    if (!currentPrice) return null;
    
    const condition = {
      price: currentPrice,
      trend: this.indicators.trend,
      volatility: this.classifyVolatility(),
      momentum: this.analyzeMomentum(),
      overbought: this.indicators.rsi > 70,
      oversold: this.indicators.rsi < 30,
      nearSupport: this.indicators.support && Math.abs(currentPrice - this.indicators.support) / currentPrice < 0.02,
      nearResistance: this.indicators.resistance && Math.abs(currentPrice - this.indicators.resistance) / currentPrice < 0.02,
      indicators: this.indicators
    };
    
    return condition;
  }

  classifyVolatility() {
    if (!this.indicators.volatility) return 'unknown';
    
    const currentPrice = this.getCurrentPrice();
    if (!currentPrice) return 'unknown';
    
    const volatilityPercent = (this.indicators.volatility / currentPrice) * 100;
    
    if (volatilityPercent > 5) return 'high';
    if (volatilityPercent > 2) return 'medium';
    return 'low';
  }

  analyzeMomentum() {
    if (this.priceHistory.length < 10) return 'unknown';
    
    const recent = this.priceHistory.slice(-5);
    const older = this.priceHistory.slice(-10, -5);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.price, 0) / older.length;
    
    const momentumChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (momentumChange > 1) return 'increasing';
    if (momentumChange < -1) return 'decreasing';
    return 'neutral';
  }

  getCurrentPrice() {
    return this.priceHistory.length > 0 ? this.priceHistory[this.priceHistory.length - 1].price : null;
  }

  getPriceChange24h() {
    if (this.priceHistory.length < 2) return null;
    
    const current = this.getCurrentPrice();
    const yesterday = this.priceHistory[Math.max(0, this.priceHistory.length - 1440)]; // Assuming 1 min intervals
    
    if (!yesterday) return null;
    
    return {
      absolute: current - yesterday.price,
      percentage: ((current - yesterday.price) / yesterday.price) * 100
    };
  }

  getAnalysis() {
    return {
      currentPrice: this.getCurrentPrice(),
      priceChange24h: this.getPriceChange24h(),
      marketCondition: this.getMarketCondition(),
      technicalIndicators: this.indicators,
      dataPoints: this.priceHistory.length
    };
  }
}

module.exports = MarketAnalyzer;
