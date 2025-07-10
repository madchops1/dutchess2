const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

class SimpleMovingAverageStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super('Simple Moving Average', parameters);
    this.period = parameters.period || 20; // Align with frontend
    logger.info(`[SMA] Strategy initialized with period: ${this.period}`);
    this.priceHistories = {}; // Separate price history for each crypto
    this.smas = {}; // Separate SMA for each crypto
    this.lastPrices = {}; // Separate last price for each crypto
    this.lastSmas = {}; // Separate last SMA for each crypto
    this.positions = {}; // Separate position for each crypto
    this.signals = [];
    this.maxSignals = 1000;
  }

  onPriceUpdate(data) {
    const price = data.price;
    // Log the full data object for debugging
    logger.info(`[SMA] Full price update data:`, data);
    const productId = data.product_id || data.productId || data.symbol || data.id || 'UNKNOWN';
    
    // Initialize arrays for this crypto if they don't exist
    if (!this.priceHistories[productId]) {
      this.priceHistories[productId] = [];
      this.smas[productId] = null;
      this.lastPrices[productId] = null;
      this.lastSmas[productId] = null;
      this.positions[productId] = 'none';
    }
    
    this.priceHistories[productId].push(price);
    if (this.priceHistories[productId].length > this.period * 2) {
      this.priceHistories[productId] = this.priceHistories[productId].slice(-this.period * 2);
    }
    this.calculateSMA(productId);
    this.generateSignals(price, productId);
    this.lastPrices[productId] = price;
    this.lastSmas[productId] = this.smas[productId];
  }

  calculateSMA(productId) {
    if (this.priceHistories[productId].length >= this.period) {
      const sum = this.priceHistories[productId].slice(-this.period).reduce((a, b) => a + b, 0);
      this.smas[productId] = sum / this.period;
      logger.debug(`[SMA] Calculated SMA for ${productId}: ${this.smas[productId].toFixed(6)} (period=${this.period}, prices=${this.priceHistories[productId].length})`);
    } else {
      this.smas[productId] = null;
      logger.debug(`[SMA] Not enough data for ${productId}: ${this.priceHistories[productId].length}/${this.period} prices`);
    }
    // Periodically log the period being used for verification
    if (Math.random() < 0.001) { // 0.1% chance to log
      logger.info(`[SMA] 🔍 PERIOD CHECK: Using period=${this.period} for SMA calculations`);
    }
  }

  generateBuySignal(signalData) {
    const signal = {
      type: 'buy',
      timestamp: new Date(),
      strategy: this.name,
      data: signalData,
      productId: signalData.productId || signalData.product_id || signalData.symbol || 'UNKNOWN'
    };
    this.signals.push(signal);
    if (this.signals.length > this.maxSignals) {
      this.signals = this.signals.slice(-this.maxSignals);
    }
    this.lastSignal = signal;
    if (this.parameters.autoTrade && this.executeBuyOrder) {
      this.executeBuyOrder(signalData);
    }
    if (this.onSignal) {
      this.onSignal(signal);
    }
  }

  generateSellSignal(signalData) {
    const signal = {
      type: 'sell',
      timestamp: new Date(),
      strategy: this.name,
      data: signalData,
      productId: signalData.productId || signalData.product_id || signalData.symbol || 'UNKNOWN'
    };
    this.signals.push(signal);
    if (this.signals.length > this.maxSignals) {
      this.signals = this.signals.slice(-this.maxSignals);
    }
    this.lastSignal = signal;
    if (this.parameters.autoTrade && this.executeSellOrder) {
      this.executeSellOrder(signalData);
    }
    if (this.onSignal) {
      this.onSignal(signal);
    }
  }

  generateSignals(currentPrice, productId) {
    const sma = this.smas[productId];
    const lastPrice = this.lastPrices[productId];
    const lastSma = this.lastSmas[productId];
    const position = this.positions[productId] || 'none';
    
    if (sma === null || lastPrice === null || lastSma === null) return;
    
    // More precise crossover detection: price must cross the SMA line
    // Buy signal: last price was below SMA AND current price is above SMA
    if (lastPrice <= lastSma && currentPrice > sma && position !== 'long') {
      logger.info(`[SMA] BUY crossover for ${productId}: price ${currentPrice} crossed above SMA ${sma.toFixed(2)} (position was ${position})`);
      logger.debug(`[SMA] Crossover details: lastPrice=${lastPrice}, lastSma=${lastSma}, currentPrice=${currentPrice}, currentSma=${sma}`);
      this.generateBuySignal({
        reason: 'Price crossed above SMA',
        sma: sma,
        price: currentPrice,
        confidence: 100,
        productId
      });
      this.positions[productId] = 'long';
    }
    // Sell signal: last price was above SMA AND current price is below SMA  
    else if (lastPrice >= lastSma && currentPrice < sma && position !== 'short') {
      logger.info(`[SMA] SELL crossover for ${productId}: price ${currentPrice} crossed below SMA ${sma.toFixed(2)} (position was ${position})`);
      logger.debug(`[SMA] Crossover details: lastPrice=${lastPrice}, lastSma=${lastSma}, currentPrice=${currentPrice}, currentSma=${sma}`);
      this.generateSellSignal({
        reason: 'Price crossed below SMA',
        sma: sma,
        price: currentPrice,
        confidence: 100,
        productId
      });
      this.positions[productId] = 'short';
    }
  }

  getIndicators(productId = null) {
    if (productId) {
      return {
        sma: this.smas[productId] || null,
        position: this.positions[productId] || 'none',
        period: this.period,
        priceHistoryLength: this.priceHistories[productId] ? this.priceHistories[productId].length : 0
      };
    } else {
      // Return all indicators for all cryptos
      return {
        smas: this.smas,
        positions: this.positions,
        period: this.period,
        priceHistoriesLengths: Object.keys(this.priceHistories).reduce((acc, key) => {
          acc[key] = this.priceHistories[key].length;
          return acc;
        }, {})
      };
    }
  }

  getSignals() {
    return this.signals;
  }

  getDescription() {
    return `Simple Moving Average strategy using ${this.period}-period SMA. Buys when price crosses above SMA, sells when below.`;
  }

  onSignal(signal) {
    // Add productId to signal if not present
    if (!signal.productId && signal.data?.productId) {
      signal.productId = signal.data.productId;
    }
    
    // Emit signal over Socket.IO if available
    if (global.tradingBot && global.tradingBot.io) {
      logger.info(`[SMA] Emitting ${signal.type.toUpperCase()} signal for ${signal.productId}`);
      
      // Check client count before and after emission
      const clientsBefore = global.tradingBot.io.engine.clientsCount;
      logger.info(`[SMA] Socket.IO clients connected: ${clientsBefore}`);
      
      global.tradingBot.io.emit('signal', signal);
      
      const clientsAfter = global.tradingBot.io.engine.clientsCount;
      logger.info(`[SMA] Signal emitted - clients: ${clientsAfter}`);
      
      // Also log all connected socket IDs for debugging
      const sockets = Array.from(global.tradingBot.io.sockets.sockets.keys());
      logger.info(`[SMA] Connected socket IDs: ${sockets.join(', ')}`);
      
    } else {
      logger.error(`[SMA] Cannot emit signal - Socket.IO not available`);
      if (!global.tradingBot) {
        logger.error(`[SMA] global.tradingBot is undefined`);
      } else if (!global.tradingBot.io) {
        logger.error(`[SMA] global.tradingBot.io is undefined`);
      }
    }
  }
}

module.exports = SimpleMovingAverageStrategy;
