#!/usr/bin/env node

const WebSocket = require('ws');

console.log('🔍 Testing Coinbase WebSocket for real-time prices...\n');

function testCoinbaseWebSocket() {
  // Try the legacy Coinbase Pro WebSocket which has been more reliable
  const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
  
  ws.on('open', function open() {
    console.log('✅ Connected to Coinbase WebSocket');
    
    // Subscribe to BTC-USD ticker
    const subscribeMessage = {
      type: 'subscribe',
      product_ids: ['BTC-USD'],
      channels: ['ticker']
    };
    
    ws.send(JSON.stringify(subscribeMessage));
    console.log('📤 Sent subscription:', JSON.stringify(subscribeMessage));
  });

  ws.on('message', function message(data) {
    try {
      const msg = JSON.parse(data);
      console.log('📥 Received:', msg);
      
      if (msg.type === 'ticker' && msg.product_id === 'BTC-USD') {
        console.log(`💰 BTC Price: $${msg.price}`);
      }
    } catch (error) {
      console.log('❌ Error parsing message:', error.message);
    }
  });

  ws.on('error', function error(err) {
    console.log('❌ WebSocket error:', err.message);
  });

  ws.on('close', function close() {
    console.log('🔌 WebSocket closed');
  });
}

testCoinbaseWebSocket();
