#!/usr/bin/env node

require('dotenv').config();
const CoinbaseService = require('./src/services/coinbaseService');
const logger = require('./src/utils/logger');

async function testRealTimeData() {
  console.log('🔥 Testing REAL-TIME Coinbase data...\n');
  
  const coinbaseService = new CoinbaseService();
  
  // Subscribe to price updates
  coinbaseService.subscribe((event, data) => {
    if (event === 'price') {
      console.log(`🚀 REAL PRICE: $${data.price.toFixed(2)} at ${data.timestamp.toISOString()}`);
    }
  });
  
  try {
    // Initialize (this should connect to real API)
    console.log('🔌 Connecting to Coinbase Advanced Trade API...');
    await coinbaseService.initialize();
    
    console.log('📡 Starting real-time WebSocket...');
    await coinbaseService.startPriceStream();
    
    console.log(`💰 Current price: $${coinbaseService.getLastPrice()?.toFixed(2) || 'Loading...'}`);
    console.log('📊 Watching for REAL price updates...\n');
    
    // Wait for real updates
    setTimeout(() => {
      console.log(`\n✅ Final price: $${coinbaseService.getLastPrice()?.toFixed(2) || 'N/A'}`);
      console.log('📜 Price history length:', coinbaseService.getPriceHistory().length);
      coinbaseService.disconnect();
      console.log('\n🎉 Real-time test complete!');
      process.exit(0);
    }, 15000); // Wait 15 seconds for real data
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testRealTimeData().catch(console.error);
