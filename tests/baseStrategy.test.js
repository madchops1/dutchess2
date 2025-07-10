const BaseStrategy = require('../src/strategies/baseStrategy');

describe('BaseStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new BaseStrategy('Test Strategy', { testParam: true });
  });

  test('should initialize with correct properties', () => {
    expect(strategy.name).toBe('Test Strategy');
    expect(strategy.parameters.testParam).toBe(true);
    expect(strategy.isActive).toBe(false);
    expect(strategy.trades).toEqual([]);
    expect(strategy.signals).toEqual([]);
  });

  test('should track performance correctly', () => {
    const performance = strategy.getPerformance();
    
    expect(performance).toHaveProperty('strategy', 'Test Strategy');
    expect(performance).toHaveProperty('isActive', false);
    expect(performance).toHaveProperty('totalTrades', 0);
    expect(performance).toHaveProperty('totalProfit', 0);
    expect(performance).toHaveProperty('totalLoss', 0);
    expect(performance).toHaveProperty('winRate', 0);
  });

  test('should record trades correctly', () => {
    const trade = {
      type: 'buy',
      amount: 0.01,
      price: 50000,
      timestamp: new Date()
    };

    strategy.recordTrade(trade);
    expect(strategy.trades).toHaveLength(1);
    expect(strategy.trades[0]).toEqual(trade);
  });

  test('should generate signals correctly', async () => {
    const signalData = {
      reason: 'Test signal',
      price: 50000,
      confidence: 75
    };

    await strategy.generateBuySignal(signalData);
    
    expect(strategy.signals).toHaveLength(1);
    expect(strategy.signals[0].type).toBe('buy');
    expect(strategy.signals[0].data).toEqual(signalData);
    expect(strategy.lastSignal).toBeDefined();
  });
});
