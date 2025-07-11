const logger = require('../utils/logger');

class TradingEngine {
  constructor(coinbaseService) {
    this.coinbaseService = coinbaseService;
    this.activeOrders = new Map();
    this.portfolio = {
      BTC: 0,
      USD: 0
    };
    this.tradingEnabled = false;
    this.riskManager = new RiskManager();
    this.unsubscribe = null;
    this.io = null;
    
    // Performance tracking
    this.performanceData = {
      sessionStartTime: new Date().toISOString(),
      totalTrades: 0,
      buyTrades: 0,
      sellTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      grossProfit: 0,
      grossLoss: 0,
      totalFees: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      trades: [], // Store all trade details
      maxDrawdown: 0,
      peakEquity: 0
    };
    
    // Track positions for P&L calculation
    this.positions = new Map(); // productId -> { amount, avgPrice, totalCost }
  }

  async initialize() {
    try {
      // Load current portfolio
      await this.loadPortfolio();
      
      // Note: Market data is forwarded from main server, no need to subscribe directly
      
      this.tradingEnabled = true;
      logger.info('Trading engine initialized');
    } catch (error) {
      logger.error('Failed to initialize trading engine:', error);
      throw error;
    }
  }

  async loadPortfolio() {
    try {
      const accountsResponse = await this.coinbaseService.getAccounts();
      logger.debug('Raw accounts response:', JSON.stringify(accountsResponse, null, 2));
      
      // Dynamically build portfolio for all currencies in accounts
      this.portfolio = {};
      const accounts = accountsResponse.accounts || [];
      const allCurrencies = [];
      accounts.forEach(account => {
        const currency = account.currency;
        const availableBalance = parseFloat(account.available_balance?.value || 0);
        const holdBalance = parseFloat(account.hold?.value || 0);
        const totalBalance = availableBalance + holdBalance;
        this.portfolio[currency] = totalBalance;
        allCurrencies.push({ currency, totalBalance });
        logger.debug(`Account ${currency}: Available=${availableBalance}, Hold=${holdBalance}, Total=${totalBalance}`);
      });

      logger.info('Portfolio loaded:', this.portfolio);
      logger.info('All Coinbase currencies in portfolio:', allCurrencies.map(c => `${c.currency}: ${c.totalBalance}`).join(', '));
    } catch (error) {
      logger.error('Error loading portfolio:', error);
      // Set default portfolio values on error
      this.portfolio = {
        BTC: 0,
        ETH: 0,
        ADA: 0,
        SOL: 0,
        DOT: 0,
        MATIC: 0,
        AVAX: 0,
        LINK: 0,
        USD: 0,
        USDC: 0
      };
    }
  }

  handleMarketData(event, data) {
    if (!this.tradingEnabled) return;

    switch (event) {
      case 'price':
        this.handlePriceUpdate(data);
        break;
      case 'trade':
        this.handleTradeUpdate(data);
        break;
      case 'orderbook':
        this.handleOrderBookUpdate(data);
        break;
    }
  }

  handlePriceUpdate(data) {
    // This will be called by strategies to make trading decisions
    logger.debug(`Price update: ${data.productId} - $${data.price}`);
  }

  handleTradeUpdate(data) {
    // Process trade data for market analysis
    logger.debug(`Trade: ${data.productId} - ${data.side} ${data.size} @ $${data.price}`);
  }

  handleOrderBookUpdate(data) {
    // Process order book updates
    logger.debug('Order book update received');
  }

  async executeBuyOrder(productId, amount, price = null, orderType = 'market', isSimulated = false) {
    try {
      // Risk management checks
      const riskCheck = await this.riskManager.checkBuyOrder(productId, amount, price, this.portfolio);
      if (!riskCheck.approved) {
        logger.warn('Buy order rejected by risk manager:', riskCheck.reason);
        return { success: false, error: riskCheck.reason };
      }

      let result;
      let executedPrice = price;
      let fees = 0;

      if (isSimulated) {
        // Simulate the order without actually placing it
        executedPrice = price || this.getCurrentPrice(productId) || 50000; // Use provided price or get current price
        fees = amount * executedPrice * 0.005; // 0.5% fee simulation
        
        result = {
          order: {
            id: `sim-${Date.now()}`,
            productId,
            side: 'buy',
            amount,
            price: executedPrice,
            fees,
            timestamp: new Date().toISOString()
          }
        };
        
        logger.info(`[SIMULATED] Buy order: ${amount} ${productId} at $${executedPrice} (fees: $${fees.toFixed(2)})`);
      } else {
        // Place the actual order
        result = await this.coinbaseService.placeBuyOrder(productId, amount, price);
        executedPrice = result.order?.price || price;
        fees = result.order?.fees || 0;
        
        // Track the order
        const orderId = result.order?.order_id || result.order_id || result.id;
        if (orderId) {
          this.activeOrders.set(orderId, {
            ...result.order,
            timestamp: new Date(),
            type: 'buy'
          });
        }
      }

      // Record the trade for performance tracking
      const trade = this.recordTrade(productId, 'BUY', amount, executedPrice, fees, isSimulated);

      logger.info(`Buy order ${isSimulated ? 'simulated' : 'executed'}: ${amount} ${productId} at ${executedPrice || 'market'}`);
      return { success: true, order: result.order || result, trade };
    } catch (error) {
      logger.error('Error executing buy order:', error);
      return { success: false, error: error.message };
    }
  }

