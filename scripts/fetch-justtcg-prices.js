#!/usr/bin/env node
// JustTCG API Integration Script
// Fetches Lorcana card pricing from JustTCG API and compares to TCGPlayer

import https from 'https';
import fs from 'fs';
import path from 'path';

// JustTCG API configuration
const JUSTTCG_API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000; // 1 second between requests for rate limiting

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Lorcana-EV-Calculator/1.0',
        ...headers
      },
      timeout: 10000
    };

    console.log(`🔍 API Request: ${url}`);

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
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

async function searchLorcanaCard(cardName, cardTitle = null) {
  // Try different search strategies
  const searchTerms = [
    cardTitle ? `${cardName} ${cardTitle}` : cardName,
    cardName,
    cardTitle
  ].filter(Boolean);

  console.log(`🎯 Searching for: ${cardName}${cardTitle ? ` - ${cardTitle}` : ''}`);

  for (const searchTerm of searchTerms) {
    try {
      // Search by name with Lorcana game filter
      const encodedTerm = encodeURIComponent(searchTerm);
      const searchUrl = `${JUSTTCG_BASE_URL}/cards?q=${encodedTerm}&game=disney-lorcana`;
      
      console.log(`   📝 Trying search term: "${searchTerm}"`);
      const response = await makeApiRequest(searchUrl);
      
      if (response.statusCode === 200 && response.data.data && response.data.data.length > 0) {
        console.log(`   ✅ Found ${response.data.data.length} result(s)`);
        return response.data;
      } else {
        console.log(`   ❌ No results for "${searchTerm}"`);
      }
    } catch (error) {
      console.log(`   ❌ Error searching "${searchTerm}": ${error.message}`);
    }
    
    // Small delay between search attempts
    await delay(200);
  }

  return null;
}

function extractPricingData(cardData, cardName, cardTitle) {
  if (!cardData || !cardData.data || !cardData.data.length) {
    return null;
  }

  const results = [];
  
  for (const card of cardData.data) {
    console.log(`   📊 Processing card: ${card.name || 'Unknown'}`);
    
    // Check if this looks like the right card
    const nameMatch = card.name && card.name.toLowerCase().includes(cardName.toLowerCase());
    const titleMatch = !cardTitle || (card.name && card.name.toLowerCase().includes(cardTitle.toLowerCase()));
    
    if (nameMatch && titleMatch && card.variants) {
      for (const variant of card.variants) {
        const pricing = {
          name: card.name,
          set: card.set,
          condition: variant.condition || 'Near Mint',
          printing: variant.printing || 'Normal',
          price: variant.price || variant.marketPrice || 0,
          priceChange24h: variant.priceChange24h || 0,
          priceChange7d: variant.priceChange7d || 0,
          priceChange30d: variant.priceChange30d || 0,
          tcgplayerId: card.tcgplayerId || variant.tcgplayerId,
          lastUpdated: variant.lastUpdated || new Date().toISOString()
        };
        
        console.log(`     💰 ${pricing.printing} ${pricing.condition}: $${pricing.price}`);
        results.push(pricing);
      }
    }
  }
  
  return results.length > 0 ? results : null;
}

async function fetchJustTcgPrice(card) {
  console.log(`\n🚀 Fetching JustTCG pricing for ${card.name} - ${card.title} (${card.id})...`);
  
  try {
    const cardData = await searchLorcanaCard(card.name, card.title);
    
    if (!cardData) {
      console.log(`   ❌ No data found via JustTCG API`);
      return null;
    }
    
    const pricing = extractPricingData(cardData, card.name, card.title);
    
    if (pricing) {
      console.log(`   ✅ Found pricing data with ${pricing.length} variant(s)`);
      return {
        cardId: card.id,
        name: card.name,
        title: card.title,
        pricing: pricing,
        source: 'JustTCG'
      };
    } else {
      console.log(`   ❌ Found card data but no pricing information`);
      return null;
    }
    
  } catch (error) {
    console.error(`   ❌ Error fetching ${card.id}: ${error.message}`);
    return null;
  }
}

