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

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
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
      const port = this.port;
      
      // Start services
      await this.coinbaseService.initialize();
      await this.tradingEngine.initialize();
      
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

// Start the bot
const bot = new TradingBot();
bot.start().catch(error => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});
