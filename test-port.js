const net = require('net');

async function findAvailablePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        console.log(`Port ${port} is available`);
        resolve(port);
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${startPort} is in use, trying ${startPort + 1}`);
        // Port is in use, try the next one
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

async function test() {
  try {
    const port = await findAvailablePort(3000);
    console.log(`Final available port: ${port}`);
  } catch (error) {
    console.error('Error finding port:', error);
  }
}

test();
