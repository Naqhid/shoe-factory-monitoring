const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3001';
const TEST_DATE = new Date().toISOString().split('T')[0];

console.log('🧪 Starting Application Test Suite\n');
console.log(`Testing Date: ${TEST_DATE}\n`);

const tests = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
    tests.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}\n`);
    failed++;
    tests.push({ name, status: 'FAIL', error: error.message });
  }
}

async function runTests() {
  // Test 1: Health Check
  await test('Health Check', async () => {
    const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    if (response.data.status !== 'OK') throw new Error('Health check failed');
  });

  // Test 2: Machine Status API
  await test('Machine Status API', async () => {
    const response = await axios.get(`${API_BASE}/api/machines/status`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
    if (!Array.isArray(response.data.data)) throw new Error('Data is not an array');
  });

  // Test 3: Run-Idle Report API
  await test('Run-Idle Report API', async () => {
    const response = await axios.get(`${API_BASE}/api/reports/run-idle?date=${TEST_DATE}`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
  });

  // Test 4: Hourly Report API
  await test('Hourly Report API', async () => {
    const response = await axios.get(`${API_BASE}/api/reports/hourly?date=${TEST_DATE}`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
  });

  // Test 5: Efficiency Report API
  await test('Efficiency Report API', async () => {
    const response = await axios.get(`${API_BASE}/api/reports/efficiency?date=${TEST_DATE}`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
  });

  // Test 6: Overall Efficiency API
  await test('Overall Efficiency API', async () => {
    const response = await axios.get(`${API_BASE}/api/reports/overall-efficiency?date=${TEST_DATE}`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
  });

  // Test 7: Daily Dashboard API
  await test('Daily Dashboard API', async () => {
    const response = await axios.get(`${API_BASE}/api/dashboard/daily?date=${TEST_DATE}`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
  });

  // Test 8: Overall Daily Data API
  await test('Overall Daily Data API', async () => {
    const response = await axios.get(`${API_BASE}/api/dashboard/overall-daily?date=${TEST_DATE}`, { timeout: 5000 });
    if (!response.data.success) throw new Error('API returned success: false');
  });

  // Test 9: Invalid Date Format
  await test('Invalid Date Format Handling', async () => {
    try {
      await axios.get(`${API_BASE}/api/reports/run-idle?date=invalid`, { timeout: 5000 });
      throw new Error('Should have returned 400 error');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return; // Expected behavior
      }
      throw error;
    }
  });

  // Test 10: CORS Headers
  await test('CORS Headers Present', async () => {
    const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    if (!response.headers['access-control-allow-origin']) {
      throw new Error('CORS headers missing');
    }
  });

  // Test 11: Directory Structure
  await test('Backend Directory Structure', async () => {
    const backendDir = path.join(__dirname, 'backend');
    const requiredDirs = ['data/incoming', 'data/processed', 'data/error', 'logs'];
    
    for (const dir of requiredDirs) {
      const fullPath = path.join(backendDir, dir);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing directory: ${dir}`);
      }
    }
  });

  // Test 12: Environment Variables
  await test('Environment Variables Loaded', async () => {
    require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
    const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'PORT'];
    
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing env variable: ${key}`);
      }
    }
  });

  // Test 13: Manual Event Creation
  await test('Manual Event Creation', async () => {
    const testEvent = {
      machine_id: 'TEST-01',
      status: 1,
      source: 'test-suite'
    };
    
    const response = await axios.post(`${API_BASE}/api/manual-event`, testEvent, { timeout: 5000 });
    if (!response.data.success) throw new Error('Failed to create manual event');
  });

  // Test 14: File Processing Test
  await test('File Processing Setup', async () => {
    const incomingDir = path.join(__dirname, 'backend', 'data', 'incoming');
    if (!fs.existsSync(incomingDir)) {
      throw new Error('Incoming directory not found');
    }
    
    // Check if directory is writable
    const testFile = path.join(incomingDir, '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  });

  // Test 15: Frontend Build Files
  await test('Frontend Package Configuration', async () => {
    const packagePath = path.join(__dirname, 'frontend', 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error('Frontend package.json not found');
    }
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const requiredDeps = ['react', 'axios', 'react-query'];
    
    for (const dep of requiredDeps) {
      if (!pkg.dependencies[dep]) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`   - ${t.name}: ${t.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