  async executeSellOrder(productId, amount, price = null, orderType = 'market', isSimulated = false) {
    try {
      // Risk management checks
      const riskCheck = await this.riskManager.checkSellOrder(productId, amount, price, this.portfolio);
      if (!riskCheck.approved) {
        logger.warn('Sell order rejected by risk manager:', riskCheck.reason);
        return { success: false, error: riskCheck.reason };
      }

      let result;
      let executedPrice = price;
      let fees = 0;

      if (isSimulated) {
        // Simulate the order without actually placing it
        executedPrice = price || this.getCurrentPrice(productId) || 50000; // Use provided price or get current price
        fees = amount * executedPrice * 0.005; // 0.5% fee simulation
        
        result = {
          order: {
            id: `sim-${Date.now()}`,
            productId,
            side: 'sell',
            amount,
            price: executedPrice,
            fees,
            timestamp: new Date().toISOString()
          }
        };
        
        logger.info(`[SIMULATED] Sell order: ${amount} ${productId} at $${executedPrice} (fees: $${fees.toFixed(2)})`);
      } else {
        // Place the actual order
        result = await this.coinbaseService.placeSellOrder(productId, amount, price);
        executedPrice = result.order?.price || price;
        fees = result.order?.fees || 0;
        
        // Track the order
        const orderId = result.order?.order_id || result.order_id || result.id;
        if (orderId) {
          this.activeOrders.set(orderId, {
            ...result.order,
            timestamp: new Date(),
            type: 'sell'
          });
        }
      }

      // Record the trade for performance tracking
      const trade = this.recordTrade(productId, 'SELL', amount, executedPrice, fees, isSimulated);

      logger.info(`Sell order ${isSimulated ? 'simulated' : 'executed'}: ${amount} ${productId} at ${executedPrice || 'market'}`);
      return { success: true, order: result.order || result, trade };
    } catch (error) {
      logger.error('Error executing sell order:', error);
      return { success: false, error: error.message };
    }
  }

