#!/usr/bin/env node
// Fetch JustTCG data with enhanced variant support
// Try different approaches to find missing high-value cards

import https from 'https';
import fs from 'fs';
import zlib from 'zlib';

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

async function testVariantApproaches() {
  console.log('🔍 Testing JustTCG Variant Approaches\n');
  
  // Test 1: Try fetching Set 4 (Ursula's Return) with different parameters
  console.log('📦 Test 1: Set 4 with enhanced parameters');
  try {
    const url = `${BASE_URL}/cards?game=disney-lorcana&set=Ursula's Return&limit=50`;
    const response = await makeApiRequest(url);
    console.log(`   Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const cards = response.data.data || response.data || [];
      console.log(`   Found ${cards.length} cards in Set 4`);
      
      // Show first few cards
      cards.slice(0, 5).forEach(card => {
        console.log(`     ${card.number}: ${card.name} (${card.rarity})`);
      });
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  await delay(DELAY_MS);
  
  // Test 2: Search for specific missing cards by name
  console.log('\n📋 Test 2: Search missing cards by name');
  const missingCards = [
    'Bolt',
    'Elsa', 
    'Genie',
    'Mulan'
  ];
  
  for (const cardName of missingCards) {
    try {
      const url = `${BASE_URL}/cards?game=disney-lorcana&q=${encodeURIComponent(cardName)}&limit=10`;
      const response = await makeApiRequest(url);
      
      if (response.statusCode === 200) {
        const cards = response.data.data || response.data || [];
        const relevantCards = cards.filter(card => 
          card.name.toLowerCase().includes(cardName.toLowerCase()) &&
          (card.set.includes('Archazia') || card.set.includes('Fabled'))
        );
        
        if (relevantCards.length > 0) {
          console.log(`   ${cardName}: Found ${relevantCards.length} relevant matches`);
          relevantCards.forEach(card => {
            console.log(`     ${card.set} - ${card.number}: ${card.name} (${card.rarity})`);
          });
        } else {
          console.log(`   ${cardName}: No relevant matches found`);
        }
      }
      
      await delay(DELAY_MS);
    } catch (error) {
      console.log(`   ${cardName}: Error - ${error.message}`);
    }
  }
  
  // Test 3: Try fetching with different printing parameters
  console.log('\n✨ Test 3: Check for enchanted/foil variants');
  try {
    const url = `${BASE_URL}/cards?game=disney-lorcana&printing=Foil&limit=20`;
    const response = await makeApiRequest(url);
    
    if (response.statusCode === 200) {
      const cards = response.data.data || response.data || [];
      console.log(`   Found ${cards.length} foil cards`);
      
      // Look for enchanted foils
      const enchantedFoils = cards.filter(card => 
        card.rarity?.toLowerCase().includes('enchanted')
      );
      
      if (enchantedFoils.length > 0) {
        console.log(`   Enchanted foil variants: ${enchantedFoils.length}`);
        enchantedFoils.slice(0, 3).forEach(card => {
          console.log(`     ${card.set} - ${card.number}: ${card.name}`);
        });
      }
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  await delay(DELAY_MS);
  
  // Test 4: Check if there are additional parameters we should use
  console.log('\n🔧 Test 4: Explore API parameters');
  try {
    // Try with include_variants parameter (if it exists)
    const url = `${BASE_URL}/cards?game=disney-lorcana&set=Fabled&limit=5&include_variants=true`;
    const response = await makeApiRequest(url);
    
    console.log(`   include_variants test: Status ${response.statusCode}`);
    if (response.statusCode === 200) {
      const cards = response.data.data || response.data || [];
      console.log(`   Cards returned: ${cards.length}`);
      
      // Check if any cards have enhanced variant info
      cards.forEach(card => {
        if (card.variants && Object.keys(card.variants).length > 0) {
          console.log(`     ${card.number}: ${card.name} - ${Object.keys(card.variants).length} variants`);
        }
      });
    }
  } catch (error) {
    console.log(`   include_variants test failed: ${error.message}`);
  }
}

// Test TCGPlayer ID approach
async function testTCGPlayerIDApproach() {
  console.log('\n🎯 Testing TCGPlayer ID Approach');
  
  // Load Lorcast data to get TCGPlayer IDs for missing cards
  try {
    const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    
    const missingCardIds = ['007-223', '007-224', '009-229', '009-235'];
    
    for (const cardId of missingCardIds) {
      const lorcastCard = lorcastData.cards[cardId];
      if (lorcastCard?.raw_data?.tcgplayer_id) {
        const tcgplayerId = lorcastCard.raw_data.tcgplayer_id;
        
        try {
          const url = `${BASE_URL}/cards?tcgplayerId=${tcgplayerId}`;
          const response = await makeApiRequest(url);
          
          if (response.statusCode === 200) {
            const cards = response.data.data || response.data || [];
            if (cards.length > 0) {
              console.log(`   ✅ ${cardId} (TCGPlayer: ${tcgplayerId}): FOUND via TCGPlayer ID!`);
              cards.forEach(card => {
                console.log(`     ${card.set} - ${card.number}: ${card.name} (${card.rarity})`);
              });
            } else {
              console.log(`   ❌ ${cardId} (TCGPlayer: ${tcgplayerId}): Not found`);
            }
          } else {
            console.log(`   ⚠️  ${cardId}: API returned status ${response.statusCode}`);
          }
          
          await delay(DELAY_MS);
        } catch (error) {
          console.log(`   ❌ ${cardId}: Error - ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  ${cardId}: No TCGPlayer ID in Lorcast data`);
      }
    }
  } catch (error) {
    console.log(`   Error loading Lorcast data: ${error.message}`);
  }
}

async function runVariantTests() {
  await testVariantApproaches();
  await testTCGPlayerIDApproach();
  
  console.log('\n✅ Variant testing complete');
}

// Run the tests
runVariantTests().catch(console.error);