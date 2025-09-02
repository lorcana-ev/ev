#!/usr/bin/env node
// Investigate box/case products issue - they might be stored differently

import https from 'https';
import zlib from 'zlib';
import fs from 'fs';

const API_KEY = 'tcg_0ecc60ebe3854a369313b16a95737637';
const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: 30000
    };

    const req = https.request(url, options, (res) => {
      let responseStream = res;
      
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        responseStream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        responseStream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        responseStream = res.pipe(zlib.createBrotliDecompress());
      }
      
      let data = '';
      responseStream.on('data', chunk => {
        data += chunk.toString();
      });
      
      responseStream.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
      
      responseStream.on('error', reject);
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function investigateBoxCaseProducts() {
  console.log('📦 Investigating Box/Case Products Issue\n');
  
  // First, let's check our current JustTCG data for any products
  const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  
  console.log('🔍 Searching current JustTCG data for box/case keywords:');
  const boxCaseKeywords = ['box', 'case', 'booster', 'starter', 'deck', 'bundle', 'collection', 'trove'];
  const potentialProducts = [];
  
  Object.entries(justTcgData.cards).forEach(([cardId, card]) => {
    const name = card.name.toLowerCase();
    const hasKeyword = boxCaseKeywords.some(keyword => name.includes(keyword));
    
    if (hasKeyword && (name.includes('box') || name.includes('case') || name.includes('deck'))) {
      potentialProducts.push({
        id: cardId,
        name: card.name,
        set: card.set,
        variants: Object.keys(card.variants || {}),
        pricing: Object.entries(card.variants || {}).map(([variant, data]) => `${variant}: $${data.price}`).slice(0, 2)
      });
    }
  });
  
  console.log(`   Found ${potentialProducts.length} potential products:`);
  potentialProducts.forEach(product => {
    console.log(`     ${product.id}: ${product.name} (${product.set})`);
    if (product.pricing.length > 0) {
      console.log(`       Pricing: ${product.pricing.join(', ')}`);
    }
  });
  
  // Try searching specifically for Fabled box products
  console.log('\n🎯 Searching specifically for Fabled box products via API:');
  
  const searchTerms = [
    'Fabled box',
    'Fabled case', 
    'Disney Lorcana Fabled',
    'booster box Fabled'
  ];
  
  for (const term of searchTerms) {
    try {
      console.log(`\n   Searching for: "${term}"`);
      const url = `${BASE_URL}/cards?game=disney-lorcana&q=${encodeURIComponent(term)}&limit=10`;
      const response = await makeApiRequest(url);
      
      if (response.statusCode === 200) {
        const cards = response.data.data || [];
        console.log(`     Found ${cards.length} results`);
        
        cards.forEach(card => {
          if (card.name.toLowerCase().includes('box') || card.name.toLowerCase().includes('case')) {
            console.log(`       ${card.set} - ${card.number}: ${card.name}`);
            console.log(`         Rarity: ${card.rarity}`);
          }
        });
      } else {
        console.log(`     API returned status ${response.statusCode}`);
      }
      
      await delay(DELAY_MS);
    } catch (error) {
      console.log(`     Error searching "${term}": ${error.message}`);
    }
  }
  
  // Check if there might be a separate products endpoint
  console.log('\n🔧 Testing potential product-specific endpoints:');
  
  const testEndpoints = [
    '/products?game=disney-lorcana',
    '/sealed?game=disney-lorcana', 
    '/boxes?game=disney-lorcana'
  ];
  
  for (const endpoint of testEndpoints) {
    try {
      console.log(`\n   Testing: ${BASE_URL}${endpoint}`);
      const response = await makeApiRequest(`${BASE_URL}${endpoint}`);
      
      if (response.statusCode === 200) {
        console.log(`     ✅ Endpoint exists! Status: ${response.statusCode}`);
        const data = response.data;
        
        if (Array.isArray(data)) {
          console.log(`     Found ${data.length} items`);
        } else if (data.data && Array.isArray(data.data)) {
          console.log(`     Found ${data.data.length} items in data array`);
        } else {
          console.log(`     Response structure: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
        }
      } else {
        console.log(`     Status: ${response.statusCode}`);
      }
      
      await delay(DELAY_MS);
    } catch (error) {
      console.log(`     Error: ${error.message}`);
    }
  }
  
  // Summary and recommendations
  console.log('\n📋 Investigation Summary:');
  console.log(`   Current JustTCG data contains ${potentialProducts.length} potential product entries`);
  
  if (potentialProducts.length > 0) {
    const coreSetProducts = potentialProducts.filter(p => 
      ['001', '002', '003', '004', '005', '006', '007', '008', '009'].some(set => p.id.startsWith(set))
    );
    console.log(`   Core sets products found: ${coreSetProducts.length}`);
  } else {
    console.log('   ❌ No box/case products found in core sets data');
    console.log('   Possible reasons:');
    console.log('     - Products stored in separate API endpoints');
    console.log('     - Products use different naming conventions'); 
    console.log('     - Products not available in JustTCG for Disney Lorcana');
    console.log('     - API key restrictions on product data');
  }
  
  return potentialProducts;
}

// Run the investigation
investigateBoxCaseProducts().catch(console.error);