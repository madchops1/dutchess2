const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

class MACDStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super('MACD Strategy', parameters);
    
    this.fastPeriod = parameters.fastPeriod || 12;
    this.slowPeriod = parameters.slowPeriod || 26;
    this.signalPeriod = parameters.signalPeriod || 9;
    this.minMovementPercent = parameters.minMovementPercent || 0.005; // 0.5% price movement minimum
    this.tradeAmount = parameters.tradeAmount || 0.01;
    this.mode = parameters.mode || 'simulation';
    
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
    this.trades = [];
    this.lastSignalPrice = {}; // Track last signal price for movement filtering
    this.tradingFlags = new Map(); // Track trading status per product
    
    // Trading engine reference (will be set when strategy is started)
    this.tradingEngine = null;
    
    logger.info(`[MACD] Strategy initialized with mode: ${this.mode}, fastPeriod: ${this.fastPeriod}, slowPeriod: ${this.slowPeriod}, signalPeriod: ${this.signalPeriod}, tradeAmount: ${this.tradeAmount}`);
  }

  setTradingEngine(tradingEngine) {
    this.tradingEngine = tradingEngine;
    logger.info(`[MACD] Trading engine reference set`);
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
    const productId = 'BTC-USD'; // For now, hardcode to BTC
    
    // Bullish Signal: MACD crosses above Signal Line
    if (this.macdLine > this.signalLine && this.prevHistogram <= 0 && this.histogram > 0) {
      if (this.shouldGenerateCrossoverSignal(productId, currentPrice, 'BUY')) {
        // Generate trade signals if in simulation/active mode
        if (this.mode === 'simulation' || this.mode === 'active') {
          this.generateBuySignal({
            productId,
            reason: 'MACD Bullish Crossover - MACD crossed above Signal Line',
            macdLine: this.macdLine,
            signalLine: this.signalLine,
            histogram: this.histogram,
            price: currentPrice,
            confidence: this.calculateConfidence('buy')
          });
        }
        this.position = 'long';
        this.lastSignalPrice[productId] = currentPrice; // Track signal price
      }
    }
    
    // Bearish Signal: MACD crosses below Signal Line
    else if (this.macdLine < this.signalLine && this.prevHistogram >= 0 && this.histogram < 0) {
      if (this.shouldGenerateCrossoverSignal(productId, currentPrice, 'SELL')) {
        // Generate trade signals if in simulation/active mode
        if (this.mode === 'simulation' || this.mode === 'active') {
          this.generateSellSignal({
            productId,
            reason: 'MACD Bearish Crossover - MACD crossed below Signal Line',
            macdLine: this.macdLine,
            signalLine: this.signalLine,
            histogram: this.histogram,
            price: currentPrice,
            confidence: this.calculateConfidence('sell')
          });
        }
        this.position = 'short';
        this.lastSignalPrice[productId] = currentPrice; // Track signal price
      }
    }
  }

  async generateBuySignal(data) {
    const signal = {
      type: 'BUY',
      productId: data.productId,
      price: data.price,
      macdLine: data.macdLine,
      signalLine: data.signalLine,
      histogram: data.histogram,
      timestamp: new Date().toISOString(),
      strategy: 'MACD',
      reason: data.reason,
      confidence: data.confidence,
      data: {
        ...data,
        tradeAmount: this.tradeAmount,
        mode: this.mode
      }
    };
    
    // Execute trade if in simulation or active mode
    let trade = null;
    if (this.mode === 'simulation' || this.mode === 'active') {
      trade = await this.executeTrade(signal);
      signal.trade = trade;
    }
    
    logger.info(`[MACD] BUY signal: ${data.reason} at $${data.price}`);
    if (trade) {
      logger.info(`[MACD] Trade executed: ${trade.success ? 'SUCCESS' : 'FAILED'} BUY ${this.tradeAmount} ${data.productId} at $${data.price}`);
    }
    
    this.onSignal(signal);
  }

  async generateSellSignal(data) {
    const signal = {
      type: 'SELL',
      productId: data.productId,
      price: data.price,
      macdLine: data.macdLine,
      signalLine: data.signalLine,
      histogram: data.histogram,
      timestamp: new Date().toISOString(),
      strategy: 'MACD',
      reason: data.reason,
      confidence: data.confidence,
      data: {
        ...data,
        tradeAmount: this.tradeAmount,
        mode: this.mode
      }
    };
    
    // Execute trade if in simulation or active mode
    let trade = null;
    if (this.mode === 'simulation' || this.mode === 'active') {
      trade = await this.executeTrade(signal);
      signal.trade = trade;
    }
    
    logger.info(`[MACD] SELL signal: ${data.reason} at $${data.price}`);
    if (trade) {
      logger.info(`[MACD] Trade executed: ${trade.success ? 'SUCCESS' : 'FAILED'} SELL ${this.tradeAmount} ${data.productId} at $${data.price}`);
    }
    
    this.onSignal(signal);
  }

  async executeTrade(signal) {
    const { type, productId, price } = signal;
    
    if (this.mode === 'stopped') {
      logger.info(`[MACD] Trading is stopped. Signal ignored: ${type} ${productId}`);
      return null;
    }
    
    if (!this.tradingEngine) {
      logger.error(`[MACD] Trading engine not available. Cannot execute ${type} for ${productId}`);
      return { success: false, error: 'Trading engine not available' };
    }
    
    try {
      let result;
      
      if (type === 'BUY') {
        result = await this.tradingEngine.executeBuyOrder(productId, this.tradeAmount);
      } else if (type === 'SELL') {
        result = await this.tradingEngine.executeSellOrder(productId, this.tradeAmount);
      }
      
      if (result && result.success) {
        // Record successful trade for performance tracking
        const trade = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          type,
          productId,
          price,
          amount: this.tradeAmount,
          mode: this.mode,
          orderId: result.order?.order_id || result.order?.id,
          status: this.mode === 'active' ? 'executed' : 'simulated'
        };
        
        this.trades.push(trade);
        
        logger.info(`[MACD] Trade ${trade.status}: ${type} ${this.tradeAmount} ${productId} at $${price}`);
        
        // Sync portfolio after trade
        if (this.tradingEngine.syncPortfolio) {
          await this.tradingEngine.syncPortfolio();
        }
        
        return { success: true, trade };
      } else {
        logger.error(`[MACD] Trade failed: ${result?.error || 'Unknown error'}`);
        return result || { success: false, error: 'Unknown error' };
      }
    } catch (error) {
      logger.error(`[MACD] Error executing ${type} trade for ${productId}:`, error);
      return { success: false, error: error.message };
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

  getPerformance() {
    const totalTrades = this.trades.length;
    const buyTrades = this.trades.filter(trade => trade.type === 'BUY').length;
    const sellTrades = this.trades.filter(trade => trade.type === 'SELL').length;
    
    // Get current portfolio from trading engine
    const currentPortfolio = this.tradingEngine ? this.tradingEngine.getPortfolio() : {};
    
    // Calculate total portfolio value (approximate)
    let currentPortfolioValue = 0;
    Object.entries(currentPortfolio).forEach(([symbol, amount]) => {
      if (amount > 0) {
        if (symbol === 'USD' || symbol === 'USDC') {
          currentPortfolioValue += amount;
        } else {
          // Use last known price for crypto holdings
          const currentPrice = this.priceHistory[this.priceHistory.length - 1] || 0;
          currentPortfolioValue += amount * currentPrice;
        }
      }
    });
    
    return {
      totalTrades,
      buyTrades,
      sellTrades,
      totalVolume: totalTrades * this.tradeAmount, // Approximate
      currentPortfolioValue: parseFloat(currentPortfolioValue.toFixed(4)),
      portfolio: currentPortfolio,
      recentTrades: this.trades.slice(-10), // Last 10 trades
      strategy: 'MACD',
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      mode: this.mode
    };
  }

  getTrades() {
    return this.trades;
  }

  getPortfolio() {
    return this.tradingEngine ? this.tradingEngine.getPortfolio() : {};
  }

  resetPerformance() {
    this.trades = [];
    logger.info(`[MACD] Performance tracking reset`);
  }

  onSignal(signal) {
    // Add productId to signal if not present
    if (!signal.productId && signal.data?.productId) {
      signal.productId = signal.data.productId;
    }
    
    // Emit signal over Socket.IO if available
    if (global.tradingBot && global.tradingBot.io) {
      logger.info(`[MACD] Emitting ${signal.type.toUpperCase()} signal for ${signal.productId}`);
      global.tradingBot.io.emit('signal', signal);
    } else {
      logger.error(`[MACD] Cannot emit signal - Socket.IO not available`);
    }
  }

  async updateParameters(parameters = {}) {
    logger.info(`[MACD] Updating parameters:`, parameters);
    
    // Update parameters
    if (parameters.fastPeriod !== undefined) {
      this.fastPeriod = parameters.fastPeriod;
      logger.info(`[MACD] Fast period updated to: ${this.fastPeriod}`);
    }
    
    if (parameters.slowPeriod !== undefined) {
      this.slowPeriod = parameters.slowPeriod;
      logger.info(`[MACD] Slow period updated to: ${this.slowPeriod}`);
    }
    
    if (parameters.signalPeriod !== undefined) {
      this.signalPeriod = parameters.signalPeriod;
      logger.info(`[MACD] Signal period updated to: ${this.signalPeriod}`);
    }
    
    if (parameters.minMovementPercent !== undefined) {
      this.minMovementPercent = parameters.minMovementPercent;
      logger.info(`[MACD] Min movement percent updated to: ${this.minMovementPercent}`);
    }
    
    if (parameters.tradeAmount !== undefined) {
      this.tradeAmount = parameters.tradeAmount;
      logger.info(`[MACD] Trade amount updated to: ${this.tradeAmount}`);
    }
    
    if (parameters.mode !== undefined) {
      this.mode = parameters.mode;
      logger.info(`[MACD] Trading mode updated to: ${this.mode}`);
      
      // Reset performance when switching to simulation/trading mode
      if (this.mode === 'simulation' || this.mode === 'active') {
        this.resetPerformance();
        this.position = 'none';
        logger.info(`[MACD] Reset performance and position for fresh start in ${this.mode} mode`);
      }
    }
  }

  shouldGenerateCrossoverSignal(productId, currentPrice, signalType) {
    // Check minimum price movement for crossover signals (visual/logging)
    const lastSignalPrice = this.lastSignalPrice[productId];
    
    if (lastSignalPrice) {
      const priceMovement = Math.abs(currentPrice - lastSignalPrice);
      const tradeValueMovement = priceMovement * this.tradeAmount;
      const baseTradeValue = lastSignalPrice * this.tradeAmount;
      const movementPercent = tradeValueMovement / baseTradeValue;
      
      logger.info(`[MACD] Movement check for ${signalType} signal on ${productId}:`, {
        priceMovement: priceMovement.toFixed(8),
        tradeAmount: this.tradeAmount,
        tradeValueMovement: tradeValueMovement.toFixed(6),
        baseTradeValue: baseTradeValue.toFixed(6),
        movementPercent: (movementPercent * 100).toFixed(3) + '%',
        minMovementPercent: (this.minMovementPercent * 100).toFixed(3) + '%'
      });
      
      // Signal is valid if trade value movement percentage exceeds minimum percentage
      const percentageMet = movementPercent >= this.minMovementPercent;
      
      if (!percentageMet) {
        logger.info(`[MACD] Movement too small for ${signalType} signal on ${productId}. Trade value movement: ${(movementPercent * 100).toFixed(3)}% < ${(this.minMovementPercent * 100).toFixed(3)}%`);
        return false;
      }
      
      logger.info(`[MACD] Movement sufficient for ${signalType} signal on ${productId}. Trade value movement: ${(movementPercent * 100).toFixed(3)}% ✓`);
    } else {
      // If no previous signal price, allow the first signal
      logger.info(`[MACD] No previous signal price for ${productId}, allowing first ${signalType} signal`);
    }
    
    return true;
  }
}

module.exports = MACDStrategy;
