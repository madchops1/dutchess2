#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🔍 Testing Coinbase WebSocket connections...\n');

// Test different WebSocket endpoints
const endpoints = [
  'wss://advanced-trade-ws.coinbase.com',
  'wss://ws-feed.exchange.coinbase.com',
  'wss://ws-feed.pro.coinbase.com'
];

async function testWebSocket(url, subscribeMessage) {
  return new Promise((resolve, reject) => {
    console.log(`Testing: ${url}`);
    
    const ws = new WebSocket(url);
    let messageCount = 0;
    const timeout = setTimeout(() => {
      console.log(`❌ ${url} - No messages received in 10 seconds`);
      ws.close();
      resolve({ url, success: false, messages: 0 });
    }, 10000);

    ws.on('open', () => {
      console.log(`✅ ${url} - Connection opened`);
      ws.send(JSON.stringify(subscribeMessage));
      console.log(`📤 ${url} - Subscription sent:`, JSON.stringify(subscribeMessage));
    });

    ws.on('message', (data) => {
      messageCount++;
      try {
        const message = JSON.parse(data);
        console.log(`📥 ${url} - Message ${messageCount}:`, JSON.stringify(message, null, 2));
        
        if (messageCount >= 3) {
          clearTimeout(timeout);
          console.log(`✅ ${url} - Received ${messageCount} messages, closing connection`);
          ws.close();
          resolve({ url, success: true, messages: messageCount });
        }
      } catch (error) {
        console.log(`❌ ${url} - Error parsing message:`, error);
      }
    });

    ws.on('error', (error) => {
      console.log(`❌ ${url} - WebSocket error:`, error.message);
      clearTimeout(timeout);
      resolve({ url, success: false, error: error.message });
    });

    ws.on('close', () => {
      console.log(`🔌 ${url} - Connection closed`);
      clearTimeout(timeout);
      if (messageCount === 0) {
        resolve({ url, success: false, messages: 0 });
      }
    });
  });
}

async function testAllEndpoints() {
  console.log('🚀 Starting WebSocket tests...\n');
  
  // Test Advanced Trade API
  console.log('=== Testing Advanced Trade API ===');
  const advancedResult = await testWebSocket(endpoints[0], {
    type: 'subscribe',
    product_ids: ['BTC-USD'],
    channel: 'ticker'
  });
  
  console.log('\n=== Testing Exchange API (legacy) ===');
  const exchangeResult = await testWebSocket(endpoints[1], {
    type: 'subscribe',
    product_ids: ['BTC-USD'],
    channels: ['ticker']
  });
  
  console.log('\n=== Testing Pro API (legacy) ===');
  const proResult = await testWebSocket(endpoints[2], {
    type: 'subscribe',
    product_ids: ['BTC-USD'],
    channels: ['ticker']
  });
  
  console.log('\n📊 Results Summary:');
  console.log('Advanced Trade:', advancedResult.success ? `✅ ${advancedResult.messages} messages` : '❌ Failed');
  console.log('Exchange API:', exchangeResult.success ? `✅ ${exchangeResult.messages} messages` : '❌ Failed');
  console.log('Pro API:', proResult.success ? `✅ ${proResult.messages} messages` : '❌ Failed');
  
  process.exit(0);
}

testAllEndpoints().catch(console.error);
