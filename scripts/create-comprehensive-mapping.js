#!/usr/bin/env node
// Create comprehensive mapping between all data sources
// Compare Dreamborn, JustTCG, and Lorcast data to identify discrepancies

import fs from 'fs';
import path from 'path';

function loadSourceData() {
  const sources = {};
  
  try {
    // Load Dreamborn cards (our original source)
    const cardsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'cards-formatted.json'), 'utf8'));
    sources.dreamborn = {
      metadata: { source: 'dreamborn.ink', total_cards: cardsData.length },
      cards: cardsData.reduce((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {})
    };
    console.log(`✅ Loaded Dreamborn: ${cardsData.length} cards`);
  } catch (error) {
    console.log(`❌ Could not load Dreamborn data: ${error.message}`);
    sources.dreamborn = { metadata: { error: error.message }, cards: {} };
  }
  
  try {
    // Load JustTCG data
    const justTcgData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'JUSTTCG.json'), 'utf8'));
    sources.justtcg = {
      metadata: { 
        source: 'justtcg_api', 
        total_cards: Object.keys(justTcgData.cards).length,
        successful_mappings: justTcgData.metadata.successful_mappings
      },
      cards: justTcgData.cards
    };
    console.log(`✅ Loaded JustTCG: ${Object.keys(justTcgData.cards).length} cards`);
  } catch (error) {
    console.log(`❌ Could not load JustTCG data: ${error.message}`);
    sources.justtcg = { metadata: { error: error.message }, cards: {} };
  }
  
  try {
    // Load Lorcast data
    const lorcastData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'LORCAST.json'), 'utf8'));
    sources.lorcast = {
      metadata: { 
        source: 'lorcast_api', 
        total_cards: Object.keys(lorcastData.cards).length,
        total_sets: lorcastData.metadata.total_sets
      },
      cards: lorcastData.cards
    };
    console.log(`✅ Loaded Lorcast: ${Object.keys(lorcastData.cards).length} cards`);
  } catch (error) {
    console.log(`❌ Could not load Lorcast data: ${error.message}`);
    sources.lorcast = { metadata: { error: error.message }, cards: {} };
  }
  
  return sources;
}

function getAllUniqueCardIds(sources) {
  const allIds = new Set();
  
  Object.values(sources).forEach(source => {
    if (source.cards) {
      Object.keys(source.cards).forEach(id => allIds.add(id));
    }
  });
  
  return Array.from(allIds).sort();
}

function analyzeCardCoverage(sources) {
  const allCardIds = getAllUniqueCardIds(sources);
  
  console.log(`\n📊 Coverage Analysis across ${allCardIds.length} unique cards:\n`);
  
  const coverage = {
    all_sources: 0,
    dreamborn_only: 0,
    justtcg_only: 0,
    lorcast_only: 0,
    dreamborn_lorcast: 0,
    dreamborn_justtcg: 0,
    lorcast_justtcg: 0,
    missing_from_all: 0
  };
  
  const detailed = [];
  
  allCardIds.forEach(cardId => {
    const inDreamborn = !!sources.dreamborn.cards[cardId];
    const inJustTcg = !!sources.justtcg.cards[cardId];
    const inLorcast = !!sources.lorcast.cards[cardId];
    
    const sourceCount = [inDreamborn, inJustTcg, inLorcast].filter(Boolean).length;
    
    let category;
    if (sourceCount === 3) {
      category = 'all_sources';
      coverage.all_sources++;
    } else if (sourceCount === 2) {
      if (inDreamborn && inLorcast) {
        category = 'dreamborn_lorcast';
        coverage.dreamborn_lorcast++;
      } else if (inDreamborn && inJustTcg) {
        category = 'dreamborn_justtcg';
        coverage.dreamborn_justtcg++;
      } else if (inLorcast && inJustTcg) {
        category = 'lorcast_justtcg';
        coverage.lorcast_justtcg++;
      }
    } else if (sourceCount === 1) {
      if (inDreamborn) {
        category = 'dreamborn_only';
        coverage.dreamborn_only++;
      } else if (inJustTcg) {
        category = 'justtcg_only';
        coverage.justtcg_only++;
      } else if (inLorcast) {
        category = 'lorcast_only';
        coverage.lorcast_only++;
      }
    } else {
      category = 'missing_from_all';
      coverage.missing_from_all++;
    }
    
    detailed.push({
      card_id: cardId,
      sources: { dreamborn: inDreamborn, justtcg: inJustTcg, lorcast: inLorcast },
      category: category,
      source_count: sourceCount
    });
  });
  
  // Print coverage summary
  console.log('Coverage breakdown:');
  console.log(`  All 3 sources: ${coverage.all_sources} cards`);
  console.log(`  Dreamborn + Lorcast: ${coverage.dreamborn_lorcast} cards`);
  console.log(`  Dreamborn + JustTCG: ${coverage.dreamborn_justtcg} cards`);
  console.log(`  Lorcast + JustTCG: ${coverage.lorcast_justtcg} cards`);
  console.log(`  Dreamborn only: ${coverage.dreamborn_only} cards`);
  console.log(`  JustTCG only: ${coverage.justtcg_only} cards`);
  console.log(`  Lorcast only: ${coverage.lorcast_only} cards`);
  
  return { coverage, detailed };
}

function analyzeRarityDiscrepancies(sources) {
  console.log(`\n🔍 Analyzing rarity discrepancies:\n`);
  
  const discrepancies = [];
  
  // Get cards that exist in multiple sources
  const allCardIds = getAllUniqueCardIds(sources);
  
  allCardIds.forEach(cardId => {
    const dreamborn = sources.dreamborn.cards[cardId];
    const justtcg = sources.justtcg.cards[cardId];
    const lorcast = sources.lorcast.cards[cardId];
    
    if (!dreamborn && !lorcast) return; // Skip JustTCG-only cards for rarity comparison
    
    const rarities = {};
    if (dreamborn) rarities.dreamborn = dreamborn.rarity;
    if (lorcast) rarities.lorcast = lorcast.rarity;
    if (justtcg) rarities.justtcg = 'pricing_only'; // JustTCG doesn't store rarity directly
    
    // Check if rarities match between Dreamborn and Lorcast
    if (dreamborn && lorcast && dreamborn.rarity !== lorcast.rarity) {
      discrepancies.push({
        card_id: cardId,
        name: dreamborn.name || lorcast.name,
        title: dreamborn.title || lorcast.title,
        rarities: rarities,
        mismatch: `${dreamborn.rarity} vs ${lorcast.rarity}`
      });
    }
  });
  
  console.log(`Found ${discrepancies.length} rarity mismatches:`);
  discrepancies.slice(0, 10).forEach(disc => {
    console.log(`  ${disc.card_id}: ${disc.name} - ${disc.title || 'N/A'} (${disc.mismatch})`);
  });
  
  if (discrepancies.length > 10) {
    console.log(`  ... and ${discrepancies.length - 10} more`);
  }
  
  return discrepancies;
}

function analyzeSet9Specifically(sources) {
  console.log(`\n🎯 Set 9 (Fabled) Specific Analysis:\n`);
  
  const set9Analysis = {
    dreamborn: {},
    lorcast: {},
    justtcg: {},
    new_rarities: {},
    foil_patterns: {}
  };
  
  // Analyze each source's Set 9 data
  Object.entries(sources).forEach(([sourceName, source]) => {
    const set9Cards = Object.entries(source.cards).filter(([cardId, card]) => {
      if (sourceName === 'dreamborn') return cardId.startsWith('009-');
      if (sourceName === 'lorcast') return card.set_code === '9';
      if (sourceName === 'justtcg') return cardId.startsWith('009-');
      return false;
    });
    
    set9Analysis[sourceName].total = set9Cards.length;
    set9Analysis[sourceName].rarities = {};
    
    set9Cards.forEach(([cardId, card]) => {
      let rarity;
      if (sourceName === 'dreamborn' || sourceName === 'lorcast') {
        rarity = card.rarity || 'unknown';
      } else {
        rarity = 'pricing_only';
      }
      
      set9Analysis[sourceName].rarities[rarity] = (set9Analysis[sourceName].rarities[rarity] || 0) + 1;
    });
  });
  
  // Check for new rarities in Set 9
  if (set9Analysis.lorcast.rarities) {
    ['epic', 'iconic'].forEach(newRarity => {
      if (set9Analysis.lorcast.rarities[newRarity]) {
        set9Analysis.new_rarities[newRarity] = {
          lorcast_count: set9Analysis.lorcast.rarities[newRarity],
          dreamborn_count: set9Analysis.dreamborn.rarities?.[newRarity] || 0
        };
      }
    });
  }
  
  console.log('Set 9 card counts by source:');
  Object.entries(set9Analysis).forEach(([sourceName, analysis]) => {
    if (analysis.total !== undefined) {
      console.log(`  ${sourceName}: ${analysis.total} cards`);
      if (analysis.rarities && Object.keys(analysis.rarities).length > 0) {
        console.log(`    Rarities: ${Object.entries(analysis.rarities).map(([r, c]) => `${r}(${c})`).join(', ')}`);
      }
    }
  });
  
  if (Object.keys(set9Analysis.new_rarities).length > 0) {
    console.log('\nNew rarities in Set 9:');
    Object.entries(set9Analysis.new_rarities).forEach(([rarity, counts]) => {
      console.log(`  ${rarity}: ${counts.lorcast_count} in Lorcast, ${counts.dreamborn_count} in Dreamborn`);
    });
  }
  
  return set9Analysis;
}

