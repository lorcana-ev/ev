#!/usr/bin/env node
// Realistic EV Calculator
// Uses proper rarity odds for accurate Expected Value calculations

import fs from 'fs';
import path from 'path';

// Lorcana pack structure (12 cards per pack)
const PACK_STRUCTURE = {
  common: 6,        // 6 common slots
  uncommon: 3,      // 3 uncommon slots  
  rare_plus: 2,     // 2 rare-or-higher slots
  foil: 1          // 1 foil slot (any rarity)
};

// Set 9 rarity odds (based on standard Lorcana distributions)
const RARITY_ODDS = {
  common: {
    base: 0.50,      // 50% chance in rare+ slot (commons can appear)
    foil: 0.60       // 60% foil distribution to commons
  },
  uncommon: {
    base: 0.30,      // 30% in rare+ slot
    foil: 0.25       // 25% foil distribution
  },
  rare: {
    base: 0.15,      // 15% in rare+ slot
    foil: 0.10       // 10% foil distribution
  },
  super_rare: {
    base: 0.040,     // 4% in rare+ slot
    foil: 0.03       // 3% foil distribution
  },
  legendary: {
    base: 0.008,     // 0.8% in rare+ slot
    foil: 0.015      // 1.5% foil distribution (higher than base due to chase factor)
  },
  enchanted: {
    base: 0.002,     // 0.2% in rare+ slot
    foil: 1.0        // All enchanted are foil
  }
};

function loadPricingData() {
  const unifiedFile = path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json');
  const cardsFile = path.join(process.cwd(), 'data', 'cards-formatted.json');
  
  let unifiedData = {};
  let cardsData = [];
  
  try {
    unifiedData = JSON.parse(fs.readFileSync(unifiedFile, 'utf8'));
  } catch (error) {
    console.log('❌ Error loading UNIFIED_PRICING.json:', error.message);
    return null;
  }
  
  try {
    cardsData = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
  } catch (error) {
    console.log('❌ Error loading cards-formatted.json:', error.message);
    return null;
  }
  
  return { unifiedData, cardsData };
}

function categorizeSet9Cards(unifiedData, cardsData) {
  const set9Cards = cardsData.filter(card => card.setId === '009');
  const cardsByRarity = {
    common: [],
    uncommon: [],
    rare: [],
    super_rare: [],
    legendary: [],
    enchanted: []
  };
  
  for (const card of set9Cards) {
    const pricingData = unifiedData.cards[card.id];
    const rarity = card.rarity?.toLowerCase().replace(/\s+/g, '_') || 'unknown';
    
    if (cardsByRarity[rarity] && pricingData) {
      const basePrice = pricingData.unified_pricing?.base || 0;
      const foilPrice = pricingData.unified_pricing?.foil || basePrice || 0;
      
      cardsByRarity[rarity].push({
        cardId: card.id,
        name: `${card.name} - ${card.title}`,
        rarity: rarity,
        basePrice: basePrice,
        foilPrice: foilPrice,
        confidence: pricingData.unified_pricing?.confidence || 'low'
      });
    }
  }
  
  return cardsByRarity;
}

function calculateRarityAverages(cardsByRarity) {
  const rarityAverages = {};
  
  for (const [rarity, cards] of Object.entries(cardsByRarity)) {
    if (cards.length === 0) {
      rarityAverages[rarity] = { base: 0, foil: 0, count: 0 };
      continue;
    }
    
    // Calculate averages, excluding extreme outliers
    const basePrices = cards.map(c => c.basePrice).filter(p => p > 0);
    const foilPrices = cards.map(c => c.foilPrice).filter(p => p > 0);
    
    // Use trimmed mean to reduce impact of extreme values
    const trimmedBase = trimmedMean(basePrices, 0.1); // Remove top/bottom 10%
    const trimmedFoil = trimmedMean(foilPrices, 0.1);
    
    rarityAverages[rarity] = {
      base: trimmedBase,
      foil: trimmedFoil,
      count: cards.length,
      raw_base_avg: basePrices.reduce((a, b) => a + b, 0) / basePrices.length || 0,
      raw_foil_avg: foilPrices.reduce((a, b) => a + b, 0) / foilPrices.length || 0
    };
  }
  
  return rarityAverages;
}

function trimmedMean(values, trimPercent = 0.1) {
  if (values.length === 0) return 0;
  if (values.length <= 4) return values.reduce((a, b) => a + b, 0) / values.length;
  
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimPercent);
  const trimmed = sorted.slice(trimCount, -trimCount || undefined);
  
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function calculatePackEV(rarityAverages) {
  console.log('📊 Calculating realistic pack EV with rarity odds...\n');
  
  let totalPackEV = 0;
  const breakdown = {};
  
  for (const [rarity, odds] of Object.entries(RARITY_ODDS)) {
    const avgPrices = rarityAverages[rarity];
    if (!avgPrices) continue;
    
    // Base card EV contribution
    const baseSlotContribution = odds.base * avgPrices.base;
    
    // Foil card EV contribution
    const foilSlotContribution = odds.foil * avgPrices.foil;
    
    // Total contribution from this rarity
    const rarityEV = (baseSlotContribution * PACK_STRUCTURE.rare_plus) + 
                     (foilSlotContribution * PACK_STRUCTURE.foil);
    
    breakdown[rarity] = {
      base_avg_price: avgPrices.base,
      foil_avg_price: avgPrices.foil,
      base_slot_contribution: Math.round(baseSlotContribution * 100) / 100,
      foil_slot_contribution: Math.round(foilSlotContribution * 100) / 100,
      total_ev_contribution: Math.round(rarityEV * 100) / 100,
      card_count: avgPrices.count
    };
    
    totalPackEV += rarityEV;
    
    console.log(`${rarity.charAt(0).toUpperCase() + rarity.slice(1)}:`);
    console.log(`   Cards: ${avgPrices.count}`);
    console.log(`   Avg Base: $${avgPrices.base.toFixed(2)}, Foil: $${avgPrices.foil.toFixed(2)}`);
    console.log(`   EV Contribution: $${breakdown[rarity].total_ev_contribution}`);
  }
  
  // Add guaranteed commons and uncommons (simplified)
  const commonEV = PACK_STRUCTURE.common * (rarityAverages.common?.base || 0.05);
  const uncommonEV = PACK_STRUCTURE.uncommon * (rarityAverages.uncommon?.base || 0.15);
  
  totalPackEV += commonEV + uncommonEV;
  
  console.log(`\nGuaranteed slots:`);
  console.log(`   Commons (6x): $${Math.round(commonEV * 100) / 100}`);
  console.log(`   Uncommons (3x): $${Math.round(uncommonEV * 100) / 100}`);
  
  console.log(`\n💰 Total Pack EV: $${Math.round(totalPackEV * 100) / 100}`);
  
  return {
    pack_ev: Math.round(totalPackEV * 100) / 100,
    box_ev: Math.round(totalPackEV * 24 * 100) / 100,      // 24 packs per box
    case_ev: Math.round(totalPackEV * 24 * 6 * 100) / 100, // 6 boxes per case
    breakdown: breakdown,
    methodology: 'rarity_weighted_trimmed_mean',
    calculated_at: new Date().toISOString()
  };
}

function updateBoxPricingWithRealisticEV(evData) {
  const boxPricingFile = path.join(process.cwd(), 'data', 'BOX_PRICING.json');
  
  try {
    const boxPricing = JSON.parse(fs.readFileSync(boxPricingFile, 'utf8'));
    
    // Update box products with realistic EV
    for (const [productKey, product] of Object.entries(boxPricing.products)) {
      let realisticEV = 0;
      
      if (product.product_type === 'booster_box') {
        realisticEV = evData.box_ev;
      } else if (product.product_type === 'case') {
        realisticEV = evData.case_ev;
      }
      
      if (realisticEV > 0) {
        product.realistic_estimated_value = {
          ev: realisticEV,
          pack_ev: evData.pack_ev,
          methodology: evData.methodology,
          calculated_at: evData.calculated_at,
          breakdown: evData.breakdown
        };
        
        // Calculate realistic value ratio
        if (product.best_price && product.best_price.price > 0) {
          const valueRatio = realisticEV / product.best_price.price;
          product.realistic_estimated_value.value_ratio = Math.round(valueRatio * 100) / 100;
          product.realistic_estimated_value.value_assessment = 
            valueRatio > 1.2 ? 'excellent_value' :
            valueRatio > 1.0 ? 'good_value' :
            valueRatio > 0.8 ? 'fair_value' : 'poor_value';
        }
      }
    }
    
    // Update metadata
    boxPricing.metadata.last_updated = new Date().toISOString();
    boxPricing.metadata.ev_methodology = 'rarity_weighted_realistic';
    
    // Save updated file
    fs.writeFileSync(boxPricingFile, JSON.stringify(boxPricing, null, 2));
    console.log(`\n✅ Updated box pricing with realistic EV calculations`);
    
    // Display updated results
    console.log('\n📦 Updated Box Pricing Summary:');
    for (const [productKey, product] of Object.entries(boxPricing.products)) {
      console.log(`\n🎯 ${product.name}`);
      console.log(`   Market Price: $${product.best_price?.price || 'N/A'}`);
      console.log(`   Realistic EV: $${product.realistic_estimated_value?.ev || 'N/A'}`);
      console.log(`   Value Ratio: ${product.realistic_estimated_value?.value_ratio || 'N/A'}`);
      console.log(`   Assessment: ${product.realistic_estimated_value?.value_assessment || 'unknown'}`);
    }
    
    return boxPricing;
    
  } catch (error) {
    console.log('❌ Error updating box pricing:', error.message);
    return null;
  }
}

async function calculateRealisticEV() {
  console.log('🧮 Calculating realistic Set 9 (Fabled) EV...\n');
  
  // Load data
  const data = loadPricingData();
  if (!data) return;
  
  const { unifiedData, cardsData } = data;
  
  // Categorize cards by rarity
  console.log('📊 Categorizing Set 9 cards by rarity...');
  const cardsByRarity = categorizeSet9Cards(unifiedData, cardsData);
  
  // Show rarity distribution
  for (const [rarity, cards] of Object.entries(cardsByRarity)) {
    console.log(`   ${rarity}: ${cards.length} cards with pricing`);
  }
  
  // Calculate rarity averages
  console.log('\n📊 Calculating rarity price averages...');
  const rarityAverages = calculateRarityAverages(cardsByRarity);
  
  // Calculate realistic pack EV
  const evData = calculatePackEV(rarityAverages);
  
  // Update box pricing
  console.log('\n📦 Updating box pricing with realistic EV...');
  const updatedBoxPricing = updateBoxPricingWithRealisticEV(evData);
  
  return { evData, rarityAverages, updatedBoxPricing };
}

// Export for use by other scripts
export { calculateRealisticEV };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  calculateRealisticEV().catch(console.error);
}