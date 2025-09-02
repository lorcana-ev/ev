#!/usr/bin/env node
// Investigate Fabled (Set 009) foil commons issue

import fs from 'fs';

function investigateFabledFoils() {
  console.log('✨ Investigating Fabled (Set 009) Foil Commons Issue\n');
  
  // Load all sources
  const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'))
    .reduce((acc, card) => { acc[card.id] = card; return acc; }, {});
  
  const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
  const lorcastCards = lorcastData.cards;
  
  const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  const justTcgCards = justTcgData.cards;
  
  // Load unified pricing to see current state
  let unifiedPricing = {};
  try {
    unifiedPricing = JSON.parse(fs.readFileSync('./data/UNIFIED_PRICING.json', 'utf8')).cards;
  } catch (error) {
    console.log('⚠️  Could not load unified pricing');
  }
  
  // Get all Set 009 common cards
  const set009Commons = [];
  
  Object.keys(dreambornCards).forEach(cardId => {
    if (cardId.startsWith('009-')) {
      const card = dreambornCards[cardId];
      if (card.rarity === 'common') {
        set009Commons.push({
          id: cardId,
          name: card.name,
          dreambornVariants: card.variants || [],
          lorcastFoilAvailable: lorcastCards[cardId]?.foil_available || false,
          unifiedPricing: unifiedPricing[cardId] || null
        });
      }
    }
  });
  
  console.log(`📊 Found ${set009Commons.length} common cards in Set 009 (Fabled)`);
  
  // Analyze foil availability
  let noFoilCount = 0;
  let hasFoilCount = 0;
  let foilIssues = [];
  
  set009Commons.forEach(card => {
    const hasBaseFoil = card.dreambornVariants.includes('foil');
    const hasLorcastFoil = card.lorcastFoilAvailable;
    const hasUnifiedFoil = card.unifiedPricing?.foil !== null;
    
    if (!hasBaseFoil) {
      noFoilCount++;
      foilIssues.push({
        id: card.id,
        name: card.name,
        dreamborn_variants: card.dreambornVariants,
        lorcast_foil: hasLorcastFoil,
        unified_foil: hasUnifiedFoil
      });
    } else {
      hasFoilCount++;
    }
  });
  
  console.log(`\n✨ Foil Analysis for Set 009 Commons:`);
  console.log(`   Commons with foil variants: ${hasFoilCount}`);
  console.log(`   Commons WITHOUT foil variants: ${noFoilCount}`);
  console.log(`   Percentage missing foils: ${(noFoilCount / set009Commons.length * 100).toFixed(1)}%`);
  
  if (foilIssues.length > 0) {
    console.log(`\n❌ Commons missing foil variants (showing first 10):`);
    foilIssues.slice(0, 10).forEach(issue => {
      console.log(`   ${issue.id}: ${issue.name}`);
      console.log(`     Dreamborn variants: [${issue.dreamborn_variants.join(', ')}]`);
      console.log(`     Lorcast foil available: ${issue.lorcast_foil}`);
      console.log(`     Unified pricing foil: ${issue.unified_foil}`);
    });
    
    if (foilIssues.length > 10) {
      console.log(`     ... and ${foilIssues.length - 10} more`);
    }
  }
  
  // Compare with other sets for context
  console.log(`\n🔍 Comparison with other sets:`);
  const otherSets = ['001', '002', '003', '004', '005', '006', '007', '008'];
  
  otherSets.forEach(setCode => {
    const setCommons = Object.keys(dreambornCards)
      .filter(id => id.startsWith(setCode + '-'))
      .map(id => dreambornCards[id])
      .filter(card => card.rarity === 'common');
    
    const withFoil = setCommons.filter(card => card.variants && card.variants.includes('foil')).length;
    const total = setCommons.length;
    const percentage = total > 0 ? (withFoil / total * 100).toFixed(1) : '0.0';
    
    console.log(`   Set ${setCode}: ${withFoil}/${total} commons have foil (${percentage}%)`);
  });
  
  // Check if this affects the web application display
  console.log(`\n🌐 Web Application Impact:`);
  console.log(`   Set 009 commons missing foil variants: ${noFoilCount}`);
  console.log(`   This would cause the web app to show "no foils" for these commons`);
  
  // Check for box/case pricing while we're at it
  console.log(`\n📦 Checking Set 009 Box/Case Pricing:`);
  const set009Products = Object.entries(justTcgCards)
    .filter(([id, card]) => id.startsWith('009-') && (card.name.includes('Box') || card.name.includes('Case')))
    .map(([id, card]) => ({
      id,
      name: card.name,
      variants: Object.keys(card.variants || {}),
      prices: Object.entries(card.variants || {}).map(([variant, data]) => `${variant}: $${data.price}`)
    }));
  
  if (set009Products.length > 0) {
    console.log(`   Found ${set009Products.length} box/case products for Set 009:`);
    set009Products.forEach(product => {
      console.log(`     ${product.id}: ${product.name}`);
      console.log(`       Variants: ${product.variants.join(', ')}`);
      product.prices.forEach(price => console.log(`       ${price}`));
    });
  } else {
    console.log(`   ❌ No box/case products found for Set 009`);
  }
  
  return {
    set009CommonsTotal: set009Commons.length,
    commonsWithoutFoil: noFoilCount,
    commonsWithFoil: hasFoilCount,
    foilIssues: foilIssues,
    set009Products: set009Products
  };
}

// Run the investigation
const results = investigateFabledFoils();

// Save results for reference
fs.writeFileSync('./data/FABLED_FOIL_INVESTIGATION.json', JSON.stringify(results, null, 2));
console.log('\n💾 Investigation results saved to FABLED_FOIL_INVESTIGATION.json');