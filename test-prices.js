#!/usr/bin/env node

const CoinbaseService = require('./src/services/coinbaseService');
const logger = require('./src/utils/logger');

async function testPriceUpdates() {
  console.log('🧪 Testing price updates...\n');
  
  const coinbaseService = new CoinbaseService();
  
  // Subscribe to price updates
  coinbaseService.subscribe((event, data) => {
    if (event === 'price') {
      console.log(`📈 Price Update: $${data.price.toFixed(2)} at ${data.timestamp.toISOString()}`);
    }
  });
  
  // Initialize (this should start mock updates in demo mode)
  await coinbaseService.initialize();
  await coinbaseService.startPriceStream();
  
  console.log(`🔄 Initial price: $${coinbaseService.getLastPrice()?.toFixed(2) || 'N/A'}`);
  console.log('📊 Watching for price updates...\n');
  
  // Wait for updates
  setTimeout(() => {
    console.log(`\n✅ Final price: $${coinbaseService.getLastPrice()?.toFixed(2) || 'N/A'}`);
    console.log('📜 Price history length:', coinbaseService.getPriceHistory().length);
    coinbaseService.disconnect();
    console.log('\n🏁 Test complete!');
    process.exit(0);
  }, 10000);
}

testPriceUpdates().catch(console.error);
