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

// Note: EV calculation is handled by calculate-realistic-ev.js
// This script only extracts pricing data from JustTCG

async function extractBoxPricing() {
  console.log('📦 Extracting box pricing from JustTCG data...\n');
  
  // Load JustTCG data
  const justTcgData = loadJustTcgData();
  if (!justTcgData) {
    return null;
  }
  
  // Extract box products
  const boxPricing = extractBoxProducts(justTcgData);
  console.log(`\n📊 Found ${boxPricing.metadata.total_products} box/case products`);

  if (boxPricing.metadata.total_products === 0) {
    console.log('⚠️  No box/case products found in JustTCG data');
    return boxPricing;
  }

  // Display results
  console.log('\n📦 Box Pricing Summary:');
  for (const [productKey, product] of Object.entries(boxPricing.products)) {
    console.log(`\n🎯 ${product.name}`);
    console.log(`   Type: ${product.product_type}`);
    console.log(`   Best Price: $${product.best_price?.price || 'N/A'} (${product.best_price?.condition || 'N/A'})`);
    console.log(`   Variants: ${Object.keys(product.variants).length}`);
    console.log(`   TCGPlayer ID: ${product.tcgplayerId || 'N/A'}`);
  }

  console.log('\n💡 Note: For EV calculations, use scripts/calculate-realistic-ev.js');
  
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