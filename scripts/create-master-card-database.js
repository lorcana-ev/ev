#!/usr/bin/env node
// Create comprehensive master card database with mappings to all sources
// Every card gets an entry with identifiers from Dreamborn, Lorcast, and JustTCG

import fs from 'fs';
import path from 'path';

function loadAllSources() {
  console.log('📚 Loading all data sources...\n');
  
  const sources = {};
  
  // Load Dreamborn (cards-formatted.json)
  try {
    const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'));
    sources.dreamborn = dreambornCards.reduce((acc, card) => {
      acc[card.id] = card;
      return acc;
    }, {});
    console.log(`✅ Dreamborn: ${Object.keys(sources.dreamborn).length} cards`);
  } catch (error) {
    console.log(`❌ Dreamborn: ${error.message}`);
    sources.dreamborn = {};
  }
  
  // Load Lorcast
  try {
    const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    sources.lorcast = lorcastData.cards;
    console.log(`✅ Lorcast: ${Object.keys(sources.lorcast).length} cards`);
  } catch (error) {
    console.log(`❌ Lorcast: ${error.message}`);
    sources.lorcast = {};
  }
  
  // Load JustTCG
  try {
    const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
    sources.justtcg = justTcgData.cards;
    console.log(`✅ JustTCG: ${Object.keys(sources.justtcg).length} cards`);
  } catch (error) {
    console.log(`❌ JustTCG: ${error.message}`);
    sources.justtcg = {};
  }
  
  return sources;
}

function getAllUniqueCardIds(sources) {
  const allIds = new Set();
  
  Object.values(sources).forEach(source => {
    Object.keys(source).forEach(id => allIds.add(id));
  });
  
  return Array.from(allIds).sort();
}

