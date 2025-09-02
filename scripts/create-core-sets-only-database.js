#!/usr/bin/env node
// Create clean database with ONLY core sets 01-09
// Remove all promo, special, and non-core sets

import fs from 'fs';

function loadAllSources() {
  const sources = {};
  
  // Load Dreamborn
  try {
    const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'));
    sources.dreamborn = dreambornCards.reduce((acc, card) => {
      acc[card.id] = card;
      return acc;
    }, {});
  } catch (error) {
    sources.dreamborn = {};
  }
  
  // Load Lorcast
  try {
    const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    sources.lorcast = lorcastData.cards;
  } catch (error) {
    sources.lorcast = {};
  }
  
  // Load JustTCG
  try {
    const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
    sources.justtcg = justTcgData.cards;
  } catch (error) {
    sources.justtcg = {};
  }
  
  return sources;
}

function isCoreSetsCard(cardId) {
  // ONLY core sets 001-009
  const coreSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  const setCode = cardId.split('-')[0];
  return coreSets.includes(setCode);
}

function normalizeRarity(rarity) {
  if (!rarity) return null;
  const normalized = String(rarity).toLowerCase().trim();
  // Fix the super rare inconsistency
  if (normalized === 'super rare') {
    return 'super_rare';
  }
  return normalized;
}