async function testJustTcgWithExistingCards() {
  console.log('🧪 Testing JustTCG API with existing Set 9 cards...\n');
  
  // Load existing Set 9 cards that we have TCGPlayer pricing for
  const usdPath = path.join(process.cwd(), 'data', 'USD.json');
  const cardsPath = path.join(process.cwd(), 'data', 'cards-formatted.json');
  
  let existingPricing, cardsData;
  
  try {
    existingPricing = JSON.parse(fs.readFileSync(usdPath, 'utf8'));
    cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  } catch (error) {
    console.error('❌ Error loading data files:', error.message);
    return;
  }
  
  // Get Set 9 cards that already have TCGPlayer pricing
  const set9CardsWithPricing = cardsData.filter(card => 
    card.setId === '009' && existingPricing[card.id]
  );
  
  console.log(`📋 Found ${set9CardsWithPricing.length} Set 9 cards with existing TCGPlayer pricing`);
  console.log(`🔍 Will test JustTCG API with these cards for comparison\n`);
  
  const results = [];
  const comparisons = [];
  
  for (let i = 0; i < Math.min(set9CardsWithPricing.length, 5); i++) {
    const card = set9CardsWithPricing[i];
    
    // Get JustTCG pricing
    const justTcgResult = await fetchJustTcgPrice(card);
    
    if (justTcgResult) {
      results.push(justTcgResult);
      
      // Compare to existing TCGPlayer pricing
      const tcgPlayerPricing = existingPricing[card.id];
      if (tcgPlayerPricing) {
        const comparison = {
          cardId: card.id,
          cardName: `${card.name} - ${card.title}`,
          tcgPlayer: {
            base: tcgPlayerPricing.base?.TP?.price || 0,
            foil: tcgPlayerPricing.foil?.TP?.price || 0
          },
          justTcg: justTcgResult.pricing,
          differences: []
        };
        
        // Find comparable pricing
        for (const variant of justTcgResult.pricing) {
          const isNormalPrinting = variant.printing.toLowerCase().includes('normal') || variant.printing.toLowerCase().includes('base');
          const isFoilPrinting = variant.printing.toLowerCase().includes('foil');
          
          if (isNormalPrinting && comparison.tcgPlayer.base > 0) {
            const diff = variant.price - comparison.tcgPlayer.base;
            comparison.differences.push({
              type: 'base',
              tcgPlayer: comparison.tcgPlayer.base,
              justTcg: variant.price,
              difference: diff,
              percentDiff: ((diff / comparison.tcgPlayer.base) * 100).toFixed(1)
            });
          }
          
          if (isFoilPrinting && comparison.tcgPlayer.foil > 0) {
            const diff = variant.price - comparison.tcgPlayer.foil;
            comparison.differences.push({
              type: 'foil',
              tcgPlayer: comparison.tcgPlayer.foil,
              justTcg: variant.price,
              difference: diff,
              percentDiff: ((diff / comparison.tcgPlayer.foil) * 100).toFixed(1)
            });
          }
        }
        
        comparisons.push(comparison);
      }
    }
    
    // Rate limiting
    if (i < set9CardsWithPricing.length - 1) {
      console.log(`   ⏳ Waiting ${DELAY_MS}ms before next request...\n`);
      await delay(DELAY_MS);
    }
  }
  
  // Summary
  console.log('\n📊 JustTCG API Test Results:');
  console.log(`   Cards tested: ${set9CardsWithPricing.length}`);
  console.log(`   Successful fetches: ${results.length}`);
  console.log(`   Success rate: ${Math.round((results.length / set9CardsWithPricing.length) * 100)}%`);
  
  if (comparisons.length > 0) {
    console.log('\n💰 Price Comparisons (TCGPlayer vs JustTCG):');
    for (const comp of comparisons) {
      console.log(`\n🃏 ${comp.cardName}`);
      for (const diff of comp.differences) {
        const direction = diff.difference >= 0 ? '+' : '';
        console.log(`   ${diff.type}: TCGPlayer $${diff.tcgPlayer} vs JustTCG $${diff.justTcg} (${direction}${diff.percentDiff}%)`);
      }
    }
  }
  
  // Save results for analysis
  if (results.length > 0) {
    const resultsPath = path.join(process.cwd(), 'justtcg-test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({ results, comparisons }, null, 2));
    console.log(`\n💾 Detailed results saved to ${resultsPath}`);
  }
  
  return { results, comparisons };
}

// Export for use by other scripts
export { searchLorcanaCard, fetchJustTcgPrice, testJustTcgWithExistingCards };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testJustTcgWithExistingCards().catch(console.error);
}