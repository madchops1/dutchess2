#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting DutchessAI Trading Bot with Frontend...\n');

// Start the trading bot
console.log('📊 Starting trading bot...');
//const bot = spawn('node', ['cli.js', 'start', '--demo'], {
const bot = spawn('node', ['cli.js', 'start'], {
  cwd: path.join(__dirname),
  stdio: ['inherit', 'pipe', 'pipe']
});

bot.stdout.on('data', (data) => {
  console.log(`[BOT] ${data.toString().trim()}`);
});

bot.stderr.on('data', (data) => {
  console.error(`[BOT ERROR] ${data.toString().trim()}`);
});

bot.on('close', (code) => {
  console.log(`\n🛑 Trading bot exited with code ${code}`);
  process.exit(code);
});

// Wait a moment for the bot to start
setTimeout(() => {
  console.log('\n🌐 Bot should now be running with frontend dashboard');
  console.log('📱 Open http://localhost:3000 in your browser');
  console.log('⚡ Use Ctrl+C to stop the bot\n');
  
  // Try to open browser automatically (macOS)
  const { exec } = require('child_process');
  exec('open http://localhost:3000', (error) => {
    if (error) {
      console.log('💡 Tip: Manually open http://localhost:3000 in your browser');
    } else {
      console.log('🚀 Opening browser automatically...');
    }
  });
}, 3000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  bot.kill('SIGINT');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  bot.kill('SIGTERM');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