function extractSetInfo(cardId) {
  const parts = cardId.split('-');
  if (parts.length >= 2) {
    const setCode = parts[0];
    const cardNumber = parts[1];
    
    const setNames = {
      '001': 'The First Chapter',
      '002': 'Rise of the Floodborn', 
      '003': 'Into the Inklands',
      '004': 'Ursula\'s Return',
      '005': 'Shimmering Skies',
      '006': 'Azurite Sea',
      '007': 'Archazia\'s Island',
      '008': 'Reign of Jafar',
      '009': 'Fabled'
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
  
  const setInfo = extractSetInfo(cardId);
  
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
    
    // Game stats
    lore: lorcastCard?.lore || dreambornCard?.lore || null,
    strength: lorcastCard?.strength || dreambornCard?.strength || null,
    willpower: lorcastCard?.willpower || dreambornCard?.willpower || null,
    
    // Source-specific identifiers
    source_ids: {}
  };
  
  // Add source-specific data
  if (dreambornCard) {
    masterCard.source_ids.dreamborn = {
      id: dreambornCard.id,
      setId: dreambornCard.setId,
      variants: dreambornCard.variants || [],
      inkwell: dreambornCard.inkwell || false
    };
  }
  
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

function analyzeCoreSetDiscrepancies(coreCards) {
  console.log('🔍 Analyzing Core Sets Discrepancies...\n');
  
  const analysis = {
    missing_from_sources: {
      dreamborn: [],
      lorcast: [],
      justtcg: []
    },
    set_coverage: {},
    rarity_distribution: {},
    foil_availability_issues: []
  };
  
  // Analyze each card
  coreCards.forEach(card => {
    const { master_id, sources_available, rarity, set_code } = card;
    
    // Track missing from each source
    if (!sources_available.dreamborn) analysis.missing_from_sources.dreamborn.push(master_id);
    if (!sources_available.lorcast) analysis.missing_from_sources.lorcast.push(master_id);
    if (!sources_available.justtcg) analysis.missing_from_sources.justtcg.push(master_id);
    
    // Set coverage
    if (!analysis.set_coverage[set_code]) {
      analysis.set_coverage[set_code] = {
        total: 0,
        dreamborn: 0,
        lorcast: 0,
        justtcg: 0,
        all_three: 0
      };
    }
    
    analysis.set_coverage[set_code].total++;
    if (sources_available.dreamborn) analysis.set_coverage[set_code].dreamborn++;
    if (sources_available.lorcast) analysis.set_coverage[set_code].lorcast++;
    if (sources_available.justtcg) analysis.set_coverage[set_code].justtcg++;
    if (sources_available.dreamborn && sources_available.lorcast && sources_available.justtcg) {
      analysis.set_coverage[set_code].all_three++;
    }
    
    // Rarity distribution
    if (rarity) {
      if (!analysis.rarity_distribution[rarity]) {
        analysis.rarity_distribution[rarity] = 0;
      }
      analysis.rarity_distribution[rarity]++;
    }
    
    // Check for foil availability issues (Fabled common foils)
    if (set_code === '009' && rarity === 'common' && sources_available.dreamborn) {
      const dreambornVariants = card.source_ids.dreamborn?.variants || [];
      const hasNoFoil = !dreambornVariants.includes('foil');
      if (hasNoFoil) {
        analysis.foil_availability_issues.push({
          card_id: master_id,
          name: card.name,
          issue: 'Set 009 common missing foil variant'
        });
      }
    }
  });
  
  return analysis;
}

function createCoreSetsOnlyDatabase() {
  console.log('🚀 Creating Core Sets Only Database (001-009)\n');
  
  const sources = loadAllSources();
  
  // Get all card IDs and filter to core sets only
  const allCardIds = new Set();
  Object.values(sources).forEach(source => {
    Object.keys(source).forEach(id => {
      if (isCoreSetsCard(id)) {
        allCardIds.add(id);
      }
    });
  });
  
  const coreCardIds = Array.from(allCardIds).sort();
  console.log(`📊 Found ${coreCardIds.length} core set cards across all sources\n`);
  
  // Create master cards for core sets only
  console.log('🔧 Building core set master cards...');
  const coreCards = coreCardIds.map(cardId => createMasterCard(cardId, sources));
  
  // Analyze discrepancies
  const discrepancies = analyzeCoreSetDiscrepancies(coreCards);
  
  // Build final database
  const coreDatabase = {
    metadata: {
      created_at: new Date().toISOString(),
      version: '3.0_core_sets_only',
      scope: 'Core sets 001-009 ONLY',
      total_cards: coreCards.length,
      sources: {
        dreamborn: coreCards.filter(c => c.sources_available.dreamborn).length,
        lorcast: coreCards.filter(c => c.sources_available.lorcast).length,
        justtcg: coreCards.filter(c => c.sources_available.justtcg).length
      },
      coverage_summary: {
        all_three_sources: coreCards.filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && c.sources_available.justtcg).length,
        dreamborn_lorcast: coreCards.filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && !c.sources_available.justtcg).length,
        any_two_sources: coreCards.filter(c => (c.sources_available.dreamborn ? 1 : 0) + (c.sources_available.lorcast ? 1 : 0) + (c.sources_available.justtcg ? 1 : 0) >= 2).length
      }
    },
    core_sets_analysis: discrepancies,
    playable_cards: coreCards.reduce((acc, card) => {
      acc[card.master_id] = card;
      return acc;
    }, {})
  };
  
  // Save core sets database
  fs.writeFileSync('./data/CORE_SETS_ONLY_DATABASE.json', JSON.stringify(coreDatabase, null, 2));
  
  // Print detailed analysis
  console.log('💾 Core Sets Only Database created!\n');
  console.log('📊 Summary:');
  console.log(`   Total core set cards: ${coreDatabase.metadata.total_cards}`);
  console.log(`   Cards in all 3 sources: ${coreDatabase.metadata.coverage_summary.all_three_sources}`);
  console.log(`   Cards in any 2+ sources: ${coreDatabase.metadata.coverage_summary.any_two_sources}`);
  
  console.log('\n📈 Core Set Coverage:');
  Object.entries(discrepancies.set_coverage).forEach(([setCode, coverage]) => {
    const dPct = (coverage.dreamborn / coverage.total * 100).toFixed(0);
    const lPct = (coverage.lorcast / coverage.total * 100).toFixed(0);
    const jPct = (coverage.justtcg / coverage.total * 100).toFixed(0);
    const allPct = (coverage.all_three / coverage.total * 100).toFixed(0);
    console.log(`   ${setCode}: ${coverage.total} cards - D:${dPct}% L:${lPct}% J:${jPct}% | All 3: ${allPct}%`);
  });
  
  console.log('\n🎯 Rarity Distribution:');
  Object.entries(discrepancies.rarity_distribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([rarity, count]) => {
      console.log(`   ${rarity}: ${count} cards`);
    });
  
  console.log('\n📋 Missing from Sources:');
  console.log(`   Missing from Dreamborn: ${discrepancies.missing_from_sources.dreamborn.length}`);
  console.log(`   Missing from Lorcast: ${discrepancies.missing_from_sources.lorcast.length}`);
  console.log(`   Missing from JustTCG: ${discrepancies.missing_from_sources.justtcg.length}`);
  
  if (discrepancies.foil_availability_issues.length > 0) {
    console.log(`\n✨ Foil Availability Issues: ${discrepancies.foil_availability_issues.length}`);
    console.log(`   Set 009 commons missing foil variants: ${discrepancies.foil_availability_issues.length}`);
  }
  
  return coreDatabase;
}

// Export for use by other scripts
export { createCoreSetsOnlyDatabase };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createCoreSetsOnlyDatabase();
}