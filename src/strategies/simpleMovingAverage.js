const BaseStrategy = require('./baseStrategy');
const logger = require('../utils/logger');

class SimpleMovingAverageStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super();
    this.period = parameters.period || 20;
    this.priceHistories = {};
    this.smas = {};
    this.positions = {};
    this.lastSignalPrice = {};
    this.lastPrices = {}; // Initialize this missing property
    this.lastSmas = {}; // Initialize this missing property
    
    // Signal filtering parameters
    this.minMovementPercent = parameters.minMovementPercent || 0.005; // 0.5% price movement minimum
    this.tradeAmount = parameters.tradeAmount || 0.01; // Default trade amount
    this.mode = parameters.mode || 'simulation'; // trading mode
    
    // Track if we've generated initial buy signal for each crypto
    this.initialBuyGenerated = {};
    
    // Trade tracking for performance analysis
    this.trades = [];
    
    // Trading engine reference (will be set when strategy is started)
    this.tradingEngine = null;
    
    logger.info(`[SMA] Strategy initialized with mode: ${this.mode}, period: ${this.period}, tradeAmount: ${this.tradeAmount}`);
  }

  setTradingEngine(tradingEngine) {
    this.tradingEngine = tradingEngine;
    logger.info(`[SMA] Trading engine reference set`);
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
      this.initialBuyGenerated[productId] = false;
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

  shouldGenerateSignal(productId, currentPrice, signalType) {
    // Buy signals can happen immediately when trading starts
    if (signalType === 'BUY' || signalType === 'buy') {
      return true;
    }
    
    // Sell signals require minimum price movement check
    const lastSignalPrice = this.lastSignalPrice[productId];
    
    if (lastSignalPrice) {
      const priceMovement = Math.abs(currentPrice - lastSignalPrice);
      const tradeValueMovement = priceMovement * this.tradeAmount;
      const baseTradeValue = lastSignalPrice * this.tradeAmount;
      const movementPercent = tradeValueMovement / baseTradeValue;
      
      logger.info(`[SMA] Movement check for ${signalType} signal on ${productId}:`, {
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
        logger.info(`[SMA] Movement too small for ${signalType} on ${productId}. Trade value movement: ${(movementPercent * 100).toFixed(3)}% < ${(this.minMovementPercent * 100).toFixed(3)}%`);
        return false;
      }
      
      logger.info(`[SMA] Movement sufficient for ${signalType} on ${productId}. Trade value movement: ${(movementPercent * 100).toFixed(3)}% ✓`);
    }
    
    return true;
  }

  async generateBuySignal(productId, price, sma) {
    logger.info(`[SMA] 🟢 generateBuySignal called for ${productId}: price=${price}, sma=${sma}, mode=${this.mode}`);
    
    if (!this.shouldGenerateSignal(productId, price, 'BUY')) {
      logger.info(`[SMA] ❌ shouldGenerateSignal returned false for BUY signal on ${productId}`);
      return;
    }
    
    logger.info(`[SMA] ✅ shouldGenerateSignal returned true, proceeding with BUY signal generation`);
    
    // Update tracking
    this.lastSignalPrice[productId] = price;
    this.positions[productId] = 'long'; // Set position to long after buy
    
    // Create signal
    const signal = {
      type: 'buy',
      productId,
      price,
      sma,
      timestamp: new Date().toISOString(),
      strategy: 'SMA',
      data: {
        price,
        sma,
        position: 'long',
        tradeAmount: this.tradeAmount,
        mode: this.mode
      }
    };
    
    // Execute trade based on mode
    let trade = null;
    if (this.mode === 'simulation') {
      logger.info(`[SMA] 🔄 Simulating trade for BUY signal in simulation mode`);
      trade = await this.simulateTrade(signal);
      signal.trade = trade;
      logger.info(`[SMA] 📊 Simulated trade result:`, trade);
    } else if (this.mode === 'active') {
      logger.info(`[SMA] 🔄 Executing real trade for BUY signal in active mode`);
      trade = await this.executeTrade(signal);
      signal.trade = trade;
      logger.info(`[SMA] 📊 Real trade execution result:`, trade);
    } else {
      logger.info(`[SMA] ⏸️  Not executing trade - mode is ${this.mode}`);
    }
    
    logger.info(`[SMA] BUY signal for ${productId}: price ${price} crossed above SMA ${sma.toFixed(2)}`);
    if (trade) {
      logger.info(`[SMA] Trade executed: ${trade.success ? 'SUCCESS' : 'FAILED'} ${signal.type.toUpperCase()} ${this.tradeAmount} ${productId} at $${price}`);
    }
    
    this.onSignal(signal);
  }

  async generateSellSignal(productId, price, sma) {
    logger.info(`[SMA] 🔴 generateSellSignal called for ${productId}: price=${price}, sma=${sma}, mode=${this.mode}`);
    
    if (!this.shouldGenerateSignal(productId, price, 'SELL')) {
      logger.info(`[SMA] ❌ shouldGenerateSignal returned false for SELL signal on ${productId}`);
      return;
    }
    
    logger.info(`[SMA] ✅ shouldGenerateSignal returned true, proceeding with SELL signal generation`);
    
    // Update tracking
    this.lastSignalPrice[productId] = price;
    this.positions[productId] = 'none'; // Set position to none after sell (cash position)
    
    // Create signal
    const signal = {
      type: 'sell',
      productId,
      price,
      sma,
      timestamp: new Date().toISOString(),
      strategy: 'SMA',
      data: {
        price,
        sma,
        position: 'none',
        tradeAmount: this.tradeAmount,
        mode: this.mode
      }
    };
    
    // Execute trade based on mode
    let trade = null;
    if (this.mode === 'simulation') {
      logger.info(`[SMA] 🔄 Simulating trade for SELL signal in simulation mode`);
      trade = await this.simulateTrade(signal);
      signal.trade = trade;
      logger.info(`[SMA] 📊 Simulated trade result:`, trade);
    } else if (this.mode === 'active') {
      logger.info(`[SMA] 🔄 Executing real trade for SELL signal in active mode`);
      trade = await this.executeTrade(signal);
      signal.trade = trade;
      logger.info(`[SMA] 📊 Real trade execution result:`, trade);
    } else {
      logger.info(`[SMA] ⏸️  Not executing trade - mode is ${this.mode}`);
    }
    
    logger.info(`[SMA] SELL signal for ${productId}: price ${price} crossed below SMA ${sma.toFixed(2)}`);
    if (trade) {
      logger.info(`[SMA] Trade executed: ${trade.success ? 'SUCCESS' : 'FAILED'} ${signal.type.toUpperCase()} ${this.tradeAmount} ${productId} at $${price}`);
    }
    
    this.onSignal(signal);
  }

  generateSignals(currentPrice, productId) {
    const sma = this.smas[productId];
    const lastPrice = this.lastPrices[productId];
    const lastSma = this.lastSmas[productId];
    const position = this.positions[productId] || 'none';
    
    // Add detailed logging for every signal generation call
    logger.info(`[SMA] 🔍 Signal check for ${productId}: currentPrice=${currentPrice}, sma=${sma?.toFixed(2)}, lastPrice=${lastPrice}, lastSma=${lastSma?.toFixed(2)}, position=${position}, mode=${this.mode}, initialBuyGenerated=${this.initialBuyGenerated[productId]}`);
    
    if (sma === null || lastPrice === null || lastSma === null) {
      logger.info(`[SMA] ⚠️  Skipping signal generation for ${productId}: missing data (sma=${sma}, lastPrice=${lastPrice}, lastSma=${lastSma})`);
      return;
    }
    
    // Log crossover conditions for debugging
    const buyCondition = lastPrice <= lastSma && currentPrice > sma;
    const sellCondition = lastPrice >= lastSma && currentPrice < sma;
    logger.debug(`[SMA] 🔎 Crossover conditions for ${productId}: buyCondition=${buyCondition} (${lastPrice} <= ${lastSma} && ${currentPrice} > ${sma}), sellCondition=${sellCondition} (${lastPrice} >= ${lastSma} && ${currentPrice} < ${sma})`);
    
    // Always check for crossovers when strategy is running (for visualization)
    // This will show crossover points regardless of trading mode
    
    // Check for initial buy crossover (for crossover visualization)
    if (!this.initialBuyGenerated[productId] && lastPrice <= lastSma && currentPrice > sma) {
      logger.info(`[SMA] ✅ Initial BUY crossover detected for ${productId}: price ${currentPrice} crossed above SMA ${sma.toFixed(2)}`);
      
      // Always emit crossover signal for visualization (grey marker)
      this.emitCrossoverSignal(productId, currentPrice, sma, 'BUY');
      
      // Only generate actual trade signals if in simulation/active mode and position allows it
      if ((this.mode === 'simulation' || this.mode === 'active') && position !== 'long') {
        logger.info(`[SMA] 🚀 Calling generateBuySignal for initial buy in ${this.mode} mode`);
        this.generateBuySignal(productId, currentPrice, sma);
        this.initialBuyGenerated[productId] = true;
        logger.info(`[SMA] ✅ Initial buy signal processing complete, initialBuyGenerated set to true`);
        return; // Exit early to avoid duplicate signal
      } else {
        logger.info(`[SMA] Initial crossover detected but not generating trade signal (mode=${this.mode}, position=${position})`);
        // Still set this to true so we don't keep detecting the same initial crossover
        this.initialBuyGenerated[productId] = true;
      }
    }
    
    // Check for subsequent crossovers
    // Buy crossover: last price was below SMA AND current price is above SMA
    if (this.initialBuyGenerated[productId] && lastPrice <= lastSma && currentPrice > sma) {
      logger.info(`[SMA] BUY crossover detected for ${productId}: price ${currentPrice} crossed above SMA ${sma.toFixed(2)} (position was ${position})`);
      
      // Always emit crossover signal for visualization (grey marker)
      this.emitCrossoverSignal(productId, currentPrice, sma, 'BUY');
      
      // Only generate actual trade signals if in simulation/active mode and position allows it
      if ((this.mode === 'simulation' || this.mode === 'active') && position !== 'long') {
        logger.info(`[SMA] Generating BUY trade signal for crossover`);
        this.generateBuySignal(productId, currentPrice, sma);
      } else {
        logger.info(`[SMA] Crossover detected but not generating trade signal (mode=${this.mode}, position=${position})`);
      }
    }
    // Sell crossover: last price was above SMA AND current price is below SMA  
    else if (lastPrice >= lastSma && currentPrice < sma) {
      logger.info(`[SMA] SELL crossover detected for ${productId}: price ${currentPrice} crossed below SMA ${sma.toFixed(2)} (position was ${position})`);
      
      // Always emit crossover signal for visualization (grey marker)
      this.emitCrossoverSignal(productId, currentPrice, sma, 'SELL');
      
      // Only generate actual trade signals if in simulation/active mode and position allows it
      if ((this.mode === 'simulation' || this.mode === 'active') && position === 'long') {
        logger.info(`[SMA] Generating SELL trade signal for crossover`);
        this.generateSellSignal(productId, currentPrice, sma);
      } else {
        logger.info(`[SMA] Crossover detected but not generating trade signal (mode=${this.mode}, position=${position})`);
      }
    } else {
      logger.info(`[SMA] 🚫 No crossover for ${productId}: conditions not met`);
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
    return `Simple Moving Average strategy using ${this.period}-period SMA. In simulation/trading mode: generates initial BUY on first crossover above SMA, then follows regular crossover signals. SELL signals require trade value movement ≥ ${(this.minMovementPercent * 100).toFixed(1)}% of ${this.tradeAmount} trade amount.`;
  }

  emitCrossoverSignal(productId, price, sma, type) {
    const crossoverSignal = {
      type: 'CROSSOVER',
      direction: type, // 'BUY' or 'SELL' to indicate crossover direction
      productId,
      price,
      sma,
      timestamp: new Date().toISOString(),
      strategy: 'SMA',
      data: {
        price,
        sma,
        crossoverDirection: type,
        mode: this.mode,
        isVisualizationOnly: true // Flag to indicate this is for chart visualization
      }
    };

    // Emit crossover signal over Socket.IO if available
    if (global.tradingBot && global.tradingBot.io) {
      logger.debug(`[SMA] Emitting CROSSOVER signal (${type}) for ${productId} at price ${price}`);
      global.tradingBot.io.emit('crossover', crossoverSignal);
    }
  }

  onSignal(signal) {
    logger.info(`[SMA] 📡 onSignal called with signal:`, {
      type: signal.type,
      productId: signal.productId,
      price: signal.price || signal.data?.price,
      timestamp: signal.timestamp
    });
    
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

  async updateParameters(parameters = {}) {
    logger.info(`[SMA] Updating parameters:`, parameters);
    
    const oldPeriod = this.period;
    
    // Update period if provided
    if (parameters.period && parameters.period !== this.period) {
      this.period = parameters.period;
      logger.info(`[SMA] Period updated to: ${this.period}`);
    }
    
    // Update minimum movement percent if provided
    if (parameters.minMovementPercent !== undefined) {
      this.minMovementPercent = parameters.minMovementPercent;
      logger.info(`[SMA] Min movement percent updated to: ${this.minMovementPercent}`);
    }
    
    // Update trade amount if provided
    if (parameters.tradeAmount !== undefined) {
      this.tradeAmount = parameters.tradeAmount;
      logger.info(`[SMA] Trade amount updated to: ${this.tradeAmount}`);
    }
    
    // Update trading mode if provided
    if (parameters.mode !== undefined) {
      this.mode = parameters.mode;
      logger.info(`[SMA] Trading mode updated to: ${this.mode}`);
      
      // Reset performance and tracking when switching to simulation/trading mode
      if (this.mode === 'simulation' || this.mode === 'active') {
        // Reset all tracking data for a fresh start
        this.resetPerformance();
        
        // Reset positions and initialization flags to start fresh
        Object.keys(this.positions).forEach(productId => {
          this.positions[productId] = 'none';
          this.initialBuyGenerated[productId] = false;
        });
        
        logger.info(`[SMA] Reset performance and positions for fresh start in ${this.mode} mode`);
      }
    }
    
    // Clear SMA cache to recalculate with new period if period changed
    if (parameters.period && parameters.period !== oldPeriod) {
      Object.keys(this.smas).forEach(productId => {
        this.smas[productId] = null;
        // Keep price history but recalculate SMA
        this.calculateSMA(productId);
      });
    }
  }

  async executeTrade(signal) {
    const { type, productId, price } = signal;
    
    if (this.mode === 'stopped') {
      logger.info(`[SMA] Trading is stopped. Signal ignored: ${type} ${productId}`);
      return null;
    }
    
    if (!this.tradingEngine) {
      logger.error(`[SMA] Trading engine not available. Cannot execute ${type} for ${productId}`);
      return { success: false, error: 'Trading engine not available' };
    }
    
    try {
      let result;
      
      if (type === 'BUY' || type === 'buy') {
        result = await this.tradingEngine.executeBuyOrder(productId, this.tradeAmount);
      } else if (type === 'SELL' || type === 'sell') {
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
          status: this.mode === 'active' ? 'executed' : 'simulated',
          usdAmount: result.usdAmount || (this.tradeAmount * price),
          portfolio: result.portfolio || null
        };
        
        this.trades.push(trade);
        
        logger.info(`[SMA] Trade ${trade.status}: ${type} ${this.tradeAmount} ${productId} at $${price}`);
        
        // Sync portfolio after trade (only for real trades)
        if (this.mode === 'active' && this.tradingEngine.syncPortfolio) {
          await this.tradingEngine.syncPortfolio();
        }
        
        return { success: true, trade };
      } else {
        logger.error(`[SMA] Trade failed: ${result?.error || 'Unknown error'}`);
        return result || { success: false, error: 'Unknown error' };
      }
    } catch (error) {
      logger.error(`[SMA] Error executing ${type} trade for ${productId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async simulateTrade(signal) {
    const { type, productId, price } = signal;
    
    try {
      // Extract crypto symbol from productId (e.g., 'BTC-USD' -> 'BTC')
      const cryptoSymbol = productId.split('-')[0];
      
      // Get live portfolio from trading engine
      const livePortfolio = this.tradingEngine ? this.tradingEngine.getPortfolio() : {};
      
      if (type === 'BUY' || type === 'buy') {
        // Calculate how much crypto we can buy with the trade amount
        const usdToSpend = this.tradeAmount * price; // Convert trade amount from crypto to USD
        const usdAvailable = (livePortfolio.USD || 0) + (livePortfolio.USDC || 0);
        
        if (usdAvailable >= usdToSpend) {
          logger.info(`[SMA] Simulated BUY: ${this.tradeAmount} ${cryptoSymbol} for $${usdToSpend.toFixed(2)} (live portfolio unchanged)`);
          
          return {
            success: true,
            type: 'simulated',
            action: 'buy',
            amount: this.tradeAmount,
            price: price,
            usdAmount: usdToSpend,
            portfolio: livePortfolio
          };
        } else {
          logger.warn(`[SMA] Insufficient USD for simulated buy: need $${usdToSpend.toFixed(2)}, have $${usdAvailable.toFixed(2)}`);
          return {
            success: false,
            error: 'Insufficient USD balance',
            usdNeeded: usdToSpend,
            usdAvailable: usdAvailable
          };
        }
      } else if (type === 'SELL' || type === 'sell') {
        // Check if we have enough crypto to sell
        const cryptoAvailable = livePortfolio[cryptoSymbol] || 0;
        
        if (cryptoAvailable >= this.tradeAmount) {
          // Calculate simulated sell
          const usdReceived = this.tradeAmount * price;
          
          logger.info(`[SMA] Simulated SELL: ${this.tradeAmount} ${cryptoSymbol} for $${usdReceived.toFixed(2)} (live portfolio unchanged)`);
          
          return {
            success: true,
            type: 'simulated',
            action: 'sell',
            amount: this.tradeAmount,
            price: price,
            usdAmount: usdReceived,
            portfolio: livePortfolio
          };
        } else {
          logger.warn(`[SMA] Insufficient ${cryptoSymbol} for simulated sell: need ${this.tradeAmount}, have ${cryptoAvailable}`);
          return {
            success: false,
            error: `Insufficient ${cryptoSymbol} balance`,
            cryptoNeeded: this.tradeAmount,
            cryptoAvailable: cryptoAvailable
          };
        }
      }
    } catch (error) {
      logger.error(`[SMA] Error in simulated ${type} trade for ${productId}:`, error);
      return { success: false, error: error.message };
    }
  }

  getPerformance() {
    const totalTrades = this.trades.length;
    const buyTrades = this.trades.filter(trade => trade.type === 'BUY' || trade.type === 'buy').length;
    const sellTrades = this.trades.filter(trade => trade.type === 'SELL' || trade.type === 'sell').length;
    
    // Always use live portfolio from trading engine
    const currentPortfolio = this.tradingEngine ? this.tradingEngine.getPortfolio() : {};
    let currentPortfolioValue = 0;
    
    // Calculate total portfolio value in USD
    Object.entries(currentPortfolio).forEach(([symbol, amount]) => {
      if (amount > 0) {
        if (symbol === 'USD' || symbol === 'USDC') {
          currentPortfolioValue += amount;
        } else {
          // Use last known price for crypto holdings
          const currentPrice = this.lastPrices[`${symbol}-USD`] || 0;
          currentPortfolioValue += amount * currentPrice;
        }
      }
    });
    
    // Calculate simulated P&L if in simulation mode
    let totalPnL = 0;
    let pnlPercent = 0;
    
    if (this.mode === 'simulation') {
      // In simulation mode, calculate P&L from trade history without affecting actual portfolio
      let simulatedPnL = 0;
      this.trades.forEach(trade => {
        if (trade.type === 'BUY' || trade.type === 'buy') {
          simulatedPnL -= trade.usdAmount || 0; // Subtract USD spent
        } else if (trade.type === 'SELL' || trade.type === 'sell') {
          simulatedPnL += trade.usdAmount || 0; // Add USD received
        }
      });
      
      totalPnL = simulatedPnL;
      pnlPercent = currentPortfolioValue > 0 ? (totalPnL / currentPortfolioValue) * 100 : 0;
      
      logger.info(`[SMA] Simulation Performance: Simulated P&L: $${totalPnL.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
    }
    
    return {
      totalTrades,
      buyTrades,
      sellTrades,
      totalVolume: this.trades.reduce((sum, trade) => sum + (trade.usdAmount || 0), 0),
      currentPortfolioValue: parseFloat(currentPortfolioValue.toFixed(2)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      portfolio: currentPortfolio,
      recentTrades: this.trades.slice(-10),
      strategy: 'SMA',
      period: this.period,
      mode: this.mode
    };
  }

  getTrades() {
    return this.trades;
  }

  getPortfolio() {
    // Always return live portfolio from trading engine
    return this.tradingEngine ? this.tradingEngine.getPortfolio() : {};
  }

  resetPerformance() {
    this.trades = [];
    this.initialBuyGenerated = {};
    
    logger.info(`[SMA] Performance tracking reset`);
  }
}

module.exports = SimpleMovingAverageStrategy;
