const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class CoinbaseService {
  constructor() {
    this.apiKey = process.env.COINBASE_API_KEY;
    this.privateKey = process.env.COINBASE_PRIVATE_KEY;
    this.baseUrl = process.env.API_BASE_URL || 'https://api.coinbase.com/v2';
    this.advancedTradeUrl = 'https://api.coinbase.com/api/v3/brokerage';
    this.websocketUrl = process.env.WEBSOCKET_URL || 'wss://ws-feed.exchange.coinbase.com';
    
    this.ws = null;
    this.lastPrices = new Map(); // Store prices for multiple cryptocurrencies
    this.priceHistories = new Map(); // Store price histories for multiple cryptocurrencies
    this.subscribers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribedProducts = ['BTC-USD']; // Default to BTC-USD
  }

  async initialize() {
    // Always use real API - no demo mode
    if (!this.apiKey || !this.privateKey) {
      throw new Error('Coinbase API credentials are required. Please set COINBASE_API_KEY and COINBASE_PRIVATE_KEY in your .env file');
    }
    
    // Test API connection
    try {
      await this.getAccounts();
      logger.info('Coinbase Advanced Trade API connection established');
    } catch (error) {
      logger.error('Failed to connect to Coinbase API:', error);
      throw error;
    }
  }

  // Authentication helper for Advanced Trade API
  createJWT(requestMethod, requestPath, body = '') {
    if (!this.privateKey || !this.apiKey) {
      throw new Error('API credentials not configured');
    }

    const algorithm = 'ES256';
    const uri = requestMethod + ' ' + 'api.coinbase.com' + requestPath;
    
    const payload = {
      iss: "coinbase-cloud",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
      sub: this.apiKey,
      uri: uri
    };

    // Create private key object
    let privateKeyFormatted = this.privateKey;
    
    // Handle newline characters in the private key
    if (privateKeyFormatted.includes('\\n')) {
      privateKeyFormatted = privateKeyFormatted.replace(/\\n/g, '\n');
    }
    
    if (!privateKeyFormatted.includes('-----BEGIN')) {
      privateKeyFormatted = `-----BEGIN EC PRIVATE KEY-----\n${privateKeyFormatted}\n-----END EC PRIVATE KEY-----`;
    }

    const token = jwt.sign(payload, privateKeyFormatted, { 
      algorithm: algorithm,
      header: {
        kid: this.apiKey,
        nonce: Math.random().toString(36)
      }
    });

    return token;
  }

  // Get authenticated headers for Advanced Trade API
  getAuthHeaders(method, requestPath, body = '') {
    try {
      const jwt = this.createJWT(method.toUpperCase(), requestPath, body);
      
      return {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      logger.error('Error creating auth headers:', error);
      throw error;
    }
  }

  // API Methods
  async getPublicTicker(productId = 'BTC-USD') {
    try {
      // Use public API for market data
      const response = await axios.get(`https://api.exchange.coinbase.com/products/${productId}/ticker`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching public ticker:', error);
      throw error;
    }
  }

  async getAccounts() {
    try {
      const response = await axios.get(`${this.advancedTradeUrl}/accounts`, {
        headers: this.getAuthHeaders('GET', '/api/v3/brokerage/accounts')
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching accounts:', error);
      throw error;
    }
  }

  async getAccount(accountId) {
    try {
      const response = await axios.get(`${this.advancedTradeUrl}/accounts/${accountId}`, {
        headers: this.getAuthHeaders('GET', `/api/v3/brokerage/accounts/${accountId}`)
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching account:', error);
      throw error;
    }
  }

  async placeBuyOrder(productId, amount, price = null) {
    const orderConfig = {
      client_order_id: crypto.randomUUID(),
      product_id: productId,
      side: 'BUY',
      order_configuration: {}
    };

    if (price) {
      // Limit order
      orderConfig.order_configuration.limit_limit_gtc = {
        base_size: amount.toString(),
        limit_price: price.toString()
      };
    } else {
      // Market order
      orderConfig.order_configuration.market_market_ioc = {
        base_size: amount.toString()
      };
    }

    try {
      const response = await axios.post(
        `${this.advancedTradeUrl}/orders`,
        orderConfig,
        {
          headers: this.getAuthHeaders('POST', '/api/v3/brokerage/orders', JSON.stringify(orderConfig))
        }
      );
      logger.info('Buy order placed:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Error placing buy order:', error);
      throw error;
    }
  }

  async placeSellOrder(productId, amount, price = null) {
    const orderConfig = {
      client_order_id: crypto.randomUUID(),
      product_id: productId,
      side: 'SELL',
      order_configuration: {}
    };

    if (price) {
      // Limit order
      orderConfig.order_configuration.limit_limit_gtc = {
        base_size: amount.toString(),
        limit_price: price.toString()
      };
    } else {
      // Market order
      orderConfig.order_configuration.market_market_ioc = {
        base_size: amount.toString()
      };
    }

    try {
      const response = await axios.post(
        `${this.advancedTradeUrl}/orders`,
        orderConfig,
        {
          headers: this.getAuthHeaders('POST', '/api/v3/brokerage/orders', JSON.stringify(orderConfig))
        }
      );
      logger.info('Sell order placed:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Error placing sell order:', error);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    if (this.demoMode) {
      logger.info('Demo order cancelled:', orderId);
      return { success: true };
    }

    try {
      const response = await axios.post(
        `${this.advancedTradeUrl}/orders/batch_cancel`,
        { order_ids: [orderId] },
        {
          headers: this.getAuthHeaders('POST', '/api/v3/brokerage/orders/batch_cancel', JSON.stringify({ order_ids: [orderId] }))
        }
      );
      logger.info('Order cancelled:', orderId);
      return response.data;
    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }

  async getOrders(productId = null, status = 'OPEN') {
    if (this.demoMode) {
      return { orders: [] };
    }

    let params = `?order_status=${status}`;
    if (productId) {
      params += `&product_id=${productId}`;
    }

    try {
      const response = await axios.get(`${this.advancedTradeUrl}/orders/historical/batch${params}`, {
        headers: this.getAuthHeaders('GET', `/api/v3/brokerage/orders/historical/batch${params}`)
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  // WebSocket Methods
  async startPriceStream(productIds = ['BTC-USD']) {
    logger.info(`[WS] Starting price stream for products: ${productIds.join(', ')}`);
    
    // Close existing connection if any
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info('[WS] Closing existing WebSocket connection...');
      this.ws.close();
    }
    
    this.subscribedProducts = productIds;
    
    return new Promise((resolve, reject) => {
      try {
        logger.info('[WS] Creating new WebSocket connection...');
        this.ws = new WebSocket(this.websocketUrl);

        this.ws.on('open', () => {
          logger.info('Coinbase Exchange WebSocket connection opened');
          
          // Subscribe to ticker channel (using Exchange API format)
          const subscribeMessage = {
            type: 'subscribe',
            product_ids: productIds,
            channels: ['ticker']
          };

          this.ws.send(JSON.stringify(subscribeMessage));
          logger.info('Sent subscription:', JSON.stringify(subscribeMessage));
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            logger.debug('WebSocket message received:', JSON.stringify(message));
            if (message.type === 'ticker') {
              logger.debug(`[WS] Processing ticker for ${message.product_id}: ${message.price}`);
            }
            this.handleWebSocketMessage(message);
          } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
          }
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          logger.warn('Exchange WebSocket connection closed');
          this.handleReconnect();
        });

      } catch (error) {
        logger.error('Error starting price stream:', error);
        reject(error);
      }
    });
  }

  handleWebSocketMessage(message) {
    logger.debug('Processing message with type:', message.type);
    
    switch (message.type) {
      case 'ticker':
        // Handle Exchange API ticker format
        this.handleExchangeTickerMessage(message);
        break;
      case 'subscriptions':
        logger.info('WebSocket subscriptions confirmed:', message);
        break;
      case 'level2':
        this.handleLevel2Message(message);
        break;
      case 'match':
        this.handleMatchMessage(message);
        break;
      default:
        logger.debug('Unhandled message type:', message.type || 'unknown');
        break;
    }
  }

  handleExchangeTickerMessage(message) {
    // Handle Coinbase Exchange API ticker format
    if (message.product_id && message.price) {
      const price = parseFloat(message.price);
      const productId = message.product_id;
      
      logger.info(`Real-time price update: ${productId} - $${price.toFixed(2)}`);
      
      // Store price for this product
      this.lastPrices.set(productId, price);
      
      // Initialize price history if not exists
      if (!this.priceHistories.has(productId)) {
        this.priceHistories.set(productId, []);
      }
      
      const priceHistory = this.priceHistories.get(productId);
      priceHistory.push({
        price,
        timestamp: new Date(message.time || Date.now()),
        volume: parseFloat(message.volume_24h || 0)
      });

      // Keep only last 1000 price points
      if (priceHistory.length > 1000) {
        priceHistory.shift();
      }

      // Notify subscribers
      this.notifySubscribers('price', { 
        price, 
        productId, 
        timestamp: new Date(message.time || Date.now()) 
      });
    }
  }

  handleMatchMessage(message) {
    // Handle Exchange API match format
    const tradeData = {
      price: parseFloat(message.price),
      size: parseFloat(message.size),
      side: message.side.toLowerCase(),
      productId: message.product_id,
      timestamp: new Date(message.time)
    };

    this.notifySubscribers('trade', tradeData);
  }

  handleLevel2Message(message) {
    // Handle order book updates
    this.notifySubscribers('orderbook', message);
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.startPriceStream().catch(error => {
          logger.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  // Subscription system
  subscribe(callback) {
    this.subscribers.add(callback);
    logger.info(`[COINBASE] Subscriber added. Total subscribers: ${this.subscribers.size}`);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(event, data) {
    if (event === 'price' && Math.random() < 0.01) { // Log only 1% to avoid spam
      logger.info(`[COINBASE] Notifying ${this.subscribers.size} subscribers about ${event} for ${data.productId}`);
    }
    this.subscribers.forEach(callback => {
      try {
        if (typeof callback !== 'function') {
          logger.error(`[COINBASE] Invalid subscriber detected: ${typeof callback}`, callback);
          this.subscribers.delete(callback); // Remove invalid subscriber
          return;
        }
        callback(event, data);
      } catch (error) {
        logger.error('Error in subscriber callback:', error);
      }
    });
  }

  // Utility methods
  getLastPrice(productId = 'BTC-USD') {
    return this.lastPrices.get(productId) || null;
  }

  getPriceHistory(productId = 'BTC-USD', limit = 100) {
    const history = this.priceHistories.get(productId) || [];
    return history.slice(-limit);
  }

  getAllPrices() {
    const prices = {};
    this.lastPrices.forEach((price, productId) => {
      prices[productId] = price;
    });
    return prices;
  }

  // Add method to update subscriptions
  async updateSubscriptions(productIds) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket not connected, cannot update subscriptions');
      return;
    }

    // Unsubscribe from current products
    if (this.subscribedProducts.length > 0) {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        product_ids: this.subscribedProducts,
        channels: ['ticker']
      };
      this.ws.send(JSON.stringify(unsubscribeMessage));
    }

    // Subscribe to new products
    const subscribeMessage = {
      type: 'subscribe',
      product_ids: productIds,
      channels: ['ticker']
    };
    this.ws.send(JSON.stringify(subscribeMessage));
    
    this.subscribedProducts = productIds;
    logger.info(`Updated subscriptions to: ${productIds.join(', ')}`);
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = CoinbaseService;
