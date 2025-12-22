#!/usr/bin/env node

/**
 * Test Supabase Cloud Connection
 * Run with: node scripts/test-connection.js
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Cloud Connection...\n');
console.log('Project URL:', SUPABASE_URL);
console.log('Service Key:', SERVICE_KEY ? '✅ Found' : '❌ Missing');
console.log('Anon Key:', ANON_KEY ? '✅ Found' : '❌ Missing');
console.log('');

// Test 1: Health Check
function testHealthCheck() {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/`;

    console.log('Test 1: Health Check');
    console.log(`GET ${url}`);

    https.get(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ REST API is accessible');
          console.log('Response:', data.substring(0, 100) + '...\n');
          resolve();
        } else {
          console.log(`❌ Failed: HTTP ${res.statusCode}`);
          console.log('Response:', data, '\n');
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.log('❌ Connection failed:', err.message, '\n');
      reject(err);
    });
  });
}

// Test 2: Check if nodes table exists
function testNodesTable() {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/nodes?limit=1`;

    console.log('Test 2: Check nodes table');
    console.log(`GET ${url}`);

    https.get(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const records = JSON.parse(data);
          console.log(`✅ nodes table exists (${records.length} records found)`);
          if (records.length > 0) {
            console.log('Sample node:', JSON.stringify(records[0], null, 2).substring(0, 200) + '...');
          }
          console.log('');
          resolve();
        } else if (res.statusCode === 404) {
          console.log('⚠️  nodes table not found - migrations need to run');
          console.log('Run: supabase link && supabase db push\n');
          resolve(); // Not a hard failure
        } else {
          console.log(`❌ Failed: HTTP ${res.statusCode}`);
          console.log('Response:', data, '\n');
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.log('❌ Query failed:', err.message, '\n');
      reject(err);
    });
  });
}

// Test 3: Check storage bucket
function testStorageBucket() {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/bucket/node-avatars`;

    console.log('Test 3: Check storage bucket');
    console.log(`GET ${url}`);

    https.get(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const bucket = JSON.parse(data);
          console.log('✅ node-avatars bucket exists');
          console.log('Bucket config:', JSON.stringify(bucket, null, 2));
          console.log('');
          resolve();
        } else if (res.statusCode === 404 || res.statusCode === 400) {
          console.log('⚠️  node-avatars bucket not found');
          console.log('Run the SQL script: scripts/setup-supabase-storage.sql');
          console.log('Dashboard → SQL Editor → Paste & Run\n');
          resolve(); // Not a hard failure
        } else {
          console.log(`❌ Failed: HTTP ${res.statusCode}`);
          console.log('Response:', data, '\n');
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.log('❌ Storage check failed:', err.message, '\n');
      reject(err);
    });
  });
}

// Run all tests
async function runTests() {
  try {
    await testHealthCheck();
    await testNodesTable();
    await testStorageBucket();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All connection tests passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nNext steps:');
    console.log('1. Run migrations if nodes table missing');
    console.log('2. Create storage bucket if missing (use scripts/setup-supabase-storage.sql)');
    console.log('3. Start development: make cloud-dev');

  } catch (err) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ Connection test failed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nError:', err.message);
    process.exit(1);
  }
}

runTests();
