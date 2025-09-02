#!/usr/bin/env node
// Simplify unified pricing - remove confidence/weighting complexity
// Just use the most current data available (JustTCG preferred over Dreamborn)

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
    
    let basePrice = null;
    let foilPrice = null;
    
    // Look for Near Mint Normal (base)
    const baseVariants = Object.values(variants).filter(v => 
      v.printing === 'Normal' && v.condition === 'Near Mint' && v.price > 0
    );
    if (baseVariants.length > 0) {
      basePrice = baseVariants[0].price;
    }
    
    // Look for Near Mint foil variants (Holofoil or Cold Foil)
    const foilVariants = Object.values(variants).filter(v => 
      (v.printing === 'Holofoil' || v.printing === 'Cold Foil') && 
      v.condition === 'Near Mint' && v.price > 0
    );
    if (foilVariants.length > 0) {
      foilPrice = foilVariants[0].price;
    }
    
    if (basePrice || foilPrice) {
      pricing[cardId] = {
        base: basePrice,
        foil: foilPrice
      };
    }
  }
  
  return pricing;
}

function simplifyUnifiedPricing() {
  console.log('🔧 Simplifying unified pricing - removing complexity...\n');
  
  const dreambornData = loadDreambornPricing();
  const justTcgData = loadJustTcgData();
  
  if (!dreambornData) {
    console.error('❌ Cannot proceed without Dreamborn pricing data');
    return;
  }
  
  const simplifiedData = {
    metadata: {
      created_at: new Date().toISOString(),
      version: '3.0.0',
      note: 'Simplified pricing: JustTCG preferred, Dreamborn fallback'
    },
    cards: {}
  };
  
  // Extract JustTCG pricing
  let justTcgPricing = {};
  if (justTcgData) {
    console.log('📊 Extracting JustTCG pricing data...');
    justTcgPricing = extractJustTcgPricing(justTcgData);
    console.log(`   Found pricing for ${Object.keys(justTcgPricing).length} cards from JustTCG`);
  }
  
  console.log('\n🔄 Processing all cards with simple priority logic...\n');
  
  // Get all unique card IDs from both sources
  const allCardIds = new Set([
    ...Object.keys(dreambornData),
    ...Object.keys(justTcgPricing)
  ]);
  
  let totalCards = 0;
  let justTcgUsed = 0;
  let dreambornUsed = 0;
  let bothAvailable = 0;
  
  for (const cardId of allCardIds) {
    const dreambornPrice = dreambornData[cardId];
    const justTcgPrice = justTcgPricing[cardId];
    
    let basePrice = null;
    let foilPrice = null;
    
    // Simple priority: JustTCG first, then Dreamborn fallback
    if (justTcgPrice) {
      basePrice = justTcgPrice.base;
      foilPrice = justTcgPrice.foil;
      if (dreambornPrice) bothAvailable++;
      justTcgUsed++;
    } else if (dreambornPrice) {
      basePrice = dreambornPrice.base?.TP?.price || null;
      foilPrice = dreambornPrice.foil?.TP?.price || null;
      dreambornUsed++;
    }
    
    // Only include cards with actual pricing
    if (basePrice || foilPrice) {
      simplifiedData.cards[cardId] = {
        base: basePrice,
        foil: foilPrice
      };
      totalCards++;
    }
  }
  
  // Save the simplified data
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json'),
    JSON.stringify(simplifiedData, null, 2)
  );
  
  console.log('📊 Simplified Pricing Summary:');
  console.log(`   Total cards with pricing: ${totalCards}`);
  console.log(`   Cards using JustTCG data: ${justTcgUsed}`);
  console.log(`   Cards using Dreamborn data: ${dreambornUsed}`);
  console.log(`   Cards with both sources available: ${bothAvailable} (JustTCG used)`);
  
  // Show Set 9 specific coverage
  const set9Cards = Object.keys(simplifiedData.cards).filter(cardId => cardId.startsWith('009-'));
  console.log(`\\n🎯 Set 9 Coverage: ${set9Cards.length} cards`);
  
  // Show sample pricing
  console.log('\\n📝 Sample simplified pricing:');
  const sampleCards = Object.entries(simplifiedData.cards).slice(0, 5);
  sampleCards.forEach(([cardId, prices]) => {
    console.log(`   ${cardId}: Base $${prices.base || 'N/A'}, Foil $${prices.foil || 'N/A'}`);
  });
  
  console.log('\\n💾 Saved simplified UNIFIED_PRICING.json');
  return simplifiedData;
}

// Export for use by other scripts
export { simplifyUnifiedPricing };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simplifyUnifiedPricing();
}