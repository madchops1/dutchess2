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

  async executeBuyOrder(productId, amount, price = null, orderType = 'market') {
    try {
      // Risk management checks
      const riskCheck = await this.riskManager.checkBuyOrder(productId, amount, price, this.portfolio);
      if (!riskCheck.approved) {
        logger.warn('Buy order rejected by risk manager:', riskCheck.reason);
        return { success: false, error: riskCheck.reason };
      }

      // Place the order
      const result = await this.coinbaseService.placeBuyOrder(productId, amount, price);
      
      // Track the order
      const orderId = result.order?.order_id || result.order_id || result.id;
      if (orderId) {
        this.activeOrders.set(orderId, {
          ...result.order,
          timestamp: new Date(),
          type: 'buy'
        });
      }

      logger.info(`Buy order executed: ${amount} ${productId} at ${price || 'market'}`);
      return { success: true, order: result.order || result };
    } catch (error) {
      logger.error('Error executing buy order:', error);
      return { success: false, error: error.message };
    }
  }

  async executeSellOrder(productId, amount, price = null, orderType = 'market') {
    try {
      // Risk management checks
      const riskCheck = await this.riskManager.checkSellOrder(productId, amount, price, this.portfolio);
      if (!riskCheck.approved) {
        logger.warn('Sell order rejected by risk manager:', riskCheck.reason);
        return { success: false, error: riskCheck.reason };
      }

      // Place the order
      const result = await this.coinbaseService.placeSellOrder(productId, amount, price);
      
      // Track the order
      const orderId = result.order?.order_id || result.order_id || result.id;
      if (orderId) {
        this.activeOrders.set(orderId, {
          ...result.order,
          timestamp: new Date(),
          type: 'sell'
        });
      }

      logger.info(`Sell order executed: ${amount} ${productId} at ${price || 'market'}`);
      return { success: true, order: result.order || result };
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
    // For now, return a placeholder
    return 50000; // BTC price placeholder
  }

  recordLoss(amount) {
    this.dailyLoss += amount;
  }
}

module.exports = TradingEngine;