  async cancelOrder(orderId) {
    try {
      await this.coinbaseService.cancelOrder(orderId);
      this.activeOrders.delete(orderId);
      logger.info(`Order cancelled: ${orderId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }
  }

  getPortfolio() {
    return this.portfolio;
  }

  getActiveOrders() {
    return Array.from(this.activeOrders.values());
  }

  async syncPortfolio() {
    await this.loadPortfolio();
    // After loading, update WebSocket subscriptions to all held cryptos
    const heldCryptos = Object.entries(this.portfolio)
      .filter(([currency, amount]) => amount > 0 && currency !== 'USD' && currency !== 'USDC')
      .map(([currency]) => `${currency}-USD`);
    if (this.coinbaseService && heldCryptos.length > 0) {
      await this.coinbaseService.updateSubscriptions(heldCryptos);
    }
    // Emit portfolio update via Socket.IO if available
    if (this.io) {
      this.io.emit('portfolio-update', {
        portfolio: this.portfolio,
        timestamp: new Date().toISOString()
      });
    }
  }

  setSocketIO(io) {
    this.io = io;
  }

  async stop() {
    this.tradingEnabled = false;
    // Note: No need to unsubscribe since we don't subscribe directly anymore
    logger.info('Trading engine stopped');
  }

  getAvailableCryptos() {
    // Return all portfolio keys as crypto symbols, with USD pairs
    return Object.keys(this.portfolio)
      .filter(symbol => symbol !== 'USD' && symbol !== 'USDC')
      .map(symbol => ({
        id: `${symbol}-USD`,
        symbol,
        name: symbol, // Optionally, map to a friendly name if you have a lookup
        icon: '❓' // Optionally, map to an icon if you have a lookup
      }));
  }

  getPerformanceData() {
    return this.performanceData;
  }

  recordTrade(productId, side, amount, price, fees = 0, isSimulated = false) {
    const timestamp = new Date().toISOString();
    const totalValue = amount * price;
    const cryptoSymbol = productId.split('-')[0];
    
    // Create trade record
    const trade = {
      id: `${timestamp}-${side}-${productId}`,
      timestamp,
      productId,
      cryptoSymbol,
      side,
      amount,
      price,
      totalValue,
      fees,
      isSimulated,
      realizedPnL: 0 // Will be calculated for sells
    };
    
    // Update performance metrics
    this.performanceData.totalTrades++;
    if (side === 'BUY') {
      this.performanceData.buyTrades++;
    } else {
      this.performanceData.sellTrades++;
    }
    
    this.performanceData.totalFees += fees;
    
    // Handle position tracking and P&L calculation
    if (side === 'BUY') {
      this.recordBuyTrade(productId, amount, price, totalValue);
    } else if (side === 'SELL') {
      const realizedPnL = this.recordSellTrade(productId, amount, price, totalValue);
      trade.realizedPnL = realizedPnL;
      
      // Update P&L metrics
      if (realizedPnL > 0) {
        this.performanceData.winningTrades++;
        this.performanceData.grossProfit += realizedPnL;
      } else {
        this.performanceData.losingTrades++;
        this.performanceData.grossLoss += Math.abs(realizedPnL);
      }
      
      this.performanceData.realizedPnL += realizedPnL;
    }
    
    // Store trade
    this.performanceData.trades.push(trade);
    
    // Keep only last 1000 trades to prevent memory issues
    if (this.performanceData.trades.length > 1000) {
      this.performanceData.trades = this.performanceData.trades.slice(-1000);
    }
    
    // Update drawdown tracking
    this.updateDrawdownMetrics();
    
    logger.info(`[PERFORMANCE] Trade recorded: ${side} ${amount} ${cryptoSymbol} @ $${price} ${isSimulated ? '(SIMULATED)' : ''}`);
    
    // Emit performance update if Socket.IO is available
    if (this.io) {
      this.io.emit('performance-update', {
        performance: this.getPerformanceSummary(),
        trade,
        timestamp
      });
    }
    
    return trade;
  }
  
  recordBuyTrade(productId, amount, price, totalValue) {
    const position = this.positions.get(productId) || { amount: 0, totalCost: 0, avgPrice: 0 };
    
    // Update position with new buy
    const newTotalCost = position.totalCost + totalValue;
    const newAmount = position.amount + amount;
    const newAvgPrice = newAmount > 0 ? newTotalCost / newAmount : 0;
    
    this.positions.set(productId, {
      amount: newAmount,
      totalCost: newTotalCost,
      avgPrice: newAvgPrice
    });
  }
  
  recordSellTrade(productId, amount, price, totalValue) {
    const position = this.positions.get(productId) || { amount: 0, totalCost: 0, avgPrice: 0 };
    
    if (position.amount <= 0) {
      logger.warn(`[PERFORMANCE] Sell trade recorded but no position exists for ${productId}`);
      return 0;
    }
    
    // Calculate realized P&L using FIFO (first in, first out)
    const soldPortion = Math.min(amount, position.amount);
    const costBasis = soldPortion * position.avgPrice;
    const realizedPnL = (soldPortion * price) - costBasis;
    
    // Update position
    const remainingAmount = position.amount - soldPortion;
    const remainingCost = position.totalCost - costBasis;
    
    if (remainingAmount > 0) {
      this.positions.set(productId, {
        amount: remainingAmount,
        totalCost: remainingCost,
        avgPrice: position.avgPrice // Avg price stays the same
      });
    } else {
      this.positions.delete(productId);
    }
    
    return realizedPnL;
  }
  
  updateDrawdownMetrics() {
    const currentEquity = this.performanceData.realizedPnL + this.calculateUnrealizedPnL();
    
    if (currentEquity > this.performanceData.peakEquity) {
      this.performanceData.peakEquity = currentEquity;
    }
    
    const drawdown = this.performanceData.peakEquity - currentEquity;
    if (drawdown > this.performanceData.maxDrawdown) {
      this.performanceData.maxDrawdown = drawdown;
    }
  }
  
  calculateUnrealizedPnL() {
    let unrealizedPnL = 0;
    
    for (const [productId, position] of this.positions) {
      // Get current price (this would need to be updated with real price data)
      const currentPrice = this.getCurrentPrice(productId);
      if (currentPrice > 0) {
        const currentValue = position.amount * currentPrice;
        const unrealized = currentValue - position.totalCost;
        unrealizedPnL += unrealized;
      }
    }
    
    this.performanceData.unrealizedPnL = unrealizedPnL;
    return unrealizedPnL;
  }
  
  getCurrentPrice(productId) {
    // Get the current price from the coinbase service
    if (this.coinbaseService && this.coinbaseService.getLastPrice) {
      return this.coinbaseService.getLastPrice(productId) || 0;
    }
    return 0;
  }
  
  getPerformanceSummary() {
    this.calculateUnrealizedPnL(); // Update unrealized P&L
    
    const netProfit = this.performanceData.realizedPnL + this.performanceData.unrealizedPnL - this.performanceData.totalFees;
    const winRate = this.performanceData.totalTrades > 0 ? 
      (this.performanceData.winningTrades / this.performanceData.totalTrades * 100).toFixed(1) : 0;
    
    return {
      sessionStartTime: this.performanceData.sessionStartTime,
      totalTrades: this.performanceData.totalTrades,
      buyTrades: this.performanceData.buyTrades,
      sellTrades: this.performanceData.sellTrades,
      winningTrades: this.performanceData.winningTrades,
      losingTrades: this.performanceData.losingTrades,
      winRate: parseFloat(winRate),
      grossProfit: this.performanceData.grossProfit,
      grossLoss: this.performanceData.grossLoss,
      realizedPnL: this.performanceData.realizedPnL,
      unrealizedPnL: this.performanceData.unrealizedPnL,
      totalFees: this.performanceData.totalFees,
      netProfit,
      maxDrawdown: this.performanceData.maxDrawdown,
      peakEquity: this.performanceData.peakEquity,
      portfolio: Object.fromEntries(this.positions),
      recentTrades: this.performanceData.trades.slice(-20) // Last 20 trades
    };
  }
  
  resetPerformanceData() {
    logger.info('[PERFORMANCE] Resetting performance data for new session');
    this.performanceData = {
      sessionStartTime: new Date().toISOString(),
      totalTrades: 0,
      buyTrades: 0,
      sellTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      grossProfit: 0,
      grossLoss: 0,
      totalFees: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      trades: [],
      maxDrawdown: 0,
      peakEquity: 0
    };
    this.positions.clear();
    
    // Emit performance reset if Socket.IO is available
    if (this.io) {
      this.io.emit('performance-reset', {
        timestamp: new Date().toISOString()
      });
    }
  }
}

class RiskManager {
  constructor() {
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE) || 1000;
    this.riskTolerance = parseFloat(process.env.RISK_TOLERANCE) || 0.05;
    this.dailyLossLimit = this.maxPositionSize * this.riskTolerance;
    this.dailyLoss = 0;
    this.lastResetDate = new Date().toDateString();
  }

  async checkBuyOrder(productId, amount, price, portfolio) {
    this.resetDailyLossIfNeeded();

    const currentPrice = price || this.getCurrentPrice(productId);
    const orderValue = amount * currentPrice;

    // Check if order exceeds position size limit
    if (orderValue > this.maxPositionSize) {
      return {
        approved: false,
        reason: `Order value $${orderValue} exceeds max position size $${this.maxPositionSize}`
      };
    }

    // Check if sufficient funds
    if (portfolio.USD < orderValue) {
      return {
        approved: false,
        reason: `Insufficient funds. Required: $${orderValue}, Available: $${portfolio.USD}`
      };
    }

    // Check daily loss limit
    if (this.dailyLoss >= this.dailyLossLimit) {
      return {
        approved: false,
        reason: `Daily loss limit reached: $${this.dailyLoss}`
      };
    }

    return { approved: true };
  }

  async checkSellOrder(productId, amount, price, portfolio) {
    this.resetDailyLossIfNeeded();

    // Check if sufficient crypto balance
    const cryptoSymbol = productId.split('-')[0];
    if (portfolio[cryptoSymbol] < amount) {
      return {
        approved: false,
        reason: `Insufficient ${cryptoSymbol} balance. Required: ${amount}, Available: ${portfolio[cryptoSymbol]}`
      };
    }

    return { approved: true };
  }

  resetDailyLossIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyLoss = 0;
      this.lastResetDate = today;
    }
  }

  getCurrentPrice(productId) {
    // This would get the current price from the market data
    // Return a reasonable default price for risk calculations
    const priceDefaults = {
      'BTC-USD': 50000,
      'ETH-USD': 3000,
      'ADA-USD': 0.5,
      'DOT-USD': 10,
      'DOGE-USD': 0.1
    };
    return priceDefaults[productId] || 1000; // Default to $1000 if unknown
  }

  recordLoss(amount) {
    this.dailyLoss += amount;
  }
}

module.exports = TradingEngine;
