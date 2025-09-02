#!/usr/bin/env node
// Test JustTCG API with Set 1 cards to verify integration

import https from 'https';
import fs from 'fs';
import path from 'path';

const JUSTTCG_API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testSet1Cards() {
  console.log('🧪 Testing JustTCG with Set 1 cards...\n');
  
  // Test with known Set 1 cards
  const testCards = [
    { name: 'Mickey Mouse', title: 'Wayward Sorcerer' },
    { name: 'Elsa', title: 'Spirit of Winter' },
    { name: 'Belle', title: 'Hidden Archer' },
    { name: 'Maui', title: 'Demigod of the Wind and Sea' }
  ];
  
  for (const card of testCards) {
    console.log(`🔍 Testing: ${card.name} - ${card.title}`);
    
    try {
      const searchTerm = `${card.name} ${card.title}`;
      const url = `${JUSTTCG_BASE_URL}/cards?q=${encodeURIComponent(searchTerm)}&game=disney-lorcana`;
      const response = await makeApiRequest(url);
      
      if (response.data.data && response.data.data.length > 0) {
        const result = response.data.data[0];
        console.log(`   ✅ Found: ${result.name} (Set: ${result.set})`);
        
        if (result.variants && result.variants.length > 0) {
          console.log(`   💰 Pricing variants: ${result.variants.length}`);
          for (const variant of result.variants.slice(0, 2)) { // Show first 2 variants
            console.log(`     - ${variant.printing || 'Normal'} ${variant.condition || 'NM'}: $${variant.price || variant.marketPrice || 'N/A'}`);
          }
        }
      } else {
        console.log(`   ❌ No results found`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function checkAvailableSets() {
  console.log('📋 Checking available Lorcana sets...\n');
  
  try {
    // Search for cards and collect unique sets
    const url = `${JUSTTCG_BASE_URL}/cards?game=disney-lorcana&limit=50`;
    const response = await makeApiRequest(url);
    
    if (response.data.data) {
      const sets = new Set();
      for (const card of response.data.data) {
        if (card.set) {
          sets.add(card.set);
        }
      }
      
      const sortedSets = Array.from(sets).sort();
      console.log(`🎮 Available Lorcana sets in JustTCG (${sortedSets.length}):`);
      sortedSets.forEach(set => {
        console.log(`   - ${set}`);
      });
      
      // Check if Set 9 exists
      const hasSet9 = sortedSets.some(set => 
        set.toLowerCase().includes('fabled') || 
        set.toLowerCase().includes('set 9') ||
        set.includes('9')
      );
      
      console.log(`\n🎯 Set 9 (Fabled) availability: ${hasSet9 ? '✅ Available' : '❌ Not found'}`);
      
    }
  } catch (error) {
    console.log(`❌ Error checking sets: ${error.message}`);
  }
}

async function main() {
  await testSet1Cards();
  await checkAvailableSets();
}

main().catch(console.error);