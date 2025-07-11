const logger = require('../utils/logger');
const SimpleMovingAverageStrategy = require('../strategies/simpleMovingAverage');
const RSIStrategy = require('../strategies/rsiStrategy');
const MACDStrategy = require('../strategies/macdStrategy');

class StrategyManager {
  constructor() {
    this.strategies = new Map();
    this.activeStrategies = new Map();
    this.registeredStrategies = new Map();
    this.io = null; // Socket.IO instance for real-time updates
    this.tradingEngine = null; // Trading engine reference
    
    // Register built-in strategies
    this.registerStrategy('sma', SimpleMovingAverageStrategy);
    this.registerStrategy('rsi', RSIStrategy);
    this.registerStrategy('macd', MACDStrategy);
  }

  setSocketIO(io) {
    this.io = io;
  }

  setTradingEngine(tradingEngine) {
    this.tradingEngine = tradingEngine;
    logger.info(`Trading engine reference set in strategy manager`);
  }

  registerStrategy(name, StrategyClass) {
    this.registeredStrategies.set(name, StrategyClass);
    logger.info(`Strategy registered: ${name}`);
  }

  async startStrategy(strategyName, parameters = {}) {
    if (!this.registeredStrategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' not found`);
    }

    if (this.activeStrategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' is already running`);
    }

    const StrategyClass = this.registeredStrategies.get(strategyName);
    const strategy = new StrategyClass(parameters);
    
    // Inject trading engine reference if strategy supports it
    if (typeof strategy.setTradingEngine === 'function' && this.tradingEngine) {
      strategy.setTradingEngine(this.tradingEngine);
    }
    
    // Reset performance data for new session when starting a strategy
    if (this.tradingEngine) {
      this.tradingEngine.resetPerformanceData();
    }
    
    this.activeStrategies.set(strategyName, strategy);
    await strategy.start();
    logger.info(`Strategy started: ${strategyName}`);
    
    // Emit strategy status update via Socket.IO
    if (this.io) {
      this.io.emit('strategy-status', {
        action: 'started',
        strategy: strategyName,
        strategies: this.getActiveStrategies()
      });
    }
    
    return strategy;
  }

  async stopStrategy(strategyName) {
    if (!this.activeStrategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' is not running`);
    }

    const strategy = this.activeStrategies.get(strategyName);
    await strategy.stop();
    this.activeStrategies.delete(strategyName);
    
    logger.info(`Strategy stopped: ${strategyName}`);
    
    // Emit strategy status update via Socket.IO
    if (this.io) {
      this.io.emit('strategy-status', {
        action: 'stopped',
        strategy: strategyName,
        strategies: this.getActiveStrategies()
      });
    }
  }

  async stopAllStrategies() {
    for (const [name, strategy] of this.activeStrategies) {
      await strategy.stop();
      logger.info(`Strategy stopped: ${name}`);
    }
    this.activeStrategies.clear();
  }

  getActiveStrategies() {
    const allStrategies = Array.from(this.registeredStrategies.keys());
    return allStrategies.map(name => ({
      name: name,
      active: this.activeStrategies.has(name)
    }));
  }

  getStrategy(strategyName) {
    return this.activeStrategies.get(strategyName);
  }

  getAllStrategies() {
    return Array.from(this.registeredStrategies.keys());
  }

  getStrategyPerformance(strategyName) {
    const strategy = this.activeStrategies.get(strategyName);
    if (!strategy) {
      return null;
    }
    
    return strategy.getPerformance();
  }

  getAllPerformance() {
    const performance = {};
    for (const [name, strategy] of this.activeStrategies) {
      performance[name] = strategy.getPerformance();
    }
    return performance;
  }

  getSignals(strategyName) {
    const strategy = this.activeStrategies.get(strategyName);
    if (!strategy || typeof strategy.getSignals !== 'function') return [];
    return strategy.getSignals();
  }

  async updateStrategy(strategyName, parameters = {}) {
    if (!this.activeStrategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' is not running`);
    }

    const strategy = this.activeStrategies.get(strategyName);
    
    // Update strategy parameters
    if (typeof strategy.updateParameters === 'function') {
      await strategy.updateParameters(parameters);
      logger.info(`Strategy parameters updated: ${strategyName}`, parameters);
    } else {
      // Fallback: update parameters directly
      Object.assign(strategy, parameters);
      logger.info(`Strategy parameters updated (direct): ${strategyName}`, parameters);
    }
    
    // Emit strategy status update via Socket.IO
    if (this.io) {
      this.io.emit('strategy-status', {
        action: 'updated',
        strategy: strategyName,
        parameters: parameters,
        strategies: this.getActiveStrategies()
      });
    }
    
    return strategy;
  }
}

module.exports = StrategyManager;
