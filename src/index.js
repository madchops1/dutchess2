const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const net = require('net');

const CoinbaseService = require('./services/coinbaseService');
const TradingEngine = require('./services/tradingEngine');
const StrategyManager = require('./services/strategyManager');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// Add global error handlers for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason || 'Unknown reason',
    promise: promise || 'Unknown promise',
    stack: reason && reason.stack ? reason.stack : 'No stack trace available'
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  // Don't exit the process for now, just log it
});

class TradingBot {
  constructor() {
    this.instanceId = Math.random().toString(36).substr(2, 9);
    logger.info(`[INSTANCE ${this.instanceId}] Creating TradingBot instance`);
    
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.port = process.env.PORT || 3000;
    this.coinbaseService = new CoinbaseService();
    this.tradingEngine = new TradingEngine(this.coinbaseService);
    this.strategyManager = new StrategyManager();
    
    // Track the currently selected crypto for strategy execution
    this.selectedCrypto = 'BTC-USD'; // Default to BTC-USD
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    
    // Pass Socket.IO instance to trading engine and strategy manager for real-time updates
    this.tradingEngine.setSocketIO(this.io);
    this.strategyManager.setSocketIO(this.io);
    
    // Pass trading engine reference to strategy manager
    this.strategyManager.setTradingEngine(this.tradingEngine);
  }

  async findAvailablePort(startPort = 3000) {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => {
          resolve(port);
        });
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try the next one
          this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Serve static files from frontend build
    this.app.use(express.static('frontend/dist'));
    
    // Enable CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({ 
        message: 'DutchessAI Trading Bot',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/status', (req, res) => {
      res.json({
        bot: 'active',
        strategies: this.strategyManager.getActiveStrategies(),
        lastPrice: this.coinbaseService.getLastPrice(),
        allPrices: this.coinbaseService.getAllPrices(),
        portfolio: this.tradingEngine.getPortfolio(),
        timestamp: new Date().toISOString()
      });
    });

    // Get available cryptocurrencies based on portfolio
    this.app.get('/cryptos', (req, res) => {
      const portfolio = this.tradingEngine.getPortfolio();
      const cryptos = [];
      
      // Define crypto metadata
      const cryptoMap = {
        'BTC': { name: 'Bitcoin', icon: '₿', productId: 'BTC-USD' },
        'ETH': { name: 'Ethereum', icon: 'Ξ', productId: 'ETH-USD' },
        'ETH2': { name: 'Ethereum 2.0', icon: 'Ξ', productId: 'ETH-USD' },
        'ADA': { name: 'Cardano', icon: '₳', productId: 'ADA-USD' },
        'DOT': { name: 'Polkadot', icon: '●', productId: 'DOT-USD' },
        'DOGE': { name: 'Dogecoin', icon: 'Ð', productId: 'DOGE-USD' },
        'XLM': { name: 'Stellar', icon: '*', productId: 'XLM-USD' },
        'BSV': { name: 'Bitcoin SV', icon: '₿', productId: 'BSV-USD' },
        'BAT': { name: 'Basic Attention Token', icon: 'B', productId: 'BAT-USD' },
        'BCH': { name: 'Bitcoin Cash', icon: '₿', productId: 'BCH-USD' },
        'LTC': { name: 'Litecoin', icon: 'Ł', productId: 'LTC-USD' },
        'ENJ': { name: 'Enjin Coin', icon: 'E', productId: 'ENJ-USD' },
        'POLY': { name: 'Polygon', icon: 'P', productId: 'MATIC-USD' },
        'ZRX': { name: '0x', icon: 'Z', productId: 'ZRX-USD' },
        'ETC': { name: 'Ethereum Classic', icon: 'Ξ', productId: 'ETC-USD' },
        'USDC': { name: 'USD Coin', icon: '$', productId: 'USDC-USD' }
      };
      
      // Filter portfolio to include only cryptocurrencies with balances > 0 and exclude USD
      Object.keys(portfolio).forEach(currency => {
        if (currency !== 'USD' && portfolio[currency] > 0 && cryptoMap[currency]) {
          const crypto = cryptoMap[currency];
          cryptos.push({
            id: crypto.productId,
            symbol: currency,
            name: crypto.name,
            icon: crypto.icon,
            balance: portfolio[currency]
          });
        }
      });
      
      // Always include BTC-USD as default if not present
      if (!cryptos.find(c => c.id === 'BTC-USD')) {
        cryptos.unshift({
          id: 'BTC-USD',
          symbol: 'BTC',
          name: 'Bitcoin',
          icon: '₿',
          balance: portfolio['BTC'] || 0
        });
      }
      
      res.json({ cryptos });
    });

    this.app.post('/strategy/start', async (req, res) => {
      const { strategyName, parameters } = req.body;
      try {
        await this.strategyManager.startStrategy(strategyName, parameters);
        res.json({ success: true, message: `Strategy ${strategyName} started` });
      } catch (error) {
        logger.error(`Failed to start strategy ${strategyName}:`, error);
        res.status(400).json({ error: error.message });
      }
    });

    this.app.post('/strategy/stop', async (req, res) => {
      const { strategyName } = req.body;
      try {
        await this.strategyManager.stopStrategy(strategyName);
        res.json({ success: true, message: `Strategy ${strategyName} stopped` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.post('/strategy/update', async (req, res) => {
      const { strategyName, parameters } = req.body;
      try {
        await this.strategyManager.updateStrategy(strategyName, parameters);
        res.json({ success: true, message: `Strategy ${strategyName} parameters updated` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.get('/strategy/performance/:strategyName', (req, res) => {
      const { strategyName } = req.params;
      try {
        // Get performance data from trading engine instead of individual strategies
        const performance = this.tradingEngine.getPerformanceSummary();
        res.json({ success: true, performance });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.get('/strategy/trades/:strategyName', (req, res) => {
      const { strategyName } = req.params;
      try {
        // Get trades from trading engine performance data
        const performance = this.tradingEngine.getPerformanceSummary();
        const trades = performance.recentTrades || [];
        res.json({ success: true, trades });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get/Set selected crypto for strategy execution
    this.app.get('/selected-crypto', (req, res) => {
      res.json({ selectedCrypto: this.selectedCrypto });
    });

    this.app.post('/selected-crypto', (req, res) => {
      const { crypto } = req.body;
      if (!crypto) {
        return res.status(400).json({ error: 'Crypto parameter is required' });
      }
      
      this.selectedCrypto = crypto;
      logger.info(`[MAIN] Selected crypto updated to: ${this.selectedCrypto}`);
      
      // Emit to frontend clients
      this.io.emit('selected-crypto-changed', { selectedCrypto: this.selectedCrypto });
      
      res.json({ success: true, selectedCrypto: this.selectedCrypto });
    });

    // Get strategy position and risk management status
    this.app.get('/strategy/position/:strategyName/:productId', (req, res) => {
      const { strategyName, productId } = req.params;
      try {
        const strategy = this.strategyManager.activeStrategies.get(strategyName);
        if (!strategy) {
          return res.status(404).json({ error: `Strategy ${strategyName} not found or not active` });
        }
        
        // Get position status
        const position = strategy.positions ? strategy.positions[productId] : 'none';
        
        // Get risk management status if method exists
        let riskManagement = null;
        if (typeof strategy.getRiskManagementStatus === 'function') {
          riskManagement = strategy.getRiskManagementStatus(productId);
        }
        
        res.json({ 
          success: true, 
          productId,
          position,
          riskManagement
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Reset performance data (new session)
    this.app.post('/performance/reset', (req, res) => {
      try {
        this.tradingEngine.resetPerformanceData();
        res.json({ success: true, message: 'Performance data reset for new session' });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get price for specific cryptocurrency
    this.app.get('/price/:productId', (req, res) => {
      const { productId } = req.params;
      const price = this.coinbaseService.getLastPrice(productId);
      const history = this.coinbaseService.getPriceHistory(productId, 1000);
      res.json({
        productId,
        price,
        history,
        timestamp: new Date().toISOString()
      });
    });

    // Debug endpoint to check strategy details
    this.app.get('/debug/strategy', (req, res) => {
      const strategies = Array.from(this.strategyManager.activeStrategies.entries()).map(([name, strategy]) => ({
        name,
        period: strategy.period,
        type: strategy.constructor.name,
        indicators: strategy.getIndicators ? strategy.getIndicators() : 'N/A'
      }));
      res.json({
        activeStrategies: strategies,
        timestamp: new Date().toISOString()
      });
    });

    // Update cryptocurrency subscriptions
    this.app.post('/subscriptions', async (req, res) => {
      const { productIds } = req.body;
      try {
        await this.coinbaseService.updateSubscriptions(productIds);
        res.json({ success: true, message: `Subscriptions updated to: ${productIds.join(', ')}` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Debug endpoint to simulate frontend portfolio filtering
    this.app.get('/debug/portfolio-filtering', (req, res) => {
      const portfolio = this.tradingEngine.getPortfolio();
      const allPrices = this.coinbaseService.getAllPrices();
      
      const cryptoInfo = {
        USD: { icon: '💵', color: '#10B981', name: 'US Dollar' },
        USDC: { icon: '💰', color: '#2775CA', name: 'USD Coin' },
        BTC: { icon: '₿', color: '#F7931A', name: 'Bitcoin' },
        ETH: { icon: '⟠', color: '#627EEA', name: 'Ethereum' },
        ETH2: { icon: '⟠', color: '#627EEA', name: 'Ethereum 2.0' },
        ADA: { icon: '₳', color: '#0033AD', name: 'Cardano' },
        SOL: { icon: '◎', color: '#9945FF', name: 'Solana' },
        DOT: { icon: '⬤', color: '#E6007A', name: 'Polkadot' },
        MATIC: { icon: '⬟', color: '#8247E5', name: 'Polygon' },
        POLY: { icon: '⬟', color: '#8247E5', name: 'Polygon' },
        AVAX: { icon: '🔺', color: '#E84142', name: 'Avalanche' },
        LINK: { icon: '🔗', color: '#375BD2', name: 'Chainlink' },
        UNI: { icon: '🦄', color: '#FF007A', name: 'Uniswap' },
        ATOM: { icon: '⚛️', color: '#2E3148', name: 'Cosmos' },
        XRP: { icon: '💧', color: '#23292F', name: 'Ripple' },
        XLM: { icon: '*', color: '#3F51B5', name: 'Stellar' },
        LTC: { icon: 'Ł', color: '#A6A9AA', name: 'Litecoin' },
        BCH: { icon: '₿', color: '#8DC351', name: 'Bitcoin Cash' },
        DOGE: { icon: 'Ð', color: '#C2A633', name: 'Dogecoin' },
        BSV: { icon: '₿', color: '#EAB300', name: 'Bitcoin SV' },
        BAT: { icon: 'B', color: '#FF5000', name: 'Basic Attention Token' },
        ENJ: { icon: 'E', color: '#624DBF', name: 'Enjin Coin' },
        ZRX: { icon: 'Z', color: '#302C2C', name: '0x' },
        ETC: { icon: 'Ξ', color: '#328332', name: 'Ethereum Classic' },
        VET: { icon: '⚡', color: '#15BDFF', name: 'VeChain' },
        ALGO: { icon: '△', color: '#000000', name: 'Algorand' },
        TRON: { icon: '◉', color: '#FF060A', name: 'TRON' },
        FTM: { icon: '👻', color: '#1969FF', name: 'Fantom' },
        NEAR: { icon: '🌐', color: '#00C08B', name: 'NEAR Protocol' },
        PBVAONFR: { icon: '🔒', color: '#FF6B35', name: 'Coinbase Vault' }
      };
      
      const portfolioData = [];
      let totalValue = 0;
      let holdingsCount = 0;
      const filteringLog = [];
      
      Object.entries(portfolio || {}).forEach(([currency, amount]) => {
        const minAmount = (currency === 'USD' || currency === 'USDC') ? 0.001 : 0.0000001;
        const passesFilter = amount > minAmount;
        
        filteringLog.push({
          currency,
          amount,
          minAmount,
          passesFilter,
          hasInfo: !!cryptoInfo[currency]
        });
        
        if (passesFilter) {
          const info = cryptoInfo[currency] || { icon: '❓', color: '#6B7280', name: currency };
          
          let priceSymbol = currency;
          if (currency === 'POLY') {
            priceSymbol = 'MATIC';
          } else if (currency === 'ETH2') {
            priceSymbol = 'ETH';
          }
          
          let value;
          let price = 1;
          
          if (currency === 'USD' || currency === 'USDC') {
            value = amount;
            price = 1;
          } else {
            const productId = `${priceSymbol}-USD`;
            price = allPrices?.[productId] || 0;
            value = amount * price;
          }
          
          holdingsCount++;
          totalValue += value;
          portfolioData.push({
            currency,
            amount,
            value,
            price,
            priceSymbol,
            productId: currency === 'USD' || currency === 'USDC' ? 'N/A' : `${priceSymbol}-USD`
          });
        }
      });
      
      res.json({
        holdingsCount,
        totalValue,
        portfolioData,
        filteringLog,
        allPrices,
        timestamp: new Date().toISOString()
      });
    });

    // Serve frontend for all other routes
    this.app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, '../frontend/dist/index.html'));
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      logger.info(`[SOCKET] Client connected: ${socket.id}`);
      
      socket.on('disconnect', () => {
        logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
      });
    });
  }

  async subscribeToPortfolioCryptos() {
    try {
      const portfolio = this.tradingEngine.getPortfolio();
      const productIds = [];
      
      // Define crypto metadata mapping
      const cryptoMap = {
        'BTC': 'BTC-USD',
        'ETH': 'ETH-USD',
        'ETH2': 'ETH-USD', // ETH2 maps to ETH-USD
        'ADA': 'ADA-USD',
        'DOT': 'DOT-USD',
        'DOGE': 'DOGE-USD',
        'XLM': 'XLM-USD',
        'BSV': 'BSV-USD',
        'BAT': 'BAT-USD',
        'BCH': 'BCH-USD',
        'LTC': 'LTC-USD',
        'ENJ': 'ENJ-USD',
        'POLY': 'MATIC-USD', // POLY maps to MATIC-USD
        'ZRX': 'ZRX-USD',
        'ETC': 'ETC-USD',
        'USDC': 'USDC-USD'
      };
      
      // Add BTC-USD as default
      productIds.push('BTC-USD');
      
      // Add product IDs for all cryptos with non-zero balances
      Object.keys(portfolio).forEach(currency => {
        if (currency !== 'USD' && portfolio[currency] > 0 && cryptoMap[currency]) {
          const productId = cryptoMap[currency];
          if (!productIds.includes(productId)) {
            productIds.push(productId);
          }
        }
      });
      
      logger.info(`[STARTUP] Auto-subscribing to price feeds for: ${productIds.join(', ')}`);
      await this.coinbaseService.updateSubscriptions(productIds);
      
    } catch (error) {
      logger.error('Failed to auto-subscribe to portfolio cryptos:', error);
    }
  }

  async start() {
    try {
      const port = await this.findAvailablePort(this.port);
      this.port = port;
      
      // Start services
      await this.coinbaseService.initialize();
      await this.tradingEngine.initialize();
      
      // Don't auto-start strategies - let frontend control them
      // this.strategyManager.startStrategy('sma', { period: 20 });
      
      // Debug: Check if strategy was started
      logger.info(`[DEBUG] Active strategies after start: ${Array.from(this.strategyManager.activeStrategies.keys())}`);
      
      // Subscribe to price updates from Coinbase service
      this.coinbaseService.subscribe((event, data) => {
        if (event === 'price') {
          // Forward price updates to trading engine
          this.tradingEngine.handlePriceUpdate(data);
          
          // Only forward to strategies if this is the selected crypto
          if (data.productId === this.selectedCrypto) {
            const activeStrategies = this.strategyManager.activeStrategies;
            logger.info(`[DEBUG] Forwarding price to ${activeStrategies.size} strategies for ${data.productId} (selected crypto)`);
            
            for (const [name, strategy] of activeStrategies) {
              logger.info(`[DEBUG] Forwarding to strategy: ${name}`);
              if (strategy && strategy.handleMarketData) {
                strategy.handleMarketData(event, data);
              } else if (strategy && strategy.onPriceUpdate) {
                strategy.onPriceUpdate(data);
              } else {
                logger.warn(`[DEBUG] Strategy ${name} missing handleMarketData/onPriceUpdate method`);
              }
            }
          } else {
            logger.debug(`[DEBUG] Skipping strategy forwarding for ${data.productId} (not selected crypto: ${this.selectedCrypto})`);
          }
          
          // Emit to connected frontend clients
          logger.info(`[PRICE] Emitting price-update to ${this.io.engine.clientsCount} clients for ${data.productId}`);
          this.io.emit('price-update', data);
        }
      });
      
      // Start WebSocket connection for real-time price data
      await this.coinbaseService.startPriceStream();
      
      // Auto-subscribe to portfolio cryptocurrencies after WebSocket is connected
      await this.subscribeToPortfolioCryptos();
      
      // Set global reference for strategy signal emission
      global.tradingBot = this;
      
      this.server.listen(port, () => {
        logger.info(`Trading bot running on port ${port}`);
        logger.info(`Dashboard: http://localhost:${port}`);
      });
      
    } catch (error) {
      logger.error('Failed to start trading bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  const bot = new TradingBot();
  bot.start().catch(error => {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  });
}

// Export the class for use by cli.js
module.exports = TradingBot;
