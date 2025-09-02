#!/usr/bin/env node
// Rebuild unified pricing from scratch using only Dreamborn + JustTCG
// Skip TCGPlayer entirely

import fs from 'fs';
import path from 'path';

function loadDreambornPricing() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'USD.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading USD.json:', error.message);
    return null;
  }
}

function loadJustTcgData() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'JUSTTCG.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading JUSTTCG.json:', error.message);
    return null;
  }
}

function extractJustTcgPricing(justTcgData) {
  const pricing = {};
  
  for (const [cardId, cardData] of Object.entries(justTcgData.cards)) {
    const variants = cardData.variants || {};
    
    // Extract base and foil pricing
    let basePrice = null;
    let foilPrice = null;
    
    // Look for Near Mint Normal (base)
    const nearMintNormal = variants['Near_Mint_Normal'] || variants['Near_Mint_Holofoil'];
    if (nearMintNormal && nearMintNormal.price > 0) {
      if (nearMintNormal.printing === 'Normal') {
        basePrice = nearMintNormal.price;
      } else if (nearMintNormal.printing === 'Holofoil') {
        foilPrice = nearMintNormal.price;
      }
    }
    
    // Look for foil variants
    const foilVariants = Object.values(variants).filter(v => 
      v.printing === 'Holofoil' && v.condition === 'Near Mint' && v.price > 0
    );
    
    if (foilVariants.length > 0) {
      foilPrice = foilVariants[0].price;
    }
    
    // Look for base variants if we haven't found one
    if (!basePrice) {
      const baseVariants = Object.values(variants).filter(v => 
        v.printing === 'Normal' && v.condition === 'Near Mint' && v.price > 0
      );
      
      if (baseVariants.length > 0) {
        basePrice = baseVariants[0].price;
      }
    }
    
    if (basePrice || foilPrice) {
      pricing[cardId] = {
        base_price: basePrice,
        foil_price: foilPrice,
        source: 'justtcg_api',
        reliability: 'high',
        last_updated: cardData.fetched_at,
        variant_count: Object.keys(variants).length
      };
    }
  }
  
  return pricing;
}

