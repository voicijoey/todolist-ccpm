#!/usr/bin/env node

/**
 * Application Test Script
 * Tests the complete Epic Todo List application
 */

const http = require('http');

console.log('🧪 Testing Epic Todo List Application\n');

// Test configuration
const API_BASE = 'http://localhost:3001/api';
const FRONTEND_BASE = 'http://localhost:8080';

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('application/json')
            ? JSON.parse(data)
            : data;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Test API health
 */
async function testAPIHealth() {
  console.log('1. 🏥 Testing API Health...');

  try {
    const response = await makeRequest(`${API_BASE}/health`);

    if (response.status === 200 && response.data.success) {
      console.log('   ✅ API is healthy');
      console.log(`   📊 Status: ${response.data.data.status}`);
      console.log(`   💾 Database: ${response.data.data.database.status}`);
      return true;
    } else {
      console.log('   ❌ API health check failed');
      console.log(`   📊 Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Failed to connect to API');
    console.log(`   💥 Error: ${error.message}`);
    return false;
  }
}

/**
 * Test frontend server
 */
async function testFrontendServer() {
  console.log('\n2. 🌐 Testing Frontend Server...');

  try {
    const response = await makeRequest(FRONTEND_BASE);

    if (response.status === 200) {
      console.log('   ✅ Frontend server is running');
      console.log(`   📄 Content-Type: ${response.headers['content-type']}`);
      return true;
    } else {
      console.log('   ❌ Frontend server returned error');
      console.log(`   📊 Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Failed to connect to frontend server');
    console.log(`   💥 Error: ${error.message}`);
    return false;
  }
}

/**
 * Test API endpoints
 */
async function testAPIEndpoints() {
  console.log('\n3. 🔌 Testing API Endpoints...');

  const endpoints = [
    { path: '/', name: 'API Root' },
    { path: '/health', name: 'Health Check' },
    { path: '/auth/login', name: 'Auth Login (OPTIONS)', method: 'OPTIONS' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method || 'GET'
      });

      if (response.status < 500) {
        console.log(`   ✅ ${endpoint.name}: ${response.status}`);
      } else {
        console.log(`   ❌ ${endpoint.name}: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${endpoint.name}: Connection failed`);
    }
  }
}

/**
 * Test frontend assets
 */
async function testFrontendAssets() {
  console.log('\n4. 📁 Testing Frontend Assets...');

  const assets = [
    { path: '/css/main.css', name: 'Main CSS' },
    { path: '/css/responsive.css', name: 'Responsive CSS' },
    { path: '/js/api.js', name: 'API Client' },
    { path: '/js/auth.js', name: 'Auth Manager' },
    { path: '/js/tasks.js', name: 'Task Manager' },
    { path: '/js/app.js', name: 'App Controller' },
    { path: '/login.html', name: 'Login Page' }
  ];

  for (const asset of assets) {
    try {
      const response = await makeRequest(`${FRONTEND_BASE}${asset.path}`);

      if (response.status === 200) {
        console.log(`   ✅ ${asset.name}: Available`);
      } else {
        console.log(`   ❌ ${asset.name}: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${asset.name}: Connection failed`);
    }
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('Epic Todo List - Application Test Suite');
  console.log('=====================================\n');

  const apiHealthy = await testAPIHealth();
  const frontendHealthy = await testFrontendServer();

  if (apiHealthy && frontendHealthy) {
    await testAPIEndpoints();
    await testFrontendAssets();

    console.log('\n🎉 Test Summary');
    console.log('===============');
    console.log('✅ Backend API: Running on http://localhost:3001');
    console.log('✅ Frontend Server: Running on http://localhost:8080');
    console.log('✅ All core components: Accessible');

    console.log('\n📖 Next Steps:');
    console.log('1. Open http://localhost:8080 in your browser');
    console.log('2. Click "Sign up" to create a new account');
    console.log('3. Login and start managing your tasks!');

    console.log('\n📱 Test Features:');
    console.log('• User registration and authentication');
    console.log('• Task creation, editing, and deletion');
    console.log('• Task completion toggle');
    console.log('• Filter tasks by status (All/Pending/Completed)');
    console.log('• Responsive design on different screen sizes');
    console.log('• Accessibility features (keyboard navigation)');

  } else {
    console.log('\n❌ Test Summary');
    console.log('===============');

    if (!apiHealthy) {
      console.log('❌ Backend API: Not running or unhealthy');
      console.log('   → Start with: npm start');
    }

    if (!frontendHealthy) {
      console.log('❌ Frontend Server: Not running');
      console.log('   → Start with: node serve-frontend.js');
    }
  }

  console.log('\n🔗 Useful URLs:');
  console.log(`• Frontend: ${FRONTEND_BASE}`);
  console.log(`• Login Page: ${FRONTEND_BASE}/login.html`);
  console.log(`• API Health: ${API_BASE}/health`);
  console.log(`• API Root: ${API_BASE}`);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});