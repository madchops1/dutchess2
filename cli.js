#!/usr/bin/env node

const { program } = require('commander');
const TradingBot = require('./src/index');

program
  .version('1.0.0')
  .description('DutchessAI Trading Bot CLI');

program
  .command('start')
  .description('Start the trading bot')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('-d, --demo', 'Run in demo mode without real trading')
  .action(async (options) => {
    process.env.PORT = options.port;
    if (options.demo) {
      process.env.DEMO_MODE = 'true';
      console.log('Starting in DEMO mode - no real trades will be executed');
    }
    
    const bot = new TradingBot();
    global.tradingBot = bot;
    await bot.start();
  });

program
  .command('strategy')
  .description('Manage trading strategies')
  .option('-l, --list', 'List available strategies')
  .option('-s, --start <name>', 'Start a strategy')
  .option('-t, --stop <name>', 'Stop a strategy')
  .action((options) => {
    if (options.list) {
      console.log('Available strategies:');
      console.log('- sma: Simple Moving Average');
      console.log('- rsi: RSI Strategy');
      console.log('- macd: MACD Strategy');
    }
    
    if (options.start) {
      console.log(`Starting strategy: ${options.start}`);
      // This would require connecting to a running bot instance
      console.log('Use the API endpoint POST /strategy/start instead');
    }
    
    if (options.stop) {
      console.log(`Stopping strategy: ${options.stop}`);
      // This would require connecting to a running bot instance
      console.log('Use the API endpoint POST /strategy/stop instead');
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
