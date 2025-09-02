#!/usr/bin/env node
// Simplify unified pricing to just Dreamborn + JustTCG sources
// Remove all TCGPlayer data and recalculate

import fs from 'fs';
import path from 'path';

function loadUnifiedPricing() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading UNIFIED_PRICING.json:', error.message);
    return null;
  }
}

function calculateTwoSourcePricing(cardData) {
  const sources = {};
  let basePrice = null;
  let foilPrice = null;
  let baseMethod = 'no_data';
  let foilMethod = 'no_data';
  let confidence = 'no_data';
  
  // Only keep Dreamborn and JustTCG sources
  if (cardData.sources.dreamborn) {
    sources.dreamborn = cardData.sources.dreamborn;
  }
  
  if (cardData.sources.justtcg_api) {
    sources.justtcg_api = cardData.sources.justtcg_api;
  }
  
  const sourcesWithBase = Object.values(sources).filter(s => s.base_price !== null && s.base_price > 0);
  const sourcesWithFoil = Object.values(sources).filter(s => s.foil_price !== null && s.foil_price > 0);
  
  // Calculate base price
  if (sourcesWithBase.length === 0) {
    basePrice = null;
    baseMethod = 'no_data';
  } else if (sourcesWithBase.length === 1) {
    basePrice = sourcesWithBase[0].base_price;
    baseMethod = 'single_source';
  } else {
    // Weighted average (JustTCG gets higher weight as it's more current)
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
  if (sourcesWithFoil.length === 0) {
    foilPrice = null;
    foilMethod = 'no_data';
  } else if (sourcesWithFoil.length === 1) {
    foilPrice = sourcesWithFoil[0].foil_price;
    foilMethod = 'single_source';
  } else {
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
  if (baseMethod === 'no_data' && foilMethod === 'no_data') {
    confidence = 'no_data';
  } else if (baseMethod === 'weighted_average' || foilMethod === 'weighted_average') {
    confidence = 'high';
  } else if (sourcesWithBase.length > 0 || sourcesWithFoil.length > 0) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return {
    cardId: cardData.cardId,
    sources: sources,
    unified_pricing: {
      base: basePrice,
      foil: foilPrice,
      confidence: confidence,
      last_calculated: new Date().toISOString(),
      base_method: baseMethod,
      foil_method: foilMethod,
      base_sources: sourcesWithBase.map(s => s.source),
      foil_sources: sourcesWithFoil.map(s => s.source)
    }
  };
}

function simplifyToTwoSources() {
  console.log('🔧 Simplifying pricing to Dreamborn + JustTCG sources only...\n');
  
  const unifiedData = loadUnifiedPricing();
  if (!unifiedData) return;
  
  console.log('📊 Current sources:');
  console.log('   Dreamborn:', unifiedData.metadata.sources.dreamborn);
  console.log('   JustTCG API:', unifiedData.metadata.sources.justtcg_api);
  console.log('   TCGPlayer Manual:', unifiedData.metadata.sources.tcgplayer_manual, '(removing)');
  console.log('   TCGPlayer API:', unifiedData.metadata.sources.tcgplayer_api, '(removing)');
  
  const simplifiedData = {
    metadata: {
      created_at: unifiedData.metadata.created_at,
      last_updated: new Date().toISOString(),
      sources: {
        dreamborn: 0,
        justtcg_api: 0
      },
      version: '2.0.0',
      note: 'Simplified to Dreamborn + JustTCG sources only'
    },
    cards: {}
  };
  
  let totalCards = 0;
  let cardsWithBothSources = 0;
  let cardsWithOnlyDreamborn = 0;
  let cardsWithOnlyJustTcg = 0;
  
  console.log('\n🔄 Recalculating pricing with two sources...\n');
  
  for (const [cardId, cardData] of Object.entries(unifiedData.cards)) {
    const simplified = calculateTwoSourcePricing(cardData);
    
    if (Object.keys(simplified.sources).length > 0) {
      simplifiedData.cards[cardId] = simplified;
      totalCards++;
      
      const hasDreamborn = !!simplified.sources.dreamborn;
      const hasJustTcg = !!simplified.sources.justtcg_api;
      
      if (hasDreamborn && hasJustTcg) {
        cardsWithBothSources++;
      } else if (hasDreamborn) {
        cardsWithOnlyDreamborn++;
      } else if (hasJustTcg) {
        cardsWithOnlyJustTcg++;
      }
      
      if (hasDreamborn) simplifiedData.metadata.sources.dreamborn++;
      if (hasJustTcg) simplifiedData.metadata.sources.justtcg_api++;
    }
  }
  
  // Save the simplified data
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json'),
    JSON.stringify(simplifiedData, null, 2)
  );
  
  console.log('📊 Simplified Pricing Summary:');
  console.log(`   Total cards with pricing: ${totalCards}`);
  console.log(`   Cards with both sources: ${cardsWithBothSources}`);
  console.log(`   Cards with only Dreamborn: ${cardsWithOnlyDreamborn}`);
  console.log(`   Cards with only JustTCG: ${cardsWithOnlyJustTcg}`);
  console.log(`   Dreamborn coverage: ${simplifiedData.metadata.sources.dreamborn} cards`);
  console.log(`   JustTCG coverage: ${simplifiedData.metadata.sources.justtcg_api} cards`);
  
  // Show some examples of the new pricing
  console.log('\n📝 Sample pricing calculations:');
  const sampleCards = Object.entries(simplifiedData.cards).slice(0, 5);
  sampleCards.forEach(([cardId, cardData]) => {
    console.log(`   ${cardId}:`);
    console.log(`     Base: $${cardData.unified_pricing.base || 'N/A'} (${cardData.unified_pricing.base_method})`);
    console.log(`     Foil: $${cardData.unified_pricing.foil || 'N/A'} (${cardData.unified_pricing.foil_method})`);
    console.log(`     Confidence: ${cardData.unified_pricing.confidence}`);
    console.log(`     Sources: ${Object.keys(cardData.sources).join(', ')}`);
  });
  
  console.log('\n💾 Saved simplified UNIFIED_PRICING.json');
  return simplifiedData;
}

// Export for use by other scripts
export { simplifyToTwoSources };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simplifyToTwoSources();
}