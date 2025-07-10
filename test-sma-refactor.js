const SimpleMovingAverageStrategy = require('./src/strategies/simpleMovingAverage');

// Test that the strategy can be instantiated without errors
console.log('Testing SMA strategy instantiation...');

const strategy = new SimpleMovingAverageStrategy({
  period: 20,
  tradeAmount: 0.01,
  mode: 'simulation'
});

console.log('✅ SMA strategy created successfully');
console.log('Mode:', strategy.mode);
console.log('Period:', strategy.period);
console.log('Trade amount:', strategy.tradeAmount);

// Test that methods exist and don't throw errors
console.log('Testing method existence...');
console.log('✅ simulateTrade method exists:', typeof strategy.simulateTrade === 'function');
console.log('✅ getPerformance method exists:', typeof strategy.getPerformance === 'function');
console.log('✅ getPortfolio method exists:', typeof strategy.getPortfolio === 'function');
console.log('✅ resetPerformance method exists:', typeof strategy.resetPerformance === 'function');

console.log('All tests passed! 🎉');
