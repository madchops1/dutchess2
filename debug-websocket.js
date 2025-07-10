#!/usr/bin/env node

require('dotenv').config();
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

function createJWT(apiKey, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: 'cdp',
    nbf: now,
    exp: now + 120,
    sub: apiKey,
    uri: 'GET /users/self/verify'
  };

  // Handle newline characters in the private key
  let privateKeyFormatted = privateKey;
  if (privateKeyFormatted.includes('\\n')) {
    privateKeyFormatted = privateKeyFormatted.replace(/\\n/g, '\n');
  }

  return jwt.sign(payload, privateKeyFormatted, { 
    algorithm: 'ES256',
    header: {
      kid: apiKey,
      nonce: Math.random().toString(36)
    }
  });
}

console.log('🔍 Testing Coinbase WebSocket Raw Messages...\n');

const apiKey = process.env.COINBASE_API_KEY;
const privateKey = process.env.COINBASE_PRIVATE_KEY;

if (!apiKey || !privateKey) {
  console.error('❌ Missing API credentials');
  process.exit(1);
}

const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

ws.on('open', () => {
  console.log('✅ WebSocket connected to Coinbase Pro');
  
  // Try Coinbase Pro format
  const subscribeMessage = {
    type: 'subscribe',
    product_ids: ['BTC-USD'],
    channels: ['ticker']
  };
  
  console.log('📡 Sending subscription:', JSON.stringify(subscribeMessage));
  ws.send(JSON.stringify(subscribeMessage));
  
  console.log('⏳ Waiting for messages...');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('📨 RAW MESSAGE:', JSON.stringify(message, null, 2));
  
  if (message.type === 'ticker' && message.product_id === 'BTC-USD') {
    console.log(`🚀 BITCOIN PRICE: $${message.price}`);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
  process.exit(0);
});

// Auto-close after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test complete, closing connection...');
  ws.close();
}, 10000);
