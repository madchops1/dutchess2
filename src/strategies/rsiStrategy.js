const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

class RSIStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super('RSI Strategy', parameters);
    
    this.period = parameters.period || 14;
    this.oversoldThreshold = parameters.oversoldThreshold || 30;
    this.overboughtThreshold = parameters.overboughtThreshold || 70;
    
    this.priceHistory = [];
    this.gains = [];
    this.losses = [];
    this.rsi = null;
    this.position = 'none';
  }

  onPriceUpdate(data) {
    const price = data.price;
    this.priceHistory.push(price);
    
    // Calculate price changes
    if (this.priceHistory.length >= 2) {
      const change = price - this.priceHistory[this.priceHistory.length - 2];
      
      if (change > 0) {
        this.gains.push(change);
        this.losses.push(0);
      } else {
        this.gains.push(0);
        this.losses.push(Math.abs(change));
      }
      
      // Keep only the required period
      if (this.gains.length > this.period) {
        this.gains.shift();
        this.losses.shift();
      }
      
      // Calculate RSI
      this.calculateRSI();
      
      // Generate signals
      this.generateSignals();
    }
    
    // Keep price history manageable
    if (this.priceHistory.length > this.period * 2) {
      this.priceHistory = this.priceHistory.slice(-this.period);
    }
  }

  calculateRSI() {
    if (this.gains.length < this.period) return;
    
    const avgGain = this.gains.reduce((a, b) => a + b, 0) / this.period;
    const avgLoss = this.losses.reduce((a, b) => a + b, 0) / this.period;
    
    if (avgLoss === 0) {
      this.rsi = 100;
    } else {
      const rs = avgGain / avgLoss;
      this.rsi = 100 - (100 / (1 + rs));
    }
  }

  generateSignals() {
    if (!this.rsi) return;
    
    const currentPrice = this.priceHistory[this.priceHistory.length - 1];
    
    // Oversold condition - Buy Signal
    if (this.rsi <= this.oversoldThreshold && this.position !== 'long') {
      this.generateBuySignal({
        reason: `RSI Oversold - RSI: ${this.rsi.toFixed(2)}`,
        rsi: this.rsi,
        price: currentPrice,
        confidence: this.calculateConfidence('buy')
      });
      this.position = 'long';
    }
    
    // Overbought condition - Sell Signal
    else if (this.rsi >= this.overboughtThreshold && this.position !== 'short') {
      this.generateSellSignal({
        reason: `RSI Overbought - RSI: ${this.rsi.toFixed(2)}`,
        rsi: this.rsi,
        price: currentPrice,
        confidence: this.calculateConfidence('sell')
      });
      this.position = 'short';
    }
    
    // Reset position when RSI returns to neutral zone
    else if (this.rsi > this.oversoldThreshold + 10 && this.rsi < this.overboughtThreshold - 10) {
      if (this.position !== 'none') {
        this.position = 'none';
      }
    }
  }

  calculateConfidence(signalType) {
    if (!this.rsi) return 0;
    
    if (signalType === 'buy') {
      // More oversold = higher confidence
      const oversoldDegree = Math.max(0, this.oversoldThreshold - this.rsi);
      return Math.min((oversoldDegree / this.oversoldThreshold) * 100, 100);
    } else {
      // More overbought = higher confidence
      const overboughtDegree = Math.max(0, this.rsi - this.overboughtThreshold);
      const maxOverbought = 100 - this.overboughtThreshold;
      return Math.min((overboughtDegree / maxOverbought) * 100, 100);
    }
  }

  getIndicators() {
    return {
      rsi: this.rsi,
      position: this.position,
      period: this.period,
      oversoldThreshold: this.oversoldThreshold,
      overboughtThreshold: this.overboughtThreshold,
      priceHistoryLength: this.priceHistory.length
    };
  }

  getDescription() {
    return `RSI Strategy using ${this.period}-period RSI with oversold threshold at ${this.oversoldThreshold} and overbought threshold at ${this.overboughtThreshold}. Generates buy signals when oversold and sell signals when overbought.`;
  }
}

module.exports = RSIStrategy;
