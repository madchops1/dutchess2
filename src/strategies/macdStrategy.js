const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

class MACDStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super('MACD Strategy', parameters);
    
    this.fastPeriod = parameters.fastPeriod || 12;
    this.slowPeriod = parameters.slowPeriod || 26;
    this.signalPeriod = parameters.signalPeriod || 9;
    
    this.priceHistory = [];
    this.fastEMA = null;
    this.slowEMA = null;
    this.macdLine = null;
    this.signalLine = null;
    this.histogram = null;
    this.macdHistory = [];
    this.signalHistory = [];
    this.position = 'none';
    this.prevHistogram = null;
  }

  onPriceUpdate(data) {
    const price = data.price;
    this.priceHistory.push(price);
    
    // Keep price history manageable
    const maxPeriod = Math.max(this.fastPeriod, this.slowPeriod) * 3;
    if (this.priceHistory.length > maxPeriod) {
      this.priceHistory = this.priceHistory.slice(-maxPeriod);
    }

    // Calculate EMAs
    this.calculateEMAs();
    
    // Calculate MACD
    this.calculateMACD();
    
    // Generate signals
    this.generateSignals();
  }

  calculateEMAs() {
    if (this.priceHistory.length === 0) return;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    
    // Calculate Fast EMA
    if (this.fastEMA === null) {
      if (this.priceHistory.length >= this.fastPeriod) {
        const sum = this.priceHistory.slice(-this.fastPeriod).reduce((a, b) => a + b, 0);
        this.fastEMA = sum / this.fastPeriod;
      }
    } else {
      const multiplier = 2 / (this.fastPeriod + 1);
      this.fastEMA = (currentPrice - this.fastEMA) * multiplier + this.fastEMA;
    }
    
    // Calculate Slow EMA
    if (this.slowEMA === null) {
      if (this.priceHistory.length >= this.slowPeriod) {
        const sum = this.priceHistory.slice(-this.slowPeriod).reduce((a, b) => a + b, 0);
        this.slowEMA = sum / this.slowPeriod;
      }
    } else {
      const multiplier = 2 / (this.slowPeriod + 1);
      this.slowEMA = (currentPrice - this.slowEMA) * multiplier + this.slowEMA;
    }
  }

  calculateMACD() {
    if (!this.fastEMA || !this.slowEMA) return;
    
    // MACD Line = Fast EMA - Slow EMA
    this.macdLine = this.fastEMA - this.slowEMA;
    this.macdHistory.push(this.macdLine);
    
    // Keep MACD history manageable
    if (this.macdHistory.length > this.signalPeriod * 3) {
      this.macdHistory = this.macdHistory.slice(-this.signalPeriod * 2);
    }
    
    // Calculate Signal Line (EMA of MACD Line)
    if (this.signalLine === null) {
      if (this.macdHistory.length >= this.signalPeriod) {
        const sum = this.macdHistory.slice(-this.signalPeriod).reduce((a, b) => a + b, 0);
        this.signalLine = sum / this.signalPeriod;
      }
    } else {
      const multiplier = 2 / (this.signalPeriod + 1);
      this.signalLine = (this.macdLine - this.signalLine) * multiplier + this.signalLine;
    }
    
    if (this.signalLine !== null) {
      this.signalHistory.push(this.signalLine);
      
      // Keep signal history manageable
      if (this.signalHistory.length > this.signalPeriod * 2) {
        this.signalHistory.shift();
      }
      
      // Calculate Histogram = MACD Line - Signal Line
      this.prevHistogram = this.histogram;
      this.histogram = this.macdLine - this.signalLine;
    }
  }

  generateSignals() {
    if (!this.macdLine || !this.signalLine || !this.histogram || this.prevHistogram === null) return;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    
    // Bullish Signal: MACD crosses above Signal Line
    if (this.macdLine > this.signalLine && this.prevHistogram <= 0 && this.histogram > 0) {
      this.generateBuySignal({
        reason: 'MACD Bullish Crossover - MACD crossed above Signal Line',
        macdLine: this.macdLine,
        signalLine: this.signalLine,
        histogram: this.histogram,
        price: currentPrice,
        confidence: this.calculateConfidence('buy')
      });
      this.position = 'long';
    }
    
    // Bearish Signal: MACD crosses below Signal Line
    else if (this.macdLine < this.signalLine && this.prevHistogram >= 0 && this.histogram < 0) {
      this.generateSellSignal({
        reason: 'MACD Bearish Crossover - MACD crossed below Signal Line',
        macdLine: this.macdLine,
        signalLine: this.signalLine,
        histogram: this.histogram,
        price: currentPrice,
        confidence: this.calculateConfidence('sell')
      });
      this.position = 'short';
    }
  }

  calculateConfidence(signalType) {
    if (!this.histogram) return 0;
    
    // Confidence based on histogram magnitude
    const histogramAbs = Math.abs(this.histogram);
    const recentHistograms = this.macdHistory.slice(-5).map((macd, i) => {
      const signal = this.signalHistory[this.signalHistory.length - 5 + i];
      return signal ? Math.abs(macd - signal) : 0;
    });
    
    const avgHistogram = recentHistograms.reduce((a, b) => a + b, 0) / recentHistograms.length;
    
    if (avgHistogram === 0) return 50;
    
    // Higher histogram relative to recent average = higher confidence
    const confidence = Math.min((histogramAbs / avgHistogram) * 50, 100);
    return confidence;
  }

  getIndicators() {
    return {
      fastEMA: this.fastEMA,
      slowEMA: this.slowEMA,
      macdLine: this.macdLine,
      signalLine: this.signalLine,
      histogram: this.histogram,
      position: this.position,
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      priceHistoryLength: this.priceHistory.length
    };
  }

  getDescription() {
    return `MACD Strategy using ${this.fastPeriod}/${this.slowPeriod}/${this.signalPeriod} parameters. Generates buy signals on bullish crossovers and sell signals on bearish crossovers when MACD line crosses the signal line.`;
  }
}

module.exports = MACDStrategy;