function createComprehensiveMapping() {
  console.log('🔧 Creating comprehensive card mapping across all sources...\n');
  
  const sources = loadSourceData();
  
  // Analyze coverage
  const { coverage, detailed } = analyzeCardCoverage(sources);
  
  // Analyze discrepancies
  const rarityDiscrepancies = analyzeRarityDiscrepancies(sources);
  
  // Set 9 specific analysis
  const set9Analysis = analyzeSet9Specifically(sources);
  
  // Create the comprehensive mapping
  const mapping = {
    metadata: {
      created_at: new Date().toISOString(),
      sources_analyzed: Object.keys(sources),
      total_unique_cards: detailed.length,
      coverage_summary: coverage
    },
    discrepancies: {
      rarity_mismatches: rarityDiscrepancies,
      set9_analysis: set9Analysis
    },
    comprehensive_mapping: {}
  };
  
  // Build the actual mapping
  detailed.forEach(entry => {
    const cardId = entry.card_id;
    const cardMapping = {
      card_id: cardId,
      sources: entry.sources,
      data: {}
    };
    
    // Add data from each source
    if (sources.dreamborn.cards[cardId]) {
      cardMapping.data.dreamborn = {
        name: sources.dreamborn.cards[cardId].name,
        title: sources.dreamborn.cards[cardId].title,
        rarity: sources.dreamborn.cards[cardId].rarity,
        setId: sources.dreamborn.cards[cardId].setId,
        type: sources.dreamborn.cards[cardId].type
      };
    }
    
    if (sources.lorcast.cards[cardId]) {
      cardMapping.data.lorcast = {
        name: sources.lorcast.cards[cardId].name,
        title: sources.lorcast.cards[cardId].title,
        rarity: sources.lorcast.cards[cardId].rarity,
        set_code: sources.lorcast.cards[cardId].set_code,
        type: sources.lorcast.cards[cardId].type,
        cost: sources.lorcast.cards[cardId].cost,
        ink: sources.lorcast.cards[cardId].ink
      };
    }
    
    if (sources.justtcg.cards[cardId]) {
      cardMapping.data.justtcg = {
        name: sources.justtcg.cards[cardId].name,
        tcgplayerId: sources.justtcg.cards[cardId].matched_card_id,
        variant_info: sources.justtcg.cards[cardId].variant_info,
        pricing_variants: Object.keys(sources.justtcg.cards[cardId].variants || {}).length
      };
    }
    
    mapping.comprehensive_mapping[cardId] = cardMapping;
  });
  
  // Save the mapping
  const outputPath = path.join(process.cwd(), 'data', 'COMPREHENSIVE_MAPPING.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
  
  console.log(`\n💾 Comprehensive mapping saved to ${outputPath}`);
  console.log(`📊 Final Summary:`);
  console.log(`   Total unique cards: ${detailed.length}`);
  console.log(`   Cards in all sources: ${coverage.all_sources}`);
  console.log(`   Rarity discrepancies: ${rarityDiscrepancies.length}`);
  console.log(`   Set 9 new rarities: ${Object.keys(set9Analysis.new_rarities).join(', ') || 'none'}`);
  
  return mapping;
}

// Export for use by other scripts
export { createComprehensiveMapping };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createComprehensiveMapping();
}