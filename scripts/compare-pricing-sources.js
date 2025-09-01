#!/usr/bin/env node
// Compare pricing between JustTCG and TCGPlayer for Set 9 cards

import fs from 'fs';
import path from 'path';

function loadPricingData() {
  const usdPath = path.join(process.cwd(), 'data', 'USD.json');
  const justTcgPath = path.join(process.cwd(), 'data', 'JUSTTCG.json');
  const cardsPath = path.join(process.cwd(), 'data', 'cards-formatted.json');
  
  let usdData = {}, justTcgData = {}, cardsData = [];
  
  try {
    usdData = JSON.parse(fs.readFileSync(usdPath, 'utf8'));
  } catch (error) {
    console.log('⚠️  No USD.json found');
  }
  
  try {
    const justTcgFile = JSON.parse(fs.readFileSync(justTcgPath, 'utf8'));
    justTcgData = justTcgFile.cards || {};
  } catch (error) {
    console.log('⚠️  No JUSTTCG.json found');
  }
  
  try {
    cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  } catch (error) {
    console.log('❌ No cards-formatted.json found');
    return null;
  }
  
  return { usdData, justTcgData, cardsData };
}

function getBestPrice(variants, preferredCondition = 'Near Mint', preferredPrinting = 'Normal') {
  if (!variants || Object.keys(variants).length === 0) {
    return null;
  }
  
  // Try to find preferred combination first
  const preferredKey = `${preferredCondition}_${preferredPrinting}`.replace(/\s+/g, '_');
  if (variants[preferredKey]) {
    return variants[preferredKey];
  }
  
  // Fallback to any Near Mint variant
  const nearMintVariant = Object.values(variants).find(v => v.condition === preferredCondition);
  if (nearMintVariant) {
    return nearMintVariant;
  }
  
  // Fallback to any variant
  return Object.values(variants)[0];
}

function compareCardPricing(cardId, usdPricing, justTcgPricing, cardInfo) {
  const comparison = {
    cardId,
    cardName: cardInfo ? `${cardInfo.name} - ${cardInfo.title}` : cardId,
    rarity: cardInfo?.rarity,
    tcgPlayer: {},
    justTcg: {},
    comparison: {}
  };
  
  // Extract TCGPlayer pricing
  if (usdPricing) {
    comparison.tcgPlayer.base = usdPricing.base?.TP?.price || null;
    comparison.tcgPlayer.foil = usdPricing.foil?.TP?.price || null;
    comparison.tcgPlayer.source = 'Manual TCGPlayer Integration';
  }
  
  // Extract JustTCG pricing
  if (justTcgPricing && justTcgPricing.variants) {
    const bestNormal = getBestPrice(justTcgPricing.variants, 'Near Mint', 'Normal');
    const bestFoil = getBestPrice(justTcgPricing.variants, 'Near Mint', 'Holofoil') ||
                    getBestPrice(justTcgPricing.variants, 'Near Mint', 'Cold Foil');
    
    comparison.justTcg.base = bestNormal?.price || null;
    comparison.justTcg.foil = bestFoil?.price || null;
    comparison.justTcg.variantCount = Object.keys(justTcgPricing.variants).length;
    comparison.justTcg.fetchedAt = justTcgPricing.fetched_at;
  }
  
  // Calculate comparisons
  if (comparison.tcgPlayer.base && comparison.justTcg.base) {
    const diff = comparison.justTcg.base - comparison.tcgPlayer.base;
    comparison.comparison.baseDiff = diff;
    comparison.comparison.basePercentDiff = ((diff / comparison.tcgPlayer.base) * 100).toFixed(1);
  }
  
  if (comparison.tcgPlayer.foil && comparison.justTcg.foil) {
    const diff = comparison.justTcg.foil - comparison.tcgPlayer.foil;
    comparison.comparison.foilDiff = diff;
    comparison.comparison.foilPercentDiff = ((diff / comparison.tcgPlayer.foil) * 100).toFixed(1);
  }
  
  return comparison;
}

function analyzePricingComparison() {
  console.log('📊 Pricing Source Comparison: TCGPlayer vs JustTCG\n');
  
  const data = loadPricingData();
  if (!data) return;
  
  const { usdData, justTcgData, cardsData } = data;
  
  // Find Set 9 cards that have pricing in both sources
  const set9Cards = cardsData.filter(card => card.setId === '009');
  const commonCards = [];
  const tcgPlayerOnly = [];
  const justTcgOnly = [];
  
  for (const card of set9Cards) {
    const hasTcgPlayer = usdData[card.id];
    const hasJustTcg = justTcgData[card.id];
    
    if (hasTcgPlayer && hasJustTcg) {
      const comparison = compareCardPricing(card.id, usdData[card.id], justTcgData[card.id], card);
      commonCards.push(comparison);
    } else if (hasTcgPlayer && !hasJustTcg) {
      tcgPlayerOnly.push({
        cardId: card.id,
        cardName: `${card.name} - ${card.title}`,
        rarity: card.rarity,
        basePrice: usdData[card.id].base?.TP?.price,
        foilPrice: usdData[card.id].foil?.TP?.price
      });
    } else if (!hasTcgPlayer && hasJustTcg) {
      justTcgOnly.push({
        cardId: card.id,
        cardName: `${card.name} - ${card.title}`,
        rarity: card.rarity,
        variantCount: Object.keys(justTcgData[card.id].variants || {}).length
      });
    }
  }
  
  // Summary
  console.log('📈 Coverage Summary:');
  console.log(`   Total Set 9 cards: ${set9Cards.length}`);
  console.log(`   TCGPlayer pricing: ${Object.keys(usdData).filter(id => id.startsWith('009-')).length} cards`);
  console.log(`   JustTCG pricing: ${Object.keys(justTcgData).length} cards`);
  console.log(`   Both sources: ${commonCards.length} cards`);
  console.log(`   TCGPlayer only: ${tcgPlayerOnly.length} cards`);
  console.log(`   JustTCG only: ${justTcgOnly.length} cards\n`);
  
  // Price comparison for cards in both sources
  if (commonCards.length > 0) {
    console.log('💰 Price Comparisons (cards available in both sources):');
    
    let baseDiffs = [];
    let foilDiffs = [];
    
    for (const comp of commonCards) {
      console.log(`\n🃏 ${comp.cardName} (${comp.rarity})`);
      
      if (comp.tcgPlayer.base && comp.justTcg.base) {
        console.log(`   Base: TCGPlayer $${comp.tcgPlayer.base} vs JustTCG $${comp.justTcg.base} (${comp.comparison.basePercentDiff > 0 ? '+' : ''}${comp.comparison.basePercentDiff}%)`);
        baseDiffs.push(parseFloat(comp.comparison.basePercentDiff));
      }
      
      if (comp.tcgPlayer.foil && comp.justTcg.foil) {
        console.log(`   Foil: TCGPlayer $${comp.tcgPlayer.foil} vs JustTCG $${comp.justTcg.foil} (${comp.comparison.foilPercentDiff > 0 ? '+' : ''}${comp.comparison.foilPercentDiff}%)`);
        foilDiffs.push(parseFloat(comp.comparison.foilPercentDiff));
      }
      
      console.log(`   JustTCG variants: ${comp.justTcg.variantCount}`);
    }
    
    // Statistical summary
    if (baseDiffs.length > 0) {
      const avgBaseDiff = (baseDiffs.reduce((a, b) => a + b, 0) / baseDiffs.length).toFixed(1);
      const baseRange = `${Math.min(...baseDiffs).toFixed(1)}% to ${Math.max(...baseDiffs).toFixed(1)}%`;
      console.log(`\n📊 Base Price Differences: Average ${avgBaseDiff > 0 ? '+' : ''}${avgBaseDiff}% (Range: ${baseRange})`);
    }
    
    if (foilDiffs.length > 0) {
      const avgFoilDiff = (foilDiffs.reduce((a, b) => a + b, 0) / foilDiffs.length).toFixed(1);
      const foilRange = `${Math.min(...foilDiffs).toFixed(1)}% to ${Math.max(...foilDiffs).toFixed(1)}%`;
      console.log(`📊 Foil Price Differences: Average ${avgFoilDiff > 0 ? '+' : ''}${avgFoilDiff}% (Range: ${foilRange})`);
    }
  }
  
  // Show JustTCG-only cards (our new discoveries)
  if (justTcgOnly.length > 0) {
    console.log(`\n🆕 New cards discovered via JustTCG (${justTcgOnly.length}):`);
    justTcgOnly.slice(0, 10).forEach(card => {
      console.log(`   ${card.cardId}: ${card.cardName} (${card.rarity})`);
    });
    if (justTcgOnly.length > 10) {
      console.log(`   ... and ${justTcgOnly.length - 10} more cards`);
    }
  }
  
  return {
    summary: {
      totalCards: set9Cards.length,
      tcgPlayerCards: Object.keys(usdData).filter(id => id.startsWith('009-')).length,
      justTcgCards: Object.keys(justTcgData).length,
      commonCards: commonCards.length,
      tcgPlayerOnly: tcgPlayerOnly.length,
      justTcgOnly: justTcgOnly.length
    },
    comparisons: commonCards
  };
}

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzePricingComparison();
}

export { analyzePricingComparison };