function buildUnifiedPricing() {
  console.log('🔧 Rebuilding unified pricing from Dreamborn + JustTCG sources...\n');
  
  const dreambornData = loadDreambornPricing();
  const justTcgData = loadJustTcgData();
  
  if (!dreambornData) {
    console.error('❌ Cannot proceed without Dreamborn pricing data');
    return;
  }
  
  const unifiedData = {
    metadata: {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      sources: {
        dreamborn: 0,
        justtcg_api: 0
      },
      version: '2.0.0',
      note: 'Rebuilt with Dreamborn + JustTCG sources only'
    },
    cards: {}
  };
  
  // Extract JustTCG pricing
  let justTcgPricing = {};
  if (justTcgData) {
    console.log('📊 Extracting JustTCG pricing data...');
    justTcgPricing = extractJustTcgPricing(justTcgData);
    console.log(`   Found pricing for ${Object.keys(justTcgPricing).length} cards`);
  } else {
    console.log('⚠️  No JustTCG data found, using Dreamborn only');
  }
  
  console.log('\n🔄 Processing all cards...\n');
  
  // Get all unique card IDs from both sources
  const allCardIds = new Set([
    ...Object.keys(dreambornData),
    ...Object.keys(justTcgPricing)
  ]);
  
  let cardsWithBothSources = 0;
  let cardsWithOnlyDreamborn = 0;
  let cardsWithOnlyJustTcg = 0;
  
  for (const cardId of allCardIds) {
    const dreambornPrice = dreambornData[cardId];
    const justTcgPrice = justTcgPricing[cardId];
    
    if (!dreambornPrice && !justTcgPrice) continue;
    
    const cardData = {
      cardId: cardId,
      sources: {},
      unified_pricing: {}
    };
    
    // Add Dreamborn data
    if (dreambornPrice && (dreambornPrice.base?.TP?.price > 0 || dreambornPrice.foil?.TP?.price > 0)) {
      cardData.sources.dreamborn = {
        base_price: dreambornPrice.base?.TP?.price || null,
        foil_price: dreambornPrice.foil?.TP?.price || null,
        source: 'dreamborn_original',
        reliability: 'medium'
      };
      unifiedData.metadata.sources.dreamborn++;
    }
    
    // Add JustTCG data
    if (justTcgPrice) {
      cardData.sources.justtcg_api = justTcgPrice;
      unifiedData.metadata.sources.justtcg_api++;
    }
    
    // Calculate unified pricing
    const sourcesWithBase = Object.values(cardData.sources).filter(s => s.base_price && s.base_price > 0);
    const sourcesWithFoil = Object.values(cardData.sources).filter(s => s.foil_price && s.foil_price > 0);
    
    let basePrice = null;
    let foilPrice = null;
    let baseMethod = 'no_data';
    let foilMethod = 'no_data';
    let confidence = 'no_data';
    
    // Calculate base price
    if (sourcesWithBase.length === 1) {
      basePrice = sourcesWithBase[0].base_price;
      baseMethod = 'single_source';
    } else if (sourcesWithBase.length > 1) {
      // Weighted average (JustTCG gets 2x weight)
      let totalWeight = 0;
      let weightedSum = 0;
      
      sourcesWithBase.forEach(source => {
        const weight = source.source === 'justtcg_api' ? 2.0 : 1.0;
        weightedSum += source.base_price * weight;
        totalWeight += weight;
      });
      
      basePrice = Math.round((weightedSum / totalWeight) * 100) / 100;
      baseMethod = 'weighted_average';
    }
    
    // Calculate foil price (similar logic)
    if (sourcesWithFoil.length === 1) {
      foilPrice = sourcesWithFoil[0].foil_price;
      foilMethod = 'single_source';
    } else if (sourcesWithFoil.length > 1) {
      let totalWeight = 0;
      let weightedSum = 0;
      
      sourcesWithFoil.forEach(source => {
        const weight = source.source === 'justtcg_api' ? 2.0 : 1.0;
        weightedSum += source.foil_price * weight;
        totalWeight += weight;
      });
      
      foilPrice = Math.round((weightedSum / totalWeight) * 100) / 100;
      foilMethod = 'weighted_average';
    }
    
    // Determine confidence
    const hasBothSources = Object.keys(cardData.sources).length > 1;
    const hasJustTcg = !!cardData.sources.justtcg_api;
    
    if (baseMethod === 'weighted_average' || foilMethod === 'weighted_average') {
      confidence = 'high';
    } else if (hasJustTcg) {
      confidence = 'high';
    } else if (baseMethod !== 'no_data' || foilMethod !== 'no_data') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    cardData.unified_pricing = {
      base: basePrice,
      foil: foilPrice,
      confidence: confidence,
      last_calculated: new Date().toISOString(),
      base_method: baseMethod,
      foil_method: foilMethod,
      base_sources: sourcesWithBase.map(s => s.source),
      foil_sources: sourcesWithFoil.map(s => s.source)
    };
    
    unifiedData.cards[cardId] = cardData;
    
    // Count source combinations
    if (hasBothSources) {
      cardsWithBothSources++;
    } else if (cardData.sources.dreamborn) {
      cardsWithOnlyDreamborn++;
    } else if (cardData.sources.justtcg_api) {
      cardsWithOnlyJustTcg++;
    }
  }
  
  // Save the unified data
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json'),
    JSON.stringify(unifiedData, null, 2)
  );
  
  console.log('📊 Rebuilt Unified Pricing Summary:');
  console.log(`   Total cards with pricing: ${Object.keys(unifiedData.cards).length}`);
  console.log(`   Cards with both sources: ${cardsWithBothSources}`);
  console.log(`   Cards with only Dreamborn: ${cardsWithOnlyDreamborn}`);
  console.log(`   Cards with only JustTCG: ${cardsWithOnlyJustTcg}`);
  console.log(`   Dreamborn coverage: ${unifiedData.metadata.sources.dreamborn} cards`);
  console.log(`   JustTCG coverage: ${unifiedData.metadata.sources.justtcg_api} cards`);
  
  // Show Set 9 specific coverage
  const set9Cards = Object.keys(unifiedData.cards).filter(cardId => cardId.startsWith('009-'));
  const set9WithJustTcg = set9Cards.filter(cardId => unifiedData.cards[cardId].sources.justtcg_api);
  console.log(`\\n🎯 Set 9 Coverage:`)
  console.log(`   Total Set 9 cards with pricing: ${set9Cards.length}`);
  console.log(`   Set 9 cards with JustTCG data: ${set9WithJustTcg.length}`);
  
  // Show some examples
  console.log('\\n📝 Sample Set 9 cards with JustTCG data:');
  set9WithJustTcg.slice(0, 5).forEach(cardId => {
    const cardData = unifiedData.cards[cardId];
    console.log(`   ${cardId}:`);
    console.log(`     Base: $${cardData.unified_pricing.base || 'N/A'} (${cardData.unified_pricing.base_method})`);
    console.log(`     Foil: $${cardData.unified_pricing.foil || 'N/A'} (${cardData.unified_pricing.foil_method})`);
    console.log(`     Confidence: ${cardData.unified_pricing.confidence}`);
  });
  
  console.log('\\n💾 Saved rebuilt UNIFIED_PRICING.json');
  return unifiedData;
}

// Export for use by other scripts
export { buildUnifiedPricing };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildUnifiedPricing();
}