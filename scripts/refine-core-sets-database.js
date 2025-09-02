#!/usr/bin/env node
// Refine master database to focus on core sets 1-9 only
// Normalize rarity inconsistencies and preserve relevant pricing data

import fs from 'fs';

function loadMasterDatabase() {
  try {
    return JSON.parse(fs.readFileSync('./data/MASTER_CARD_DATABASE.json', 'utf8'));
  } catch (error) {
    console.error('❌ Could not load master database:', error.message);
    return null;
  }
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

function isCoreSetsCard(setCode) {
  // Core sets 1-9 only
  const coreSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  return coreSets.includes(setCode);
}

function isBoxOrPackProduct(cardId, cardData) {
  // Identify box/pack products that should be preserved for market pricing
  const name = cardData.name?.toLowerCase() || '';
  
  // Look for actual sealed products (not character names containing these words)
  return (name.includes('booster pack') || 
          name.includes('booster box') || 
          name.includes('starter deck') ||
          name.includes('deck box') ||
          name.includes('collection')) &&
         // Exclude character cards that happen to have these words in their names
         !name.includes('leader') &&
         !name.includes('elder') &&
         !name.includes('full deck') // This is a character name
}

function refineCoreSeDatabase() {
  console.log('🔧 Refining Master Database for Core Sets 1-9\n');
  
  const masterDb = loadMasterDatabase();
  if (!masterDb) return;
  
  console.log(`📊 Original database: ${masterDb.metadata.total_cards} cards`);
  
  // Filter cards to core sets only, plus relevant box/pack products
  const refinedCards = {};
  const preservedProducts = {};
  let coreSetCards = 0;
  let preservedProductCount = 0;
  
  Object.entries(masterDb.cards).forEach(([cardId, cardData]) => {
    if (isCoreSetsCard(cardData.set_code)) {
      // Normalize rarity for core set cards
      const normalizedCard = {
        ...cardData,
        rarity: normalizeRarity(cardData.rarity)
      };
      refinedCards[cardId] = normalizedCard;
      coreSetCards++;
    } else if (isBoxOrPackProduct(cardId, cardData)) {
      // Preserve box/pack products for market pricing comparison
      const productCard = {
        ...cardData,
        rarity: normalizeRarity(cardData.rarity),
        product_type: 'sealed_product' // Flag as non-playable
      };
      preservedProducts[cardId] = productCard;
      preservedProductCount++;
    }
  });
  
  console.log(`📦 Filtered to core sets: ${coreSetCards} cards`);
  console.log(`📦 Preserved products: ${preservedProductCount} items`);
  
  // Analyze rarity normalization changes
  console.log('\n🔧 Rarity Normalization Changes:');
  let rarityChanges = 0;
  Object.values(refinedCards).forEach(card => {
    const originalCard = masterDb.cards[card.master_id];
    if (originalCard.rarity !== card.rarity) {
      if (rarityChanges < 5) {
        console.log(`   ${card.master_id}: "${originalCard.rarity}" → "${card.rarity}"`);
      }
      rarityChanges++;
    }
  });
  console.log(`   Total rarity normalizations: ${rarityChanges}`);
  
  // Analyze core sets coverage
  console.log('\n📊 Core Sets Coverage Analysis:');
  const setCoverage = {};
  Object.values(refinedCards).forEach(card => {
    const setCode = card.set_code;
    if (!setCoverage[setCode]) {
      setCoverage[setCode] = {
        total: 0,
        dreamborn: 0,
        lorcast: 0,
        justtcg: 0,
        all_three: 0
      };
    }
    setCoverage[setCode].total++;
    if (card.sources_available.dreamborn) setCoverage[setCode].dreamborn++;
    if (card.sources_available.lorcast) setCoverage[setCode].lorcast++;
    if (card.sources_available.justtcg) setCoverage[setCode].justtcg++;
    if (card.sources_available.dreamborn && card.sources_available.lorcast && card.sources_available.justtcg) {
      setCoverage[setCode].all_three++;
    }
  });
  
  Object.entries(setCoverage).forEach(([setCode, coverage]) => {
    const dPct = (coverage.dreamborn / coverage.total * 100).toFixed(0);
    const lPct = (coverage.lorcast / coverage.total * 100).toFixed(0);
    const jPct = (coverage.justtcg / coverage.total * 100).toFixed(0);
    const allPct = (coverage.all_three / coverage.total * 100).toFixed(0);
    console.log(`   ${setCode}: ${coverage.total} cards - D:${dPct}% L:${lPct}% J:${jPct}% | All 3: ${allPct}%`);
  });
  
  // Identify high-value missing cards for investigation
  console.log('\n🎯 High-Value Cards Missing from JustTCG (Sets 006, 007, 009):');
  const highValueMissing = Object.values(refinedCards).filter(card => 
    ['006', '007', '009'].includes(card.set_code) &&
    (card.sources_available.dreamborn || card.sources_available.lorcast) &&
    !card.sources_available.justtcg &&
    ['enchanted', 'super_rare', 'legendary'].includes(card.rarity)
  );
  
  highValueMissing.forEach(card => {
    console.log(`   ${card.master_id}: ${card.name} (${card.rarity})`);
  });
  
  // Create refined database
  const refinedDatabase = {
    metadata: {
      created_at: new Date().toISOString(),
      version: '2.0_core_sets_focused',
      scope: 'Core sets 1-9 plus sealed products for market pricing',
      total_playable_cards: coreSetCards,
      preserved_products: preservedProductCount,
      rarity_normalizations: rarityChanges,
      sources: {
        dreamborn: Object.values(refinedCards).filter(c => c.sources_available.dreamborn).length,
        lorcast: Object.values(refinedCards).filter(c => c.sources_available.lorcast).length,
        justtcg: Object.values(refinedCards).filter(c => c.sources_available.justtcg).length
      },
      coverage_summary: {
        all_three_sources: Object.values(refinedCards).filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && c.sources_available.justtcg).length
      }
    },
    investigation_notes: {
      justtcg_missing_high_value: {
        enchanted_cards: highValueMissing.filter(c => c.rarity === 'enchanted').map(c => c.master_id),
        super_rare_cards: highValueMissing.filter(c => c.rarity === 'super_rare').map(c => c.master_id),
        investigation_needed: 'When JustTCG API requests are available, investigate why these high-value cards are missing',
        potential_causes: [
          'API pagination issues',
          'Rate limiting during fetch',
          'Different card numbering schemes',
          'Enchanted cards in separate endpoints'
        ]
      }
    },
    core_sets: setCoverage,
    playable_cards: refinedCards,
    market_products: preservedProducts
  };
  
  // Save refined database
  fs.writeFileSync('./data/CORE_SETS_DATABASE.json', JSON.stringify(refinedDatabase, null, 2));
  
  console.log('\n💾 Refined database saved to CORE_SETS_DATABASE.json');
  console.log(`📊 Final Summary:`);
  console.log(`   Playable cards (core sets): ${coreSetCards}`);
  console.log(`   Market products preserved: ${preservedProductCount}`);
  console.log(`   Three-source coverage: ${refinedDatabase.metadata.coverage_summary.all_three_sources} cards`);
  console.log(`   High-value investigation needed: ${highValueMissing.length} cards`);
  
  return refinedDatabase;
}

// Export for use by other scripts
export { refineCoreSeDatabase };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  refineCoreSeDatabase();
}