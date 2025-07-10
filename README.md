# DutchessAI Trading Bot

A sophisticated Bitcoin trading bot that connects to the Coinbase API for real-time price streaming and automated trading based on technical analysis strategies.

## Features

- **Real-time Market Data**: WebSocket connection to Coinbase for live Bitcoin price feeds
- **Multiple Trading Strategies**: Built-in SMA, RSI, and MACD strategies
- **Risk Management**: Configurable position sizing and daily loss limits
- **Strategy Management**: Start/stop multiple strategies simultaneously
- **Performance Tracking**: Monitor strategy performance and trade history
- **RESTful API**: Web interface for bot control and monitoring
- **Comprehensive Logging**: Detailed logging for trades, strategies, and market data

## Project Structure

```
dutchess/
├── src/
│   ├── index.js                 # Main application entry point
│   ├── services/
│   │   ├── coinbaseService.js   # Coinbase API integration
│   │   ├── tradingEngine.js     # Order execution and risk management
│   │   └── strategyManager.js   # Strategy lifecycle management
│   ├── strategies/
│   │   ├── baseStrategy.js      # Base strategy class
│   │   ├── simpleMovingAverage.js
│   │   ├── rsiStrategy.js
│   │   └── macdStrategy.js
│   └── utils/
│       ├── logger.js            # Winston logging configuration
│       ├── technicalIndicators.js
│       └── marketAnalyzer.js
├── logs/                        # Log files
├── package.json
├── .env.example
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure your Coinbase API credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Coinbase API credentials:

```env
COINBASE_API_KEY=your_api_key_here
COINBASE_API_SECRET=your_api_secret_here
COINBASE_API_PASSPHRASE=your_passphrase_here
```

### 3. Get Coinbase API Credentials

1. Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/projects)
2. Create a new project or select an existing one
3. Create a new API key with the following permissions:
   - View
   - Trade
4. Download the API key file - it will contain:
   - `name`: Your API key name
   - `privateKey`: Your private key (keep this secure!)
5. Add these to your `.env` file:
   ```env
   COINBASE_API_KEY=your_api_key_name_here
   COINBASE_PRIVATE_KEY=your_private_key_here
   ```

## Usage

### Start the Bot

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

### API Endpoints

The bot exposes a REST API on port 3000 (configurable):

- `GET /` - Bot status and info
- `GET /status` - Detailed bot status including active strategies
- `POST /strategy/start` - Start a trading strategy
- `POST /strategy/stop` - Stop a trading strategy

### Starting a Strategy

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

### Available Strategies

1. **Simple Moving Average (sma)**
   - Parameters: `shortPeriod`, `longPeriod`, `autoTrade`, `tradeAmount`
   - Generates buy signals on golden cross, sell signals on death cross

2. **RSI Strategy (rsi)**
   - Parameters: `period`, `oversoldThreshold`, `overboughtThreshold`, `autoTrade`, `tradeAmount`
   - Generates buy signals when oversold, sell signals when overbought

3. **MACD Strategy (macd)**
   - Parameters: `fastPeriod`, `slowPeriod`, `signalPeriod`, `autoTrade`, `tradeAmount`
   - Generates signals on MACD line crossovers with signal line

## Configuration

### Environment Variables

- `COINBASE_API_KEY` - Your Coinbase API key name
- `COINBASE_PRIVATE_KEY` - Your Coinbase private key (keep secure!)
- `DEFAULT_TRADE_AMOUNT` - Default trade size (0.01 BTC)
- `RISK_TOLERANCE` - Risk tolerance as decimal (0.05 = 5%)
- `MAX_POSITION_SIZE` - Maximum position size in USD (1000)
- `LOG_LEVEL` - Logging level (info, debug, error)
- `PORT` - API server port (3000)

### Risk Management

The bot includes built-in risk management:

- **Position Size Limits**: Maximum position size per trade
- **Daily Loss Limits**: Stop trading after daily loss threshold
- **Balance Checks**: Verify sufficient funds before placing orders

## Development

### Adding New Strategies

1. Create a new strategy class extending `BaseStrategy`:

```javascript
const BaseStrategy = require('./baseStrategy');

class MyStrategy extends BaseStrategy {
  constructor(parameters = {}) {
    super('My Strategy', parameters);
    // Initialize strategy-specific properties
  }

  onPriceUpdate(data) {
    // Implement your strategy logic
    // Call this.generateBuySignal() or this.generateSellSignal()
  }
}

module.exports = MyStrategy;
```

2. Register the strategy in `StrategyManager`:

```javascript
this.registerStrategy('mystrategy', MyStrategy);
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Logging

The bot provides comprehensive logging:

- `logs/combined.log` - All log messages
- `logs/error.log` - Error messages only
- `logs/trading.log` - Trading-specific logs
- `logs/trades.log` - Individual trade records
- `logs/strategies.log` - Strategy lifecycle events
- `logs/market-data.log` - Market data events (debug level)

## Security Notes

- Never commit your `.env` file with real API credentials
- Use API keys with minimal required permissions
- Consider using sandbox/test environment first
- Monitor your bot's activity regularly
- Set appropriate risk limits

## Disclaimer

This trading bot is for educational and research purposes. Cryptocurrency trading involves significant risk of loss. Use at your own risk and never trade with funds you cannot afford to lose.

## License

MIT License - see LICENSE file for details.

## 📊 Frontend Dashboard

The trading bot now includes a modern web dashboard with:

- **Real-time Bitcoin price chart** - Live price updates and historical data
- **Portfolio overview** - Your BTC and USD balances with pie chart
- **Strategy controls** - Start/stop trading strategies with customizable parameters
- **Live activity logs** - System logs and trading activity in real-time
- **Connection status** - Monitor bot connectivity and health

### 🚀 Running with Frontend

```bash
# Build and start with frontend
npm run start:full

# Or run separately:
# Terminal 1: Start the bot
npm run demo

# Terminal 2: Start frontend development server
npm run dev:frontend
```

The frontend will be available at `http://localhost:3001` (or the next available port).

### 📱 Frontend Features

- **Dark theme** optimized for trading
- **Responsive design** works on desktop and mobile
- **Real-time updates** via WebSocket connections
- **Interactive charts** with Recharts
- **Strategy management** with parameter controls
- **Live log streaming** for debugging and monitoring
