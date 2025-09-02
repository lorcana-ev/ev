#!/usr/bin/env node
// Verify that Set 009 foil pricing has been fixed

import fs from 'fs';

function verifySet009FoilFix() {
  console.log('✨ Verifying Set 009 foil pricing fix\n');
  
  const pricing = JSON.parse(fs.readFileSync('./data/UNIFIED_PRICING.json', 'utf8'));
  
  let totalSet009 = 0;
  let withFoilPricing = 0;
  let withoutFoilPricing = 0;
  let sampleFoils = [];
  
  Object.entries(pricing.cards).forEach(([cardId, prices]) => {
    if (cardId.startsWith('009-')) {
      totalSet009++;
      
      if (prices.foil !== null && prices.foil !== undefined) {
        withFoilPricing++;
        if (sampleFoils.length < 5) {
          sampleFoils.push({ id: cardId, base: prices.base, foil: prices.foil });
        }
      } else {
        withoutFoilPricing++;
      }
    }
  });
  
  console.log('📊 Set 009 foil pricing results:');
  console.log(`   Total Set 009 cards: ${totalSet009}`);
  console.log(`   Cards with foil pricing: ${withFoilPricing} (${(withFoilPricing/totalSet009*100).toFixed(1)}%)`);
  console.log(`   Cards without foil pricing: ${withoutFoilPricing}`);
  
  console.log('\n🎯 Status:', withFoilPricing > 200 ? '✅ FIXED!' : '❌ Still has issues');
  
  if (sampleFoils.length > 0) {
    console.log('\nSample Set 009 cards with foil pricing:');
    sampleFoils.forEach(sample => {
      console.log(`   ${sample.id}: base=$${sample.base || 'N/A'}, foil=$${sample.foil}`);
    });
  }
  
  return {
    total: totalSet009,
    withFoil: withFoilPricing,
    withoutFoil: withoutFoilPricing,
    percentageFixed: (withFoilPricing/totalSet009*100).toFixed(1)
  };
}

const result = verifySet009FoilFix();
console.log(`\n💾 Fix verification complete: ${result.percentageFixed}% of Set 009 cards now have foil pricing`);