const logger = require('../utils/logger');
const SimpleMovingAverageStrategy = require('../strategies/simpleMovingAverage');
const RSIStrategy = require('../strategies/rsiStrategy');
const MACDStrategy = require('../strategies/macdStrategy');

class StrategyManager {
  constructor() {
    this.strategies = new Map();
    this.activeStrategies = new Map();
    this.registeredStrategies = new Map();
    
    // Register built-in strategies
    this.registerStrategy('sma', SimpleMovingAverageStrategy);
    this.registerStrategy('rsi', RSIStrategy);
    this.registerStrategy('macd', MACDStrategy);
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
    this.activeStrategies.set(strategyName, strategy);
    await strategy.start();
    logger.info(`Strategy started: ${strategyName}`);
    return strategy;
  }

  stopStrategy(strategyName) {
    if (!this.activeStrategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' is not running`);
    }

    const strategy = this.activeStrategies.get(strategyName);
    strategy.stop();
    this.activeStrategies.delete(strategyName);
    
    logger.info(`Strategy stopped: ${strategyName}`);
  }

  stopAllStrategies() {
    for (const [name, strategy] of this.activeStrategies) {
      strategy.stop();
      logger.info(`Strategy stopped: ${name}`);
    }
    this.activeStrategies.clear();
  }

  getActiveStrategies() {
    return Array.from(this.activeStrategies.keys());
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
}

module.exports = StrategyManager;