function normalizeRarity(rarity) {
  if (!rarity) return null;
  return String(rarity).toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractSetInfo(cardId) {
  // Extract set information from card ID
  const parts = cardId.split('-');
  if (parts.length >= 2) {
    const setCode = parts[0];
    const cardNumber = parts[1];
    
    // Map set codes to names
    const setNames = {
      '001': 'The First Chapter',
      '002': 'Rise of the Floodborn', 
      '003': 'Into the Inklands',
      '004': 'Ursula\'s Return',
      '005': 'Shimmering Skies',
      '006': 'Azurite Sea',
      '007': 'Archazia\'s Island',
      '008': 'Reign of Jafar',
      '009': 'Fabled',
      'D23': 'D23 Collection',
      'P1': 'Promo Set 1',
      'P2': 'Promo Set 2'
    };
    
    return {
      set_code: setCode,
      set_name: setNames[setCode] || `Set ${setCode}`,
      card_number: cardNumber
    };
  }
  
  return {
    set_code: 'UNK',
    set_name: 'Unknown',
    card_number: '000'
  };
}

function createMasterCard(cardId, sources) {
  const dreambornCard = sources.dreamborn[cardId];
  const lorcastCard = sources.lorcast[cardId];
  const justTcgCard = sources.justtcg[cardId];
  
  // Extract set info from card ID
  const setInfo = extractSetInfo(cardId);
  
  // Build master card entry
  const masterCard = {
    // Core identification
    master_id: cardId,
    set_code: setInfo.set_code,
    set_name: setInfo.set_name,
    card_number: setInfo.card_number,
    
    // Source availability
    sources_available: {
      dreamborn: !!dreambornCard,
      lorcast: !!lorcastCard,
      justtcg: !!justTcgCard
    },
    
    // Consolidated card data (prefer Lorcast > Dreamborn > JustTCG for card details)
    name: lorcastCard?.name || dreambornCard?.name || justTcgCard?.name || 'Unknown',
    title: lorcastCard?.title || dreambornCard?.title || null,
    rarity: normalizeRarity(lorcastCard?.rarity || dreambornCard?.rarity || justTcgCard?.rarity),
    type: lorcastCard?.type || dreambornCard?.type || 'Unknown',
    cost: lorcastCard?.cost || dreambornCard?.cost || null,
    ink: lorcastCard?.ink || dreambornCard?.colors?.[0] || null,
    
    // Game stats (where available)
    lore: lorcastCard?.lore || dreambornCard?.lore || null,
    strength: lorcastCard?.strength || dreambornCard?.strength || null,
    willpower: lorcastCard?.willpower || dreambornCard?.willpower || null,
    
    // Source-specific identifiers
    source_ids: {}
  };
  
  // Add Dreamborn-specific data
  if (dreambornCard) {
    masterCard.source_ids.dreamborn = {
      id: dreambornCard.id,
      setId: dreambornCard.setId,
      variants: dreambornCard.variants || [],
      inkwell: dreambornCard.inkwell || false
    };
  }
  
  // Add Lorcast-specific data
  if (lorcastCard) {
    masterCard.source_ids.lorcast = {
      id: lorcastCard.id,
      set_id: lorcastCard.set_id,
      set_code: lorcastCard.set_code,
      tcgplayer_id: lorcastCard.raw_data?.tcgplayer_id || null,
      illustrators: lorcastCard.raw_data?.illustrators || [],
      foil_available: lorcastCard.foil_available
    };
  }
  
  // Add JustTCG-specific data
  if (justTcgCard) {
    masterCard.source_ids.justtcg = {
      id: justTcgCard.justtcg_id,
      tcgplayer_id: justTcgCard.tcgplayer_id,
      pricing_variants: Object.keys(justTcgCard.variants || {}).length,
      has_pricing: Object.keys(justTcgCard.variants || {}).length > 0
    };
  }
  
  return masterCard;
}

function analyzeDiscrepancies(masterCards) {
  console.log('🔍 Analyzing discrepancies across sources...\n');
  
  const discrepancies = {
    name_mismatches: [],
    rarity_mismatches: [], 
    missing_from_sources: {
      dreamborn: [],
      lorcast: [],
      justtcg: []
    },
    set_coverage: {},
    rarity_distribution: {}
  };
  
  masterCards.forEach(card => {
    const { master_id, sources_available, name, rarity, set_code } = card;
    
    // Track missing from each source
    if (!sources_available.dreamborn) discrepancies.missing_from_sources.dreamborn.push(master_id);
    if (!sources_available.lorcast) discrepancies.missing_from_sources.lorcast.push(master_id);
    if (!sources_available.justtcg) discrepancies.missing_from_sources.justtcg.push(master_id);
    
    // Check for name/rarity mismatches between sources
    const dreambornCard = card.source_ids.dreamborn;
    const lorcastCard = card.source_ids.lorcast;
    
    if (dreambornCard && lorcastCard) {
      // Compare names (allowing for slight variations)
      const dreambornName = dreambornCard.id ? name : null;
      const lorcastName = lorcastCard.id ? name : null;
      
      if (dreambornName && lorcastName && dreambornName !== lorcastName) {
        discrepancies.name_mismatches.push({
          card_id: master_id,
          dreamborn_name: dreambornName,
          lorcast_name: lorcastName
        });
      }
    }
    
    // Track set coverage
    if (!discrepancies.set_coverage[set_code]) {
      discrepancies.set_coverage[set_code] = {
        total: 0,
        dreamborn: 0,
        lorcast: 0,
        justtcg: 0
      };
    }
    
    discrepancies.set_coverage[set_code].total++;
    if (sources_available.dreamborn) discrepancies.set_coverage[set_code].dreamborn++;
    if (sources_available.lorcast) discrepancies.set_coverage[set_code].lorcast++;
    if (sources_available.justtcg) discrepancies.set_coverage[set_code].justtcg++;
    
    // Track rarity distribution
    if (rarity) {
      if (!discrepancies.rarity_distribution[rarity]) {
        discrepancies.rarity_distribution[rarity] = 0;
      }
      discrepancies.rarity_distribution[rarity]++;
    }
  });
  
  return discrepancies;
}

function createMasterCardDatabase() {
  console.log('🚀 Creating Master Card Database with all source mappings...\n');
  
  // Load all sources
  const sources = loadAllSources();
  
  // Get all unique card IDs
  const allCardIds = getAllUniqueCardIds(sources);
  console.log(`\n📊 Found ${allCardIds.length} unique cards across all sources\n`);
  
  // Create master cards
  console.log('🔧 Building master card entries...');
  const masterCards = allCardIds.map(cardId => createMasterCard(cardId, sources));
  
  // Analyze discrepancies
  const discrepancies = analyzeDiscrepancies(masterCards);
  
  // Build final database
  const masterDatabase = {
    metadata: {
      created_at: new Date().toISOString(),
      total_cards: masterCards.length,
      sources: {
        dreamborn: Object.keys(sources.dreamborn).length,
        lorcast: Object.keys(sources.lorcast).length,
        justtcg: Object.keys(sources.justtcg).length
      },
      coverage_summary: {
        all_three_sources: masterCards.filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && c.sources_available.justtcg).length,
        dreamborn_lorcast: masterCards.filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && !c.sources_available.justtcg).length,
        dreamborn_justtcg: masterCards.filter(c => c.sources_available.dreamborn && !c.sources_available.lorcast && c.sources_available.justtcg).length,
        lorcast_justtcg: masterCards.filter(c => !c.sources_available.dreamborn && c.sources_available.lorcast && c.sources_available.justtcg).length,
        dreamborn_only: masterCards.filter(c => c.sources_available.dreamborn && !c.sources_available.lorcast && !c.sources_available.justtcg).length,
        lorcast_only: masterCards.filter(c => !c.sources_available.dreamborn && c.sources_available.lorcast && !c.sources_available.justtcg).length,
        justtcg_only: masterCards.filter(c => !c.sources_available.dreamborn && !c.sources_available.lorcast && c.sources_available.justtcg).length
      }
    },
    discrepancy_analysis: discrepancies,
    cards: masterCards.reduce((acc, card) => {
      acc[card.master_id] = card;
      return acc;
    }, {})
  };
  
  // Save the master database
  fs.writeFileSync('./data/MASTER_CARD_DATABASE.json', JSON.stringify(masterDatabase, null, 2));
  
  // Print summary
  console.log('💾 Master Card Database created!\n');
  console.log('📊 Summary:');
  console.log(`   Total unique cards: ${masterDatabase.metadata.total_cards}`);
  console.log(`   Cards in all 3 sources: ${masterDatabase.metadata.coverage_summary.all_three_sources}`);
  console.log(`   Cards in Dreamborn + Lorcast: ${masterDatabase.metadata.coverage_summary.dreamborn_lorcast}`);
  console.log(`   Cards in Dreamborn + JustTCG: ${masterDatabase.metadata.coverage_summary.dreamborn_justtcg}`);
  console.log(`   Cards in Lorcast + JustTCG: ${masterDatabase.metadata.coverage_summary.lorcast_justtcg}`);
  console.log(`   Dreamborn only: ${masterDatabase.metadata.coverage_summary.dreamborn_only}`);
  console.log(`   Lorcast only: ${masterDatabase.metadata.coverage_summary.lorcast_only}`);
  console.log(`   JustTCG only: ${masterDatabase.metadata.coverage_summary.justtcg_only}`);
  
  console.log('\\n📈 Set Coverage:');
  Object.entries(discrepancies.set_coverage).forEach(([setCode, coverage]) => {
    console.log(`   ${setCode}: ${coverage.total} total (D:${coverage.dreamborn}, L:${coverage.lorcast}, J:${coverage.justtcg})`);
  });
  
  console.log('\\n🎯 Rarity Distribution:');
  Object.entries(discrepancies.rarity_distribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([rarity, count]) => {
      console.log(`   ${rarity}: ${count} cards`);
    });
  
  console.log('\\n📋 Discrepancies:');
  console.log(`   Missing from Dreamborn: ${discrepancies.missing_from_sources.dreamborn.length}`);
  console.log(`   Missing from Lorcast: ${discrepancies.missing_from_sources.lorcast.length}`);  
  console.log(`   Missing from JustTCG: ${discrepancies.missing_from_sources.justtcg.length}`);
  
  return masterDatabase;
}

// Export for use by other scripts
export { createMasterCardDatabase };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createMasterCardDatabase();
}