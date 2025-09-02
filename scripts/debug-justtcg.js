#!/usr/bin/env node
// JustTCG API Debug Script
// Test different approaches to find Lorcana cards

import https from 'https';

const JUSTTCG_API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Lorcana-EV-Calculator/1.0'
      },
      timeout: 10000
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function debugJustTcgApi() {
  console.log('🔍 Debugging JustTCG API...\n');
  
  const tests = [
    {
      name: 'Test 1: Basic API connection',
      url: `${JUSTTCG_BASE_URL}/cards?limit=1`
    },
    {
      name: 'Test 2: Search without game filter',
      url: `${JUSTTCG_BASE_URL}/cards?q=Mickey%20Mouse&limit=5`
    },
    {
      name: 'Test 3: Try "Disney Lorcana" as game',
      url: `${JUSTTCG_BASE_URL}/cards?q=Mickey&game=disney-lorcana&limit=5`
    },
    {
      name: 'Test 4: Try "Lorcana" as game',
      url: `${JUSTTCG_BASE_URL}/cards?q=Mickey&game=lorcana&limit=5`
    },
    {
      name: 'Test 5: Try popular Lorcana character - Elsa',
      url: `${JUSTTCG_BASE_URL}/cards?q=Elsa&limit=10`
    },
    {
      name: 'Test 6: List available games endpoint',
      url: `${JUSTTCG_BASE_URL}/games`
    },
    {
      name: 'Test 7: Search with Set 1 card - Mickey Mouse',
      url: `${JUSTTCG_BASE_URL}/cards?q=Mickey%20Mouse%20Brave%20Little%20Tailor&limit=10`
    }
  ];
  
  for (const test of tests) {
    console.log(`📋 ${test.name}`);
    console.log(`🔗 URL: ${test.url}`);
    
    try {
      const response = await makeApiRequest(test.url);
      console.log(`✅ Status: ${response.statusCode}`);
      
      if (response.statusCode === 200) {
        let jsonData;
        try {
          jsonData = JSON.parse(response.body);
          console.log(`📊 Response keys: ${Object.keys(jsonData).join(', ')}`);
          
          if (jsonData.data && Array.isArray(jsonData.data)) {
            console.log(`📈 Results count: ${jsonData.data.length}`);
            if (jsonData.data.length > 0) {
              const firstResult = jsonData.data[0];
              console.log(`📝 Sample result: ${JSON.stringify(firstResult, null, 2).slice(0, 300)}...`);
            }
          }
          
          if (jsonData.games) {
            console.log(`🎮 Available games: ${jsonData.games.map(g => g.name || g).join(', ')}`);
          }
          
          if (jsonData.metadata) {
            console.log(`📋 Metadata: ${JSON.stringify(jsonData.metadata, null, 2)}`);
          }
          
        } catch (parseError) {
          console.log(`📄 Raw response (first 200 chars): ${response.body.slice(0, 200)}`);
        }
      } else {
        console.log(`❌ Error response: ${response.body.slice(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Run debug tests
debugJustTcgApi().catch(console.error);