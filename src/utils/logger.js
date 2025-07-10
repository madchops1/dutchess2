const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ' ' + JSON.stringify(meta, null, 2);
    }
    return msg;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'trading-bot' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Write error logs to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Write trading logs to trading.log
    new winston.transports.File({
      filename: path.join(logsDir, 'trading.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create specialized loggers for different components
const tradingLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'trading', component: 'trading-engine' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'trades.log'),
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

const strategyLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'strategy' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'strategies.log'),
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

const marketDataLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'market-data' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'market-data.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Utility functions
logger.logTrade = (tradeData) => {
  tradingLogger.info('Trade executed', tradeData);
  logger.info('Trade executed', tradeData);
};

logger.logStrategy = (strategyName, action, data) => {
  strategyLogger.info(`Strategy ${action}`, { strategy: strategyName, ...data });
  logger.info(`Strategy ${strategyName} ${action}`, data);
};

logger.logMarketData = (event, data) => {
  marketDataLogger.debug(`Market data: ${event}`, data);
};

logger.logSignal = (signal) => {
  const logData = {
    type: signal.type,
    strategy: signal.strategy,
    timestamp: signal.timestamp,
    reason: signal.data.reason,
    price: signal.data.price,
    confidence: signal.data.confidence
  };
  
  tradingLogger.info('Signal generated', logData);
  logger.info(`${signal.type.toUpperCase()} signal from ${signal.strategy}`, logData);
};

// Error handling
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

module.exports = logger;
