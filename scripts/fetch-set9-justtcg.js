#!/usr/bin/env node
// Set 9 (Fabled) JustTCG Price Discovery Script
// Searches for Set 9 cards using JustTCG API

import https from 'https';
import fs from 'fs';
import path from 'path';

const JUSTTCG_API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000; // 1 second between requests

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function getAllSet9Cards() {
  console.log('🔍 Searching for all Set 9 (Fabled) cards in JustTCG...\n');
  
  const allCards = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    console.log(`📄 Fetching page ${page}...`);
    
    try {
      const url = `${JUSTTCG_BASE_URL}/cards?game=disney-lorcana&set=Fabled&limit=20&page=${page}`;
      const response = await makeApiRequest(url);
      
      if (response.statusCode === 200 && response.data.data) {
        const pageCards = response.data.data;
        console.log(`   ✅ Found ${pageCards.length} cards on page ${page}`);
        
        allCards.push(...pageCards);
        
        // Check if we have more pages
        hasMore = pageCards.length === 20; // Full page suggests more data
        page++;
        
        if (hasMore) {
          await delay(DELAY_MS);
        }
      } else {
        console.log(`   ❌ No more data found (status: ${response.statusCode})`);
        hasMore = false;
      }
      
    } catch (error) {
      console.log(`   ❌ Error fetching page ${page}: ${error.message}`);
      hasMore = false;
    }
  }
  
  console.log(`\n📊 Total Set 9 cards found: ${allCards.length}\n`);
  return allCards;
}

function processCardData(card) {
  // Extract the best pricing data from variants
  const pricing = {
    cardName: card.name,
    set: card.set,
    number: card.number,
    rarity: card.rarity,
    tcgplayerId: card.tcgplayerId,
    variants: []
  };
  
  if (card.variants && card.variants.length > 0) {
    for (const variant of card.variants) {
      pricing.variants.push({
        condition: variant.condition || 'Near Mint',
        printing: variant.printing || 'Normal',
        price: variant.price || 0,
        priceChange7d: variant.priceChange7d || 0,
        priceChange30d: variant.priceChange30d || 0,
        lastUpdated: variant.lastUpdated
      });
    }
    
    // Sort variants by condition preference (NM > LP > MP) and printing (Normal > Foil)
    pricing.variants.sort((a, b) => {
      const conditionOrder = { 'Near Mint': 0, 'Lightly Played': 1, 'Moderately Played': 2 };
      const printingOrder = { 'Normal': 0, 'Holofoil': 1, 'Cold Foil': 2 };
      
      const conditionDiff = (conditionOrder[a.condition] || 3) - (conditionOrder[b.condition] || 3);
      if (conditionDiff !== 0) return conditionDiff;
      
      return (printingOrder[a.printing] || 3) - (printingOrder[b.printing] || 3);
    });
  }
  
  return pricing;
}

function convertToUsdFormat(justTcgCard) {
  // Convert JustTCG format to our USD.json format
  if (!justTcgCard.variants || justTcgCard.variants.length === 0) {
    return null;
  }
  
  const result = {
    base: {},
    foil: {}
  };
  
  // Find best base and foil pricing
  let bestBase = null;
  let bestFoil = null;
  
  for (const variant of justTcgCard.variants) {
    const isNormalPrinting = variant.printing === 'Normal' || !variant.printing.toLowerCase().includes('foil');
    const isFoilPrinting = variant.printing && variant.printing.toLowerCase().includes('foil');
    const isNearMint = variant.condition === 'Near Mint';
    
    if (isNormalPrinting && (!bestBase || (isNearMint && bestBase.condition !== 'Near Mint'))) {
      bestBase = variant;
    }
    
    if (isFoilPrinting && (!bestFoil || (isNearMint && bestFoil.condition !== 'Near Mint'))) {
      bestFoil = variant;
    }
  }
  
  if (bestBase) {
    result.base.JT = {
      price: bestBase.price,
      condition: bestBase.condition,
      printing: bestBase.printing,
      lastUpdated: new Date(bestBase.lastUpdated * 1000).toISOString()
    };
  }
  
  if (bestFoil) {
    result.foil.JT = {
      price: bestFoil.price,
      condition: bestFoil.condition,
      printing: bestFoil.printing,
      lastUpdated: new Date(bestFoil.lastUpdated * 1000).toISOString()
    };
  }
  
  // Only return if we have at least one pricing variant
  return (bestBase || bestFoil) ? result : null;
}

async function mapSet9CardsToCardIds() {
  console.log('🔗 Mapping Set 9 JustTCG cards to our card IDs...\n');
  
  // Load our card data
  const cardsPath = path.join(process.cwd(), 'data', 'cards-formatted.json');
  let ourCards;
  
  try {
    ourCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  } catch (error) {
    console.error('❌ Error loading cards-formatted.json:', error.message);
    return;
  }
  
  const set9Cards = ourCards.filter(card => card.setId === '009');
  console.log(`📋 We have ${set9Cards.length} Set 9 cards in our database`);
  
  // Get JustTCG Set 9 cards
  const justTcgCards = await getAllSet9Cards();
  
  if (justTcgCards.length === 0) {
    console.log('❌ No Set 9 cards found in JustTCG API');
    return;
  }
  
  // Map JustTCG cards to our card IDs
  const mappings = [];
  const newPricingData = {};
  
  for (const jtCard of justTcgCards) {
    console.log(`🔍 Processing: ${jtCard.name} (${jtCard.number})`);
    
    // Find matching card in our database
    const matches = set9Cards.filter(ourCard => {
      // Match by name (handle different formats)
      const jtName = jtCard.name.replace(/\s*\([^)]*\)\s*$/, ''); // Remove (Enchanted), (Iconic), etc
      const nameMatch = jtName.includes('-') ? 
        jtName.split('-').map(p => p.trim()) :
        [jtName];
      
      if (nameMatch.length >= 2) {
        const [character, title] = nameMatch;
        return ourCard.name === character.trim() && ourCard.title === title.trim();
      } else {
        return ourCard.name === jtName.trim() || 
               (ourCard.name + ' - ' + ourCard.title).toLowerCase() === jtCard.name.toLowerCase();
      }
    });
    
    if (matches.length === 1) {
      const ourCard = matches[0];
      console.log(`   ✅ Mapped to ${ourCard.id}: ${ourCard.name} - ${ourCard.title}`);
      
      // Convert to our pricing format
      const pricingData = convertToUsdFormat(jtCard);
      if (pricingData) {
        newPricingData[ourCard.id] = pricingData;
        
        mappings.push({
          ourCardId: ourCard.id,
          ourCardName: `${ourCard.name} - ${ourCard.title}`,
          justTcgName: jtCard.name,
          justTcgId: jtCard.id,
          tcgplayerId: jtCard.tcgplayerId,
          rarity: jtCard.rarity,
          variants: jtCard.variants?.length || 0
        });
        
        // Show sample pricing
        if (pricingData.base.JT) {
          console.log(`     💰 Base: $${pricingData.base.JT.price} (${pricingData.base.JT.condition})`);
        }
        if (pricingData.foil.JT) {
          console.log(`     💰 Foil: $${pricingData.foil.JT.price} (${pricingData.foil.JT.condition})`);
        }
      }
    } else if (matches.length > 1) {
      console.log(`   ⚠️  Multiple matches for ${jtCard.name}:`);
      matches.forEach(match => {
        console.log(`     - ${match.id}: ${match.name} - ${match.title} (${match.rarity})`);
      });
    } else {
      console.log(`   ❌ No match found for: ${jtCard.name}`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Mapping Summary:');
  console.log(`   JustTCG Set 9 cards found: ${justTcgCards.length}`);
  console.log(`   Successfully mapped: ${mappings.length}`);
  console.log(`   Cards with pricing data: ${Object.keys(newPricingData).length}`);
  console.log(`   Success rate: ${Math.round((mappings.length / justTcgCards.length) * 100)}%\n`);
  
  // Save results
  if (mappings.length > 0) {
    const mappingsPath = path.join(process.cwd(), 'set9-justtcg-mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify({ mappings, newPricingData }, null, 2));
    console.log(`💾 Results saved to ${mappingsPath}`);
    
    console.log('\n🎯 Top Set 9 Cards Found:');
    mappings.slice(0, 10).forEach(mapping => {
      console.log(`   ${mapping.ourCardId}: ${mapping.ourCardName} (${mapping.rarity})`);
    });
  }
  
  return { mappings, newPricingData };
}

// Export for use by other scripts
export { getAllSet9Cards, mapSet9CardsToCardIds };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  mapSet9CardsToCardIds().catch(console.error);
}