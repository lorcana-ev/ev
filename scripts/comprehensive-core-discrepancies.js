#!/usr/bin/env node
// Comprehensive analysis of core sets discrepancies and issues

import fs from 'fs';

function loadAllData() {
  // Load Dreamborn
  const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'))
    .reduce((acc, card) => { acc[card.id] = card; return acc; }, {});
  
  // Load Lorcast
  const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
  const lorcastCards = lorcastData.cards;
  
  // Load JustTCG
  const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  const justTcgCards = justTcgData.cards;
  
  // Load unified pricing
  const unifiedPricing = JSON.parse(fs.readFileSync('./data/UNIFIED_PRICING.json', 'utf8')).cards;
  
  return { dreambornCards, lorcastCards, justTcgCards, unifiedPricing };
}

function analyzeCoreSetsDiscrepancies() {
  console.log('🔍 Comprehensive Core Sets Discrepancies Analysis\n');
  
  const { dreambornCards, lorcastCards, justTcgCards, unifiedPricing } = loadAllData();
  
  const coreSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  
  // 1. Check box/case products availability
  console.log('📦 Box/Case Products Analysis:');
  const boxCaseProducts = {};
  
  Object.entries(justTcgCards).forEach(([cardId, card]) => {
    const setCode = cardId.split('-')[0];
    if (coreSets.includes(setCode)) {
      if (card.name.toLowerCase().includes('box') || card.name.toLowerCase().includes('case')) {
        if (!boxCaseProducts[setCode]) boxCaseProducts[setCode] = [];
        boxCaseProducts[setCode].push({
          id: cardId,
          name: card.name,
          variants: Object.keys(card.variants || {}),
          pricing_available: Object.keys(card.variants || {}).length > 0
        });
      }
    }
  });
  
  coreSets.forEach(setCode => {
    const products = boxCaseProducts[setCode] || [];
    if (products.length > 0) {
      console.log(`   Set ${setCode}: ${products.length} box/case products`);
      products.forEach(p => {
        console.log(`     ${p.id}: ${p.name} (${p.variants.length} variants)`);
      });
    } else {
      console.log(`   Set ${setCode}: No box/case products found`);
    }
  });
  
  // 2. Analyze foil pricing issues
  console.log('\\n✨ Foil Pricing Analysis by Set:');
  const foilAnalysis = {};
  
  coreSets.forEach(setCode => {
    foilAnalysis[setCode] = {
      total_cards: 0,
      cards_with_foil_pricing: 0,
      cards_missing_foil_pricing: 0,
      common_foil_issues: []
    };
    
    Object.entries(unifiedPricing).forEach(([cardId, pricing]) => {
      if (cardId.startsWith(setCode + '-')) {
        foilAnalysis[setCode].total_cards++;
        
        if (pricing.foil !== null && pricing.foil !== undefined) {
          foilAnalysis[setCode].cards_with_foil_pricing++;
        } else {
          foilAnalysis[setCode].cards_missing_foil_pricing++;
          
          // Check if it's a common that should have foil
          const dreambornCard = dreambornCards[cardId];
          if (dreambornCard && dreambornCard.rarity === 'common') {
            foilAnalysis[setCode].common_foil_issues.push({
              id: cardId,
              name: dreambornCard.name,
              dreamborn_variants: dreambornCard.variants || []
            });
          }
        }
      }
    });
    
    const foilPercentage = (foilAnalysis[setCode].cards_with_foil_pricing / foilAnalysis[setCode].total_cards * 100).toFixed(1);
    console.log(`   Set ${setCode}: ${foilAnalysis[setCode].cards_with_foil_pricing}/${foilAnalysis[setCode].total_cards} have foil pricing (${foilPercentage}%)`);
    
    if (foilAnalysis[setCode].common_foil_issues.length > 0) {
      console.log(`     ${foilAnalysis[setCode].common_foil_issues.length} commons missing foil pricing`);
    }
  });
  
  // 3. Detailed source discrepancies
  console.log('\\n🎯 Source Coverage Discrepancies:');
  const sourceDiscrepancies = {};
  
  // Get all unique card IDs across core sets
  const allCoreCardIds = new Set();
  [dreambornCards, lorcastCards, justTcgCards].forEach(source => {
    Object.keys(source).forEach(cardId => {
      const setCode = cardId.split('-')[0];
      if (coreSets.includes(setCode)) {
        allCoreCardIds.add(cardId);
      }
    });
  });
  
  Array.from(allCoreCardIds).forEach(cardId => {
    const setCode = cardId.split('-')[0];
    if (!sourceDiscrepancies[setCode]) {
      sourceDiscrepancies[setCode] = {
        missing_dreamborn: [],
        missing_lorcast: [],
        missing_justtcg: [],
        name_mismatches: []
      };
    }
    
    const dreamborn = dreambornCards[cardId];
    const lorcast = lorcastCards[cardId];
    const justtcg = justTcgCards[cardId];
    
    if (!dreamborn) sourceDiscrepancies[setCode].missing_dreamborn.push(cardId);
    if (!lorcast) sourceDiscrepancies[setCode].missing_lorcast.push(cardId);
    if (!justtcg) sourceDiscrepancies[setCode].missing_justtcg.push(cardId);
    
    // Check for name mismatches
    if (dreamborn && lorcast && dreamborn.name !== lorcast.name) {
      sourceDiscrepancies[setCode].name_mismatches.push({
        id: cardId,
        dreamborn_name: dreamborn.name,
        lorcast_name: lorcast.name
      });
    }
  });
  
  coreSets.forEach(setCode => {
    const disc = sourceDiscrepancies[setCode] || {};
    const missingD = disc.missing_dreamborn?.length || 0;
    const missingL = disc.missing_lorcast?.length || 0;
    const missingJ = disc.missing_justtcg?.length || 0;
    const nameMismatches = disc.name_mismatches?.length || 0;
    
    if (missingD + missingL + missingJ + nameMismatches > 0) {
      console.log(`   Set ${setCode}:`);
      if (missingD > 0) console.log(`     Missing from Dreamborn: ${missingD} cards`);
      if (missingL > 0) console.log(`     Missing from Lorcast: ${missingL} cards`);
      if (missingJ > 0) console.log(`     Missing from JustTCG: ${missingJ} cards`);
      if (nameMismatches > 0) console.log(`     Name mismatches: ${nameMismatches} cards`);
      
      // Show examples of missing cards
      if (missingJ > 0 && disc.missing_justtcg) {
        console.log(`       JustTCG missing examples: ${disc.missing_justtcg.slice(0, 5).join(', ')}`);
      }
    } else {
      console.log(`   Set ${setCode}: ✅ No significant discrepancies`);
    }
  });
  
  // 4. Summary of issues found
  console.log('\\n📋 Summary of Issues Found:');
  
  // Box/case issue
  const setsWithBoxCase = Object.keys(boxCaseProducts).length;
  const setsWithoutBoxCase = 9 - setsWithBoxCase;
  if (setsWithoutBoxCase > 0) {
    console.log(`   📦 Box/case products missing for ${setsWithoutBoxCase} sets`);
  }
  
  // Foil pricing issues
  const problematicSets = coreSets.filter(setCode => {
    const analysis = foilAnalysis[setCode];
    return analysis && (analysis.cards_with_foil_pricing / analysis.total_cards) < 0.5; // Less than 50% foil coverage
  });
  
  if (problematicSets.length > 0) {
    console.log(`   ✨ Foil pricing issues in ${problematicSets.length} sets: ${problematicSets.join(', ')}`);
  }
  
  // Source coverage issues
  const totalMissing = coreSets.reduce((acc, setCode) => {
    const disc = sourceDiscrepancies[setCode] || {};
    return acc + (disc.missing_dreamborn?.length || 0) + (disc.missing_lorcast?.length || 0) + (disc.missing_justtcg?.length || 0);
  }, 0);
  
  console.log(`   🎯 Total missing cards across all sources: ${totalMissing}`);
  
  return {
    boxCaseProducts,
    foilAnalysis,
    sourceDiscrepancies,
    totalCoreCards: allCoreCardIds.size
  };
}

// Run the analysis
const results = analyzeCoreSetsDiscrepancies();

// Save detailed results
fs.writeFileSync('./data/COMPREHENSIVE_CORE_DISCREPANCIES.json', JSON.stringify(results, null, 2));
console.log('\\n💾 Comprehensive analysis saved to COMPREHENSIVE_CORE_DISCREPANCIES.json');