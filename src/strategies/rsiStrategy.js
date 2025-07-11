const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

class RSIStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super('RSI Strategy', parameters);
    
    this.period = parameters.period || 14;
    this.oversoldThreshold = parameters.oversoldThreshold || 30;
    this.overboughtThreshold = parameters.overboughtThreshold || 70;
    this.minMovementPercent = parameters.minMovementPercent || 0.005; // 0.5% price movement minimum
    this.tradeAmount = parameters.tradeAmount || 0.01;
    this.mode = parameters.mode || 'simulation';
    
    this.priceHistory = [];
    this.gains = [];
    this.losses = [];
    this.rsi = null;
    this.position = 'none';
    this.trades = [];
    this.lastSignalPrice = {}; // Track last signal price for movement filtering
    this.tradingFlags = new Map(); // Track trading status per product
    
    // Trading engine reference (will be set when strategy is started)
    this.tradingEngine = null;
    
    logger.info(`[RSI] Strategy initialized with mode: ${this.mode}, period: ${this.period}, tradeAmount: ${this.tradeAmount}`);
  }

  setTradingEngine(tradingEngine) {
    this.tradingEngine = tradingEngine;
    logger.info(`[RSI] Trading engine reference set`);
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
    const productId = 'BTC-USD'; // For now, hardcode to BTC
    
    // Oversold condition - Buy Signal
    if (this.rsi <= this.oversoldThreshold && this.position !== 'long') {
      if (this.shouldGenerateCrossoverSignal(productId, currentPrice, 'BUY')) {
        // Generate trade signals if in simulation/active mode
        if (this.mode === 'simulation' || this.mode === 'active') {
          this.generateBuySignal({
            productId,
            reason: `RSI Oversold - RSI: ${this.rsi.toFixed(2)}`,
            rsi: this.rsi,
            price: currentPrice,
            confidence: this.calculateConfidence('buy')
          });
        }
        this.position = 'long';
        this.lastSignalPrice[productId] = currentPrice; // Track signal price
      }
    }
    
    // Overbought condition - Sell Signal
    else if (this.rsi >= this.overboughtThreshold && this.position !== 'short') {
      if (this.shouldGenerateCrossoverSignal(productId, currentPrice, 'SELL')) {
        // Generate trade signals if in simulation/active mode
        if (this.mode === 'simulation' || this.mode === 'active') {
          this.generateSellSignal({
            productId,
            reason: `RSI Overbought - RSI: ${this.rsi.toFixed(2)}`,
            rsi: this.rsi,
            price: currentPrice,
            confidence: this.calculateConfidence('sell')
          });
        }
        this.position = 'short';
        this.lastSignalPrice[productId] = currentPrice; // Track signal price
      }
    }
    
    // Reset position when RSI returns to neutral zone
    else if (this.rsi > this.oversoldThreshold + 10 && this.rsi < this.overboughtThreshold - 10) {
      if (this.position !== 'none') {
        this.position = 'none';
      }
    }
  }

  async generateBuySignal(data) {
    const signal = {
      type: 'BUY',
      productId: data.productId,
      price: data.price,
      rsi: data.rsi,
      timestamp: new Date().toISOString(),
      strategy: 'RSI',
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
    
    logger.info(`[RSI] BUY signal: ${data.reason} at $${data.price}`);
    if (trade) {
      logger.info(`[RSI] Trade executed: ${trade.success ? 'SUCCESS' : 'FAILED'} BUY ${this.tradeAmount} ${data.productId} at $${data.price}`);
    }
    
    this.onSignal(signal);
  }

  async generateSellSignal(data) {
    const signal = {
      type: 'SELL',
      productId: data.productId,
      price: data.price,
      rsi: data.rsi,
      timestamp: new Date().toISOString(),
      strategy: 'RSI',
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
    
    logger.info(`[RSI] SELL signal: ${data.reason} at $${data.price}`);
    if (trade) {
      logger.info(`[RSI] Trade executed: ${trade.success ? 'SUCCESS' : 'FAILED'} SELL ${this.tradeAmount} ${data.productId} at $${data.price}`);
    }
    
    this.onSignal(signal);
  }

  async executeTrade(signal) {
    const { type, productId, price } = signal;
    
    if (this.mode === 'stopped') {
      logger.info(`[RSI] Trading is stopped. Signal ignored: ${type} ${productId}`);
      return null;
    }
    
    if (!this.tradingEngine) {
      logger.error(`[RSI] Trading engine not available. Cannot execute ${type} for ${productId}`);
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
        
        logger.info(`[RSI] Trade ${trade.status}: ${type} ${this.tradeAmount} ${productId} at $${price}`);
        
        // Sync portfolio after trade
        if (this.tradingEngine.syncPortfolio) {
          await this.tradingEngine.syncPortfolio();
        }
        
        return { success: true, trade };
      } else {
        logger.error(`[RSI] Trade failed: ${result?.error || 'Unknown error'}`);
        return result || { success: false, error: 'Unknown error' };
      }
    } catch (error) {
      logger.error(`[RSI] Error executing ${type} trade for ${productId}:`, error);
      return { success: false, error: error.message };
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
      strategy: 'RSI',
      period: this.period,
      mode: this.mode,
      oversoldThreshold: this.oversoldThreshold,
      overboughtThreshold: this.overboughtThreshold
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
    logger.info(`[RSI] Performance tracking reset`);
  }

  onSignal(signal) {
    // Add productId to signal if not present
    if (!signal.productId && signal.data?.productId) {
      signal.productId = signal.data.productId;
    }
    
    // Emit signal over Socket.IO if available
    if (global.tradingBot && global.tradingBot.io) {
      logger.info(`[RSI] Emitting ${signal.type.toUpperCase()} signal for ${signal.productId}`);
      global.tradingBot.io.emit('signal', signal);
    } else {
      logger.error(`[RSI] Cannot emit signal - Socket.IO not available`);
    }
  }

  async updateParameters(parameters = {}) {
    logger.info(`[RSI] Updating parameters:`, parameters);
    
    // Update parameters
    if (parameters.period !== undefined) {
      this.period = parameters.period;
      logger.info(`[RSI] Period updated to: ${this.period}`);
    }
    
    if (parameters.oversoldThreshold !== undefined) {
      this.oversoldThreshold = parameters.oversoldThreshold;
      logger.info(`[RSI] Oversold threshold updated to: ${this.oversoldThreshold}`);
    }
    
    if (parameters.overboughtThreshold !== undefined) {
      this.overboughtThreshold = parameters.overboughtThreshold;
      logger.info(`[RSI] Overbought threshold updated to: ${this.overboughtThreshold}`);
    }
    
    if (parameters.minMovementPercent !== undefined) {
      this.minMovementPercent = parameters.minMovementPercent;
      logger.info(`[RSI] Min movement percent updated to: ${this.minMovementPercent}`);
    }
    
    if (parameters.tradeAmount !== undefined) {
      this.tradeAmount = parameters.tradeAmount;
      logger.info(`[RSI] Trade amount updated to: ${this.tradeAmount}`);
    }
    
    if (parameters.mode !== undefined) {
      this.mode = parameters.mode;
      logger.info(`[RSI] Trading mode updated to: ${this.mode}`);
      
      // Reset performance when switching to simulation/trading mode
      if (this.mode === 'simulation' || this.mode === 'active') {
        this.resetPerformance();
        this.position = 'none';
        logger.info(`[RSI] Reset performance and position for fresh start in ${this.mode} mode`);
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
      
      logger.info(`[RSI] Movement check for ${signalType} signal on ${productId}:`, {
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
        logger.info(`[RSI] Movement too small for ${signalType} signal on ${productId}. Trade value movement: ${(movementPercent * 100).toFixed(3)}% < ${(this.minMovementPercent * 100).toFixed(3)}%`);
        return false;
      }
      
      logger.info(`[RSI] Movement sufficient for ${signalType} signal on ${productId}. Trade value movement: ${(movementPercent * 100).toFixed(3)}% ✓`);
    } else {
      // If no previous signal price, allow the first signal
      logger.info(`[RSI] No previous signal price for ${productId}, allowing first ${signalType} signal`);
    }
    
    return true;
  }
}

module.exports = RSIStrategy;
