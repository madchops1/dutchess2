#!/usr/bin/env node

const http = require('http');

async function testFrontend() {
  console.log('🚀 Testing DutchessAI Trading Bot Frontend...\n');
  
  // Test the API endpoints
  const endpoints = [
    { path: '/', description: 'Bot Status' },
    { path: '/status', description: 'Detailed Status' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.description} (${endpoint.path})...`);
      
      const data = await makeRequest(3000, endpoint.path);
      console.log(`✅ ${endpoint.description}: OK`);
      console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...\n`);
    } catch (error) {
      console.log(`❌ ${endpoint.description}: FAILED`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  // Test if frontend files are served
  try {
    console.log('Testing Frontend Files...');
    const html = await makeRequest(3000, '/', true);
    if (html.includes('DutchessAI Trading Bot')) {
      console.log('✅ Frontend: Serving HTML files');
    } else {
      console.log('⚠️  Frontend: HTML served but missing expected content');
    }
  } catch (error) {
    console.log('❌ Frontend: Not serving files');
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n🎉 Frontend test complete!');
  console.log('📱 Open http://localhost:3000 in your browser to view the dashboard');
}

function makeRequest(port, path, getText = false) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      headers: {
        'Accept': getText ? 'text/html' : 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (getText) {
            resolve(data);
          } else {
            resolve(JSON.parse(data));
          }
        } catch (error) {
          resolve(data); // Return raw data if JSON parsing fails
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

if (require.main === module) {
  testFrontend().catch(console.error);
}
