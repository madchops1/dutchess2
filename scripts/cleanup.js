#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function killProcessOnPort(port) {
  try {
    // Find processes using the port
    const { stdout } = await execAsync(`lsof -ti :${port}`);
    const pids = stdout.trim().split('\n').filter(pid => pid);
    
    if (pids.length === 0) {
      console.log(`No processes found on port ${port}`);
      return;
    }
    
    console.log(`Found ${pids.length} process(es) on port ${port}: ${pids.join(', ')}`);
    
    // Kill each process
    for (const pid of pids) {
      try {
        await execAsync(`kill -9 ${pid}`);
        console.log(`Killed process ${pid}`);
      } catch (error) {
        console.log(`Failed to kill process ${pid}: ${error.message}`);
      }
    }
    
    // Wait a moment and verify
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const { stdout: checkStdout } = await execAsync(`lsof -ti :${port}`);
      if (checkStdout.trim()) {
        console.log(`Warning: Some processes may still be running on port ${port}`);
      } else {
        console.log(`Port ${port} is now free`);
      }
    } catch (error) {
      console.log(`Port ${port} is now free`);
    }
    
  } catch (error) {
    if (error.code === 1) {
      console.log(`No processes found on port ${port}`);
    } else {
      console.error(`Error checking port ${port}:`, error.message);
    }
  }
}

async function main() {
  const port = process.argv[2] || '3000';
  console.log(`Cleaning up port ${port}...`);
  await killProcessOnPort(port);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { killProcessOnPort };
