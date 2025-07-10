#!/usr/bin/env node

require('dotenv').config();
const CoinbaseService = require('./src/services/coinbaseService');
const StrategyManager = require('./src/services/strategyManager');
const logger = require('./src/utils/logger');

async function testSMASignals() {
  console.log('🧪 Testing SMA signal generation...\n');
  
  const coinbaseService = new CoinbaseService();
  const strategyManager = new StrategyManager();
  
  try {
    // Start SMA strategy
    await strategyManager.startStrategy('sma', { period: 5 }); // Shorter period for faster testing
    console.log('✅ SMA strategy started with 5-period');
    
    // Mock price data that will create crossovers
    const basePrice = 50000;
    const testPrices = [
      basePrice - 100, // Below SMA
      basePrice - 50,
      basePrice,
      basePrice + 50,
      basePrice + 100,  // Above SMA - should trigger BUY signal
      basePrice + 150,
      basePrice + 100,
      basePrice + 50,
      basePrice,
      basePrice - 50,   // Below SMA - should trigger SELL signal
      basePrice - 100
    ];
    
    console.log('📊 Feeding test price data...');
    
    for (let i = 0; i < testPrices.length; i++) {
      const price = testPrices[i];
      const priceData = {
        price: price,
        product_id: 'BTC-USD',
        timestamp: new Date(),
        volume: 1.0
      };
      
      console.log(`Price ${i + 1}: $${price.toFixed(2)}`);
      
      // Get the strategy and feed it data
      const strategy = strategyManager.getStrategy('sma');
      if (strategy) {
        strategy.onPriceUpdate(priceData);
        
        // Check indicators
        const indicators = strategy.getIndicators();
        console.log(`  SMA: ${indicators.sma ? indicators.sma.toFixed(2) : 'N/A'}, Position: ${indicators.position}`);
        
        // Check for new signals
        const signals = strategy.getSignals();
        if (signals.length > 0) {
          const lastSignal = signals[signals.length - 1];
          console.log(`  🚨 SIGNAL: ${lastSignal.type.toUpperCase()} at $${lastSignal.data.price.toFixed(2)}`);
        }
      }
      
      // Wait a bit between prices
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final report
    const strategy = strategyManager.getStrategy('sma');
    const allSignals = strategy.getSignals();
    console.log(`\n📈 Total signals generated: ${allSignals.length}`);
    allSignals.forEach((signal, i) => {
      console.log(`  ${i + 1}. ${signal.type.toUpperCase()} at $${signal.data.price.toFixed(2)} - ${signal.data.reason}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

testSMASignals().catch(console.error);
