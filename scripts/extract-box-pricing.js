#!/usr/bin/env node
// Box Pricing Extraction Script
// Extracts booster box and case pricing from JustTCG data

import fs from 'fs';
import path from 'path';

const JUSTTCG_PRICING_FILE = path.join(process.cwd(), 'data', 'JUSTTCG.json');
const BOX_PRICING_FILE = path.join(process.cwd(), 'data', 'BOX_PRICING.json');

function loadJustTcgData() {
  try {
    const data = fs.readFileSync(JUSTTCG_PRICING_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('❌ Error loading JUSTTCG.json:', error.message);
    return null;
  }
}

function extractBoxProducts(justTcgData) {
  const boxProducts = {
    metadata: {
      extracted_at: new Date().toISOString(),
      source: 'justtcg_api',
      total_products: 0
    },
    products: {}
  };
  
  if (!justTcgData.batches) {
    console.log('⚠️  No batch data found in JustTCG file');
    return boxProducts;
  }
  
  // Search through all batches for box/case products
  for (const [batchKey, batchData] of Object.entries(justTcgData.batches)) {
    if (!batchData.raw_cards) continue;
    
    for (const card of batchData.raw_cards) {
      const name = card.name.toLowerCase();
      
      // Identify box/case products
      if (name.includes('booster box') || name.includes('booster case') || 
          name.includes('display case') || name.includes('case')) {
        
        console.log(`📦 Found: ${card.name}`);
        
        const productKey = card.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        
        boxProducts.products[productKey] = {
          name: card.name,
          set: card.set,
          tcgplayerId: card.tcgplayerId,
          product_type: determineProductType(card.name),
          variants: {},
          best_price: null,
          fetched_at: batchData.fetched_at
        };
        
        // Extract pricing variants
        if (card.variants && card.variants.length > 0) {
          for (const variant of card.variants) {
            const variantKey = `${variant.condition || 'Unknown'}_${variant.printing || 'Normal'}`.replace(/\s+/g, '_');
            
            boxProducts.products[productKey].variants[variantKey] = {
              condition: variant.condition || 'Unknown',
              printing: variant.printing || 'Normal',
              price: variant.price || 0,
              priceChange7d: variant.priceChange7d || 0,
              priceChange30d: variant.priceChange30d || 0,
              lastUpdated: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null
            };
          }
          
          // Find best price (prefer Sealed condition, then lowest price)
          const bestVariant = card.variants
            .filter(v => v.price && v.price > 0)
            .sort((a, b) => {
              if (a.condition === 'Sealed' && b.condition !== 'Sealed') return -1;
              if (b.condition === 'Sealed' && a.condition !== 'Sealed') return 1;
              return a.price - b.price;
            })[0];
          
          if (bestVariant) {
            boxProducts.products[productKey].best_price = {
              price: bestVariant.price,
              condition: bestVariant.condition,
              printing: bestVariant.printing
            };
          }
        }
      }
    }
  }
  
  boxProducts.metadata.total_products = Object.keys(boxProducts.products).length;
  return boxProducts;
}

function determineProductType(productName) {
  const name = productName.toLowerCase();
  
  if (name.includes('case')) {
    return 'case'; // Usually 6 boxes
  } else if (name.includes('booster box')) {
    return 'booster_box'; // Usually 24 packs
  } else if (name.includes('display')) {
    return 'display_box'; // Could be booster box
  }
  
  return 'unknown';
}

function calculateEstimatedValues(boxPricing, unifiedPricing) {
  // Load unified pricing data to calculate pack EV
  let unifiedData = {};
  
  try {
    const unifiedFile = path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json');
    unifiedData = JSON.parse(fs.readFileSync(unifiedFile, 'utf8'));
  } catch (error) {
    console.log('⚠️  Could not load unified pricing for EV calculation');
    return boxPricing;
  }
  
  // Calculate Set 9 (Fabled) pack EV
  const set9Cards = Object.entries(unifiedData.cards || {})
    .filter(([cardId, cardData]) => cardId.startsWith('009-'))
    .filter(([cardId, cardData]) => cardData.unified_pricing.base || cardData.unified_pricing.foil);
  
  if (set9Cards.length === 0) {
    console.log('⚠️  No Set 9 cards with pricing found for EV calculation');
    return boxPricing;
  }
  
  console.log(`📊 Calculating EV from ${set9Cards.length} Set 9 cards with pricing...`);
  
  // Simple EV calculation (would need proper rarity odds for accuracy)
  let totalValue = 0;
  let cardCount = 0;
  
  for (const [cardId, cardData] of set9Cards) {
    const basePrice = cardData.unified_pricing.base || 0;
    const foilPrice = cardData.unified_pricing.foil || basePrice;
    
    // Simple average (in reality, foil probability is much lower)
    totalValue += basePrice + (foilPrice * 0.1); // Assume 10% chance of foil
    cardCount++;
  }
  
  const avgCardValue = totalValue / cardCount;
  const estimatedPackEV = avgCardValue * 12; // 12 cards per pack
  const estimatedBoxEV = estimatedPackEV * 24; // 24 packs per box
  const estimatedCaseEV = estimatedBoxEV * 6; // 6 boxes per case
  
  // Add estimated values to box products
  for (const [productKey, product] of Object.entries(boxPricing.products)) {
    let estimatedEV = 0;
    
    if (product.product_type === 'booster_box') {
      estimatedEV = estimatedBoxEV;
    } else if (product.product_type === 'case') {
      estimatedEV = estimatedCaseEV;
    }
    
    if (estimatedEV > 0) {
      product.estimated_value = {
        ev: Math.round(estimatedEV * 100) / 100,
        calculation_method: 'simple_average',
        based_on_cards: cardCount,
        pack_ev: Math.round(estimatedPackEV * 100) / 100,
        calculated_at: new Date().toISOString()
      };
      
      // Calculate value ratio (market price vs estimated value)
      if (product.best_price && product.best_price.price > 0) {
        const valueRatio = estimatedEV / product.best_price.price;
        product.estimated_value.value_ratio = Math.round(valueRatio * 100) / 100;
        product.estimated_value.value_assessment = valueRatio > 1.1 ? 'good_value' :
                                                   valueRatio > 0.9 ? 'fair_value' : 'poor_value';
      }
    }
  }
  
  console.log(`💰 Estimated pack EV: $${Math.round(estimatedPackEV * 100) / 100}`);
  console.log(`📦 Estimated box EV: $${Math.round(estimatedBoxEV * 100) / 100}`);
  console.log(`📦 Estimated case EV: $${Math.round(estimatedCaseEV * 100) / 100}`);
  
  return boxPricing;
}

async function extractBoxPricing() {
  console.log('📦 Extracting box pricing from JustTCG data...\n');
  
  // Load JustTCG data
  const justTcgData = loadJustTcgData();
  if (!justTcgData) {
    return null;
  }
  
  // Extract box products
  let boxPricing = extractBoxProducts(justTcgData);
  console.log(`\n📊 Found ${boxPricing.metadata.total_products} box/case products`);
  
  if (boxPricing.metadata.total_products === 0) {
    console.log('⚠️  No box/case products found in JustTCG data');
    return boxPricing;
  }
  
  // Calculate estimated values
  console.log('\n📊 Calculating estimated values...');
  boxPricing = calculateEstimatedValues(boxPricing);
  
  // Display results
  console.log('\n📦 Box Pricing Summary:');
  for (const [productKey, product] of Object.entries(boxPricing.products)) {
    console.log(`\n🎯 ${product.name}`);
    console.log(`   Type: ${product.product_type}`);
    console.log(`   Best Price: $${product.best_price?.price || 'N/A'} (${product.best_price?.condition || 'N/A'})`);
    
    if (product.estimated_value) {
      console.log(`   Estimated Value: $${product.estimated_value.ev}`);
      console.log(`   Value Ratio: ${product.estimated_value.value_ratio || 'N/A'} (${product.estimated_value.value_assessment || 'unknown'})`);
    }
    
    console.log(`   Variants: ${Object.keys(product.variants).length}`);
    console.log(`   TCGPlayer ID: ${product.tcgplayerId || 'N/A'}`);
  }
  
  // Save box pricing data
  fs.writeFileSync(BOX_PRICING_FILE, JSON.stringify(boxPricing, null, 2));
  console.log(`\n💾 Saved box pricing to ${BOX_PRICING_FILE}`);
  
  return boxPricing;
}

// Export for use by other scripts
export { extractBoxPricing };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  extractBoxPricing().catch(console.error);
}