#!/usr/bin/env node
// Authoritative Card Database Creation
// Fetches from multiple APIs to create comprehensive card database

import https from 'https';
import fs from 'fs';
import path from 'path';

const DELAY_MS = 1000; // 1 second between API calls
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'AUTHORITATIVE_CARDS.json');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function fetchLorcastData() {
  console.log('🔍 Fetching data from Lorcast API...');
  
  try {
    // Get all sets
    console.log('📦 Fetching sets from Lorcast...');
    const setsResponse = await makeApiRequest('https://api.lorcast.com/sets');
    
    if (setsResponse.statusCode !== 200) {
      throw new Error(`Lorcast sets API returned ${setsResponse.statusCode}`);
    }
    
    const sets = setsResponse.data.results || setsResponse.data;
    console.log(`✅ Found ${sets.length} sets on Lorcast`);
    
    const lorcastData = {
      metadata: {
        source: 'lorcast.com',
        fetched_at: new Date().toISOString(),
        total_sets: sets.length,
        total_cards: 0
      },
      sets: {},
      cards: {}
    };
    
    // Fetch cards for each set
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      console.log(`\n📋 [${i+1}/${sets.length}] Fetching cards for: ${set.name} (${set.code})`);
      
      try {
        const cardsUrl = `https://api.lorcast.com/sets/${set.id}/cards`;
        const cardsResponse = await makeApiRequest(cardsUrl);
        
        if (cardsResponse.statusCode === 200) {
          const cards = cardsResponse.data.results || cardsResponse.data;
          console.log(`   ✅ ${cards.length} cards fetched`);
          
          // Store set info
          lorcastData.sets[set.code] = {
            id: set.id,
            name: set.name,
            code: set.code,
            released_at: set.released_at,
            prereleased_at: set.prereleased_at,
            card_count: cards.length
          };
          
          // Store cards
          cards.forEach(card => {
            const cardId = `${set.code.padStart(3, '0')}-${String(card.number).padStart(3, '0')}`;
            lorcastData.cards[cardId] = {
              ...card,
              set_code: set.code,
              set_name: set.name,
              source: 'lorcast',
              card_id: cardId
            };
          });
          
          lorcastData.metadata.total_cards += cards.length;
        } else {
          console.log(`   ❌ Failed to fetch cards: ${cardsResponse.statusCode}`);
        }
        
        // Rate limiting
        if (i < sets.length - 1) {
          await delay(DELAY_MS);
        }
        
      } catch (error) {
        console.log(`   ❌ Error fetching cards for ${set.name}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Lorcast Summary: ${Object.keys(lorcastData.sets).length} sets, ${Object.keys(lorcastData.cards).length} cards`);
    return lorcastData;
    
  } catch (error) {
    console.error('❌ Error fetching Lorcast data:', error.message);
    return null;
  }
}

async function fetchLorcanaApiData() {
  console.log('\n🔍 Fetching data from Lorcana-API...');
  
  try {
    // Get bulk sets data
    console.log('📦 Fetching bulk sets data...');
    const setsResponse = await makeApiRequest('https://api.lorcana-api.com/bulk/sets');
    
    if (setsResponse.statusCode !== 200) {
      throw new Error(`Lorcana-API sets returned ${setsResponse.statusCode}`);
    }
    
    const sets = setsResponse.data;
    console.log(`✅ Found ${sets.length} sets on Lorcana-API`);
    
    // Try to get bulk cards data
    console.log('📋 Attempting to fetch bulk cards data...');
    let cardsData = null;
    
    try {
      const cardsResponse = await makeApiRequest('https://api.lorcana-api.com/bulk/cards');
      if (cardsResponse.statusCode === 200) {
        cardsData = cardsResponse.data;
        console.log(`✅ Found ${cardsData.length} cards in bulk data`);
      }
    } catch (error) {
      console.log(`⚠️  Bulk cards endpoint not available: ${error.message}`);
    }
    
    const lorcanaApiData = {
      metadata: {
        source: 'lorcana-api.com',
        fetched_at: new Date().toISOString(),
        total_sets: sets.length,
        total_cards: cardsData ? cardsData.length : 0,
        bulk_cards_available: !!cardsData
      },
      sets: {},
      cards: {}
    };
    
    // Process sets
    sets.forEach(set => {
      lorcanaApiData.sets[set.code] = {
        ...set,
        source: 'lorcana-api'
      };
    });
    
    // Process cards if available
    if (cardsData) {
      cardsData.forEach(card => {
        const cardId = `${String(card.set_num).padStart(3, '0')}-${String(card.number).padStart(3, '0')}`;
        lorcanaApiData.cards[cardId] = {
          ...card,
          source: 'lorcana-api',
          card_id: cardId
        };
      });
    }
    
    console.log(`\n📊 Lorcana-API Summary: ${Object.keys(lorcanaApiData.sets).length} sets, ${Object.keys(lorcanaApiData.cards).length} cards`);
    return lorcanaApiData;
    
  } catch (error) {
    console.error('❌ Error fetching Lorcana-API data:', error.message);
    return null;
  }
}

function compareDatabases(lorcast, lorcanaApi, dreamborn) {
  console.log('\n🔍 Comparing databases...');
  
  const comparison = {
    metadata: {
      created_at: new Date().toISOString(),
      sources_compared: []
    },
    set_coverage: {},
    card_coverage: {},
    discrepancies: {
      missing_in_dreamborn: [],
      extra_in_dreamborn: [],
      name_mismatches: []
    }
  };
  
  // Load existing dreamborn data for comparison
  let dreambornsCards = {};
  try {
    const dreambornsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'cards-formatted.json'), 'utf8'));
    dreambornsCards = dreambornsData.reduce((acc, card) => {
      acc[card.id] = card;
      return acc;
    }, {});
    comparison.metadata.sources_compared.push('dreamborn');
  } catch (error) {
    console.log('⚠️  Could not load existing dreamborn cards for comparison');
  }
  
  if (lorcast) {
    comparison.metadata.sources_compared.push('lorcast');
    
    // Find cards in Lorcast but not in Dreamborn
    Object.entries(lorcast.cards).forEach(([cardId, card]) => {
      if (!dreambornsCards[cardId]) {
        comparison.discrepancies.missing_in_dreamborn.push({
          card_id: cardId,
          name: card.name,
          title: card.title,
          set_name: card.set_name,
          rarity: card.rarity,
          source: 'lorcast'
        });
      } else {
        // Check for name mismatches
        const dreambornsCard = dreambornsCards[cardId];
        if (dreambornsCard.name !== card.name || dreambornsCard.title !== card.title) {
          comparison.discrepancies.name_mismatches.push({
            card_id: cardId,
            dreamborn: { name: dreambornsCard.name, title: dreambornsCard.title },
            lorcast: { name: card.name, title: card.title }
          });
        }
      }
    });
  }
  
  if (lorcanaApi) {
    comparison.metadata.sources_compared.push('lorcana-api');
    
    // Similar comparison for Lorcana-API
    Object.entries(lorcanaApi.cards).forEach(([cardId, card]) => {
      if (!dreambornsCards[cardId]) {
        comparison.discrepancies.missing_in_dreamborn.push({
          card_id: cardId,
          name: card.name,
          title: card.title || card.subtitle,
          set_name: card.set_name,
          rarity: card.rarity,
          source: 'lorcana-api'
        });
      }
    });
  }
  
  // Find cards in Dreamborn but not in other sources
  Object.entries(dreambornsCards).forEach(([cardId, card]) => {
    const inLorcast = lorcast && lorcast.cards[cardId];
    const inLorcanaApi = lorcanaApi && lorcanaApi.cards[cardId];
    
    if (!inLorcast && !inLorcanaApi) {
      comparison.discrepancies.extra_in_dreamborn.push({
        card_id: cardId,
        name: card.name,
        title: card.title,
        set_name: card.setName || `Set ${card.setId}`,
        rarity: card.rarity
      });
    }
  });
  
  console.log(`\n📊 Database Comparison Results:`);
  console.log(`   Missing in Dreamborn: ${comparison.discrepancies.missing_in_dreamborn.length} cards`);
  console.log(`   Extra in Dreamborn: ${comparison.discrepancies.extra_in_dreamborn.length} cards`);
  console.log(`   Name mismatches: ${comparison.discrepancies.name_mismatches.length} cards`);
  
  return comparison;
}

function createUnifiedDatabase(lorcast, lorcanaApi, comparison) {
  console.log('\n🔧 Creating unified authoritative database...');
  
  const unified = {
    metadata: {
      created_at: new Date().toISOString(),
      sources: [],
      total_sets: 0,
      total_cards: 0,
      data_quality: {
        lorcast_cards: lorcast ? Object.keys(lorcast.cards).length : 0,
        lorcana_api_cards: lorcanaApi ? Object.keys(lorcanaApi.cards).length : 0,
        unified_cards: 0
      }
    },
    sets: {},
    cards: {}
  };
  
  // Merge sets (prefer Lorcast for detailed info)
  if (lorcast) {
    unified.metadata.sources.push('lorcast');
    Object.assign(unified.sets, lorcast.sets);
  }
  
  if (lorcanaApi) {
    unified.metadata.sources.push('lorcana-api');
    // Add any sets not in Lorcast
    Object.entries(lorcanaApi.sets).forEach(([code, set]) => {
      if (!unified.sets[code]) {
        unified.sets[code] = set;
      }
    });
  }
  
  // Merge cards (prefer Lorcast, fallback to Lorcana-API)
  if (lorcast) {
    Object.assign(unified.cards, lorcast.cards);
  }
  
  if (lorcanaApi) {
    Object.entries(lorcanaApi.cards).forEach(([cardId, card]) => {
      if (!unified.cards[cardId]) {
        unified.cards[cardId] = card;
      }
    });
  }
  
  unified.metadata.total_sets = Object.keys(unified.sets).length;
  unified.metadata.total_cards = Object.keys(unified.cards).length;
  unified.metadata.data_quality.unified_cards = unified.metadata.total_cards;
  
  console.log(`📊 Unified Database: ${unified.metadata.total_sets} sets, ${unified.metadata.total_cards} cards`);
  return unified;
}

async function createAuthoritativeDatabase() {
  console.log('🚀 Creating Authoritative Lorcana Card Database...\n');
  
  // Fetch data from both APIs
  const [lorcastData, lorcanaApiData] = await Promise.all([
    fetchLorcastData(),
    fetchLorcanaApiData()
  ]);
  
  // Compare with existing Dreamborn data
  const comparison = compareDatabases(lorcastData, lorcanaApiData);
  
  // Create unified database
  const unifiedData = createUnifiedDatabase(lorcastData, lorcanaApiData, comparison);
  
  // Save all results
  const outputData = {
    unified: unifiedData,
    comparison: comparison,
    raw_sources: {
      lorcast: lorcastData,
      lorcana_api: lorcanaApiData
    }
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Saved authoritative database to ${OUTPUT_FILE}`);
  
  // Summary report
  console.log('\n📋 Final Summary:');
  console.log(`   Sources fetched: ${lorcastData ? '✅' : '❌'} Lorcast, ${lorcanaApiData ? '✅' : '❌'} Lorcana-API`);
  console.log(`   Unified database: ${unifiedData.metadata.total_cards} cards across ${unifiedData.metadata.total_sets} sets`);
  console.log(`   Cards missing from Dreamborn: ${comparison.discrepancies.missing_in_dreamborn.length}`);
  
  // Show some missing Set 9 cards
  const missingSet9 = comparison.discrepancies.missing_in_dreamborn.filter(card => 
    card.card_id.startsWith('009-') || card.set_name === 'Fabled'
  );
  
  if (missingSet9.length > 0) {
    console.log(`\n🎯 Missing Set 9 cards (first 10):`);
    missingSet9.slice(0, 10).forEach(card => {
      console.log(`   ${card.card_id}: ${card.name} - ${card.title || 'N/A'} (${card.rarity})`);
    });
    if (missingSet9.length > 10) {
      console.log(`   ... and ${missingSet9.length - 10} more Set 9 cards`);
    }
  }
  
  return outputData;
}

// Export for use by other scripts
export { createAuthoritativeDatabase };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createAuthoritativeDatabase().catch(console.error);
}