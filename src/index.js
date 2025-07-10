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
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    
    // Pass Socket.IO instance to trading engine for real-time updates
    this.tradingEngine.setSocketIO(this.io);
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

    this.app.post('/strategy/start', (req, res) => {
      const { strategyName, parameters } = req.body;
      try {
        this.strategyManager.startStrategy(strategyName, parameters);
        res.json({ success: true, message: `Strategy ${strategyName} started` });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.post('/strategy/stop', (req, res) => {
      const { strategyName } = req.body;
      try {
        this.strategyManager.stopStrategy(strategyName);
        res.json({ success: true, message: `Strategy ${strategyName} stopped` });
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

  async start() {
    try {
      const port = await this.findAvailablePort(this.port);
      this.port = port;
      
      // Start services
      await this.coinbaseService.initialize();
      await this.tradingEngine.initialize();
      
      // Start and register strategies
      this.strategyManager.startStrategy('sma', { period: 20 });
      
      // Debug: Check if strategy was started
      logger.info(`[DEBUG] Active strategies after start: ${Array.from(this.strategyManager.activeStrategies.keys())}`);
      
      // Subscribe to price updates from Coinbase service
      this.coinbaseService.subscribe((event, data) => {
        if (event === 'price') {
          // Forward price updates to trading engine
          this.tradingEngine.handlePriceUpdate(data);
          
          // Forward to all active strategies
          const activeStrategies = this.strategyManager.activeStrategies;
          logger.info(`[DEBUG] Forwarding price to ${activeStrategies.size} strategies for ${data.productId}`);
          
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
          
          // Emit to connected frontend clients
          logger.info(`[PRICE] Emitting price-update to ${this.io.engine.clientsCount} clients for ${data.productId}`);
          this.io.emit('price-update', data);
        }
      });
      
      // Start WebSocket connection for real-time price data
      await this.coinbaseService.startPriceStream();
      
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
