# Quick Start Guide

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Configuration
```bash
cp .env.example .env
# Edit .env with your Coinbase API credentials:
# COINBASE_API_KEY=your_api_key_name
# COINBASE_PRIVATE_KEY=your_private_key
```

**To get Coinbase API credentials:**
1. Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/projects)
2. Create a new project and API key
3. Download the key file and copy the values to your `.env`

### 3. Run in Demo Mode (No Real Trading)
```bash
npm run demo
```

### 4. Start with Real Trading (Requires API Keys)
```bash
npm start
```

## 🎮 Using the Web Dashboard

### Start with Frontend Dashboard
```bash
# Build and start with web dashboard
npm run start:with-frontend

# Or build first, then start
npm run build
npm run demo
```

### Frontend Features
- **📈 Real-time Price Chart** - Live Bitcoin price with historical data
- **💰 Portfolio Overview** - Your BTC/USD balances with visual breakdown  
- **⚙️ Strategy Controls** - Start/stop strategies with parameter tuning
- **📊 Live Activity Logs** - Real-time system and trading logs
- **🔌 Connection Status** - Monitor bot health and connectivity

The dashboard will be available at: **http://localhost:3000**

### Frontend Development
```bash
# Start backend in demo mode
npm run demo

# In another terminal, start frontend dev server
npm run dev:frontend
# Frontend dev server runs on http://localhost:3001
```

## 🔧 Troubleshooting

### Port Conflicts (EADDRINUSE Error)
If you see "address already in use" errors:

1. **Clean up processes automatically:**
   ```bash
   npm run cleanup:3000
   ```

2. **Manual cleanup:**
   ```bash
   # Find processes using port 3000
   lsof -ti :3000
   
   # Kill them
   lsof -ti :3000 | xargs kill -9
   ```

3. **The bot will automatically find an available port** if 3000 is in use, so you should see a message like:
   ```
   Trading bot server running on port 3001
   ```

### Demo Mode Issues
- The bot automatically switches to demo mode if API credentials are missing or invalid
- Demo mode uses mock data and doesn't make real trades
- WebSocket connections for market data should still work in demo mode

## 📊 API Endpoints

Once running, the bot exposes these endpoints on `http://localhost:3000`:

- `GET /` - Bot status
- `GET /status` - Detailed status with active strategies
- `POST /strategy/start` - Start a strategy
- `POST /strategy/stop` - Stop a strategy

## 🔧 Start a Strategy

### Simple Moving Average
```bash
curl -X POST http://localhost:3000/strategy/start \
  -H "Content-Type: application/json" \
  -d '{
    "strategyName": "sma",
    "parameters": {
      "shortPeriod": 10,
      "longPeriod": 30,
      "autoTrade": false,
      "tradeAmount": 0.01
    }
  }'
```

### RSI Strategy
```bash
curl -X POST http://localhost:3000/strategy/start \
  -H "Content-Type: application/json" \
  -d '{
    "strategyName": "rsi",
    "parameters": {
      "period": 14,
      "oversoldThreshold": 30,
      "overboughtThreshold": 70,
      "autoTrade": false,
      "tradeAmount": 0.01
    }
  }'
```

### MACD Strategy
```bash
curl -X POST http://localhost:3000/strategy/start \
  -H "Content-Type: application/json" \
  -d '{
    "strategyName": "macd",
    "parameters": {
      "fastPeriod": 12,
      "slowPeriod": 26,
      "signalPeriod": 9,
      "autoTrade": false,
      "tradeAmount": 0.01
    }
  }'
```

## ⚠️ Important Notes

- **Demo Mode**: Set `autoTrade: false` to generate signals without executing trades
- **API Keys**: Without real Coinbase API credentials, the bot runs in demo mode
- **Risk Management**: Built-in position limits and daily loss limits
- **Logging**: Check `logs/` directory for detailed logs

## 🧪 Testing
```bash
npm test        # Run tests
npm run lint    # Check code style
```

## 📁 Key Files

- `src/index.js` - Main application
- `src/services/coinbaseService.js` - Coinbase API integration
- `src/services/tradingEngine.js` - Order execution
- `src/strategies/` - Trading strategies
- `.env` - Configuration (copy from `.env.example`)

## 🛡️ Safety

This bot includes safety features:
- Demo mode for testing
- Position size limits
- Daily loss limits
- Comprehensive logging
- Error handling and reconnection

**Always test thoroughly before using real funds!**
