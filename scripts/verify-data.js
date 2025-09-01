#!/usr/bin/env node

/**
 * Data Verification Script for Lorcana EV
 * Verifies integrity of card data and pricing information
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load data files
function loadJSON(filename) {
  try {
    const filePath = join(projectRoot, 'data', filename);
    const data = readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error.message);
    process.exit(1);
  }
}

console.log('🔍 Loading data files...');
const cards = loadJSON('cards.json');
const prices = loadJSON('USD.json');
const filters = loadJSON('filters.json');
const sorts = loadJSON('sorts.json');

console.log(`📊 Data loaded:`);
console.log(`  - Cards: ${Array.isArray(cards) ? cards.length : Object.keys(cards).length} entries`);
console.log(`  - Prices: ${Object.keys(prices).length} entries`);
console.log(`  - Filters: ${Object.keys(filters).length} categories`);
console.log(`  - Sorts: ${Object.keys(sorts).length} options`);

// Verification functions
function verifyCardStructure() {
  console.log('\n📋 Verifying card data structure...');
  
  const requiredFields = ['id', 'name', 'setId', 'type', 'rarity', 'variants'];
  const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
  
  let errors = 0;
  let warnings = 0;
  
  // Sample first 100 cards for structure validation
  const sampleCards = cardArray.slice(0, 100);
  
  for (const card of sampleCards) {
    for (const field of requiredFields) {
      if (!card.hasOwnProperty(field)) {
        console.error(`❌ Card ${card.id || 'unknown'} missing required field: ${field}`);
        errors++;
      }
    }
    
    // Check variants
    if (card.variants && !Array.isArray(card.variants)) {
      console.warn(`⚠️  Card ${card.id} variants should be array, got: ${typeof card.variants}`);
      warnings++;
    }
    
    // Check rarity values
    const validRarities = ['common', 'uncommon', 'rare', 'super rare', 'legendary'];
    if (card.rarity && !validRarities.includes(card.rarity.toLowerCase())) {
      console.warn(`⚠️  Card ${card.id} has unusual rarity: ${card.rarity}`);
      warnings++;
    }
  }
  
  console.log(`✅ Card structure check complete: ${errors} errors, ${warnings} warnings`);
  return errors === 0;
}

function verifyPricingCoverage() {
  console.log('\n💰 Verifying pricing coverage...');
  
  const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
  
  // Focus on Fabled set (001) as mentioned in requirements
  const fabledCards = cardArray.filter(card => 
    card.setId === '001' || card.id?.startsWith('001-')
  );
  
  console.log(`🎯 Found ${fabledCards.length} cards in Fabled set (001)`);
  
  let missingPrices = [];
  let partialPrices = [];
  let completePrices = 0;
  
  for (const card of fabledCards) {
    const cardId = card.id;
    const priceData = prices[cardId];
    
    if (!priceData) {
      missingPrices.push(cardId);
      continue;
    }
    
    // Check for base and foil variants
    const hasBase = priceData.base?.TP?.price;
    const hasFoil = priceData.foil?.TP?.price;
    
    if (!hasBase && !hasFoil) {
      missingPrices.push(cardId);
    } else if (!hasBase || !hasFoil) {
      partialPrices.push({
        id: cardId,
        name: card.name,
        missing: hasBase ? 'foil' : 'base',
        hasBase: !!hasBase,
        hasFoil: !!hasFoil
      });
    } else {
      completePrices++;
    }
  }
  
  console.log(`📈 Pricing coverage for Fabled set:`);
  console.log(`  ✅ Complete pricing: ${completePrices} cards`);
  console.log(`  ⚠️  Partial pricing: ${partialPrices.length} cards`);
  console.log(`  ❌ Missing pricing: ${missingPrices.length} cards`);
  
  if (partialPrices.length > 0) {
    console.log('\n⚠️  Cards with partial pricing:');
    partialPrices.slice(0, 10).forEach(card => {
      console.log(`    ${card.id} (${card.name}) - missing ${card.missing}`);
    });
    if (partialPrices.length > 10) {
      console.log(`    ... and ${partialPrices.length - 10} more`);
    }
  }
  
  if (missingPrices.length > 0) {
    console.log('\n❌ Cards with no pricing data:');
    missingPrices.slice(0, 10).forEach(cardId => {
      const card = fabledCards.find(c => c.id === cardId);
      console.log(`    ${cardId} (${card?.name || 'unknown'})`);
    });
    if (missingPrices.length > 10) {
      console.log(`    ... and ${missingPrices.length - 10} more`);
    }
  }
  
  const coveragePercent = ((completePrices + partialPrices.length) / fabledCards.length * 100).toFixed(1);
  console.log(`📊 Overall coverage: ${coveragePercent}% of Fabled cards have some pricing data`);
  
  return missingPrices.length === 0;
}

function verifyPriceConsistency() {
  console.log('\n🔍 Verifying price data consistency...');
  
  let priceIssues = [];
  let priceStats = {
    totalCards: 0,
    withBasePrices: 0,
    withFoilPrices: 0,
    negativeBasePrices: 0,
    negativeFoilPrices: 0,
    foilLowerThanBase: 0
  };
  
  for (const [cardId, priceData] of Object.entries(prices)) {
    priceStats.totalCards++;
    
    const basePrice = priceData.base?.TP?.price;
    const foilPrice = priceData.foil?.TP?.price;
    
    if (basePrice !== undefined) {
      priceStats.withBasePrices++;
      if (basePrice < 0) {
        priceStats.negativeBasePrices++;
        priceIssues.push(`${cardId}: negative base price (${basePrice})`);
      }
    }
    
    if (foilPrice !== undefined) {
      priceStats.withFoilPrices++;
      if (foilPrice < 0) {
        priceStats.negativeFoilPrices++;
        priceIssues.push(`${cardId}: negative foil price (${foilPrice})`);
      }
    }
    
    // Check if foil is cheaper than base (unusual)
    if (basePrice > 0 && foilPrice > 0 && foilPrice < basePrice) {
      priceStats.foilLowerThanBase++;
      if (priceIssues.length < 20) { // Limit output
        priceIssues.push(`${cardId}: foil ($${foilPrice}) < base ($${basePrice})`);
      }
    }
  }
  
  console.log('📊 Price statistics:');
  console.log(`  Total cards with price data: ${priceStats.totalCards}`);
  console.log(`  Cards with base prices: ${priceStats.withBasePrices}`);
  console.log(`  Cards with foil prices: ${priceStats.withFoilPrices}`);
  console.log(`  Negative base prices: ${priceStats.negativeBasePrices}`);
  console.log(`  Negative foil prices: ${priceStats.negativeFoilPrices}`);
  console.log(`  Foil cheaper than base: ${priceStats.foilLowerThanBase}`);
  
  if (priceIssues.length > 0) {
    console.log('\n⚠️  Price consistency issues:');
    priceIssues.slice(0, 15).forEach(issue => console.log(`    ${issue}`));
    if (priceIssues.length > 15) {
      console.log(`    ... and ${priceIssues.length - 15} more issues`);
    }
  }
  
  return priceStats.negativeBasePrices === 0 && priceStats.negativeFoilPrices === 0;
}

function generateDataSummary() {
  console.log('\n📋 Data Summary:');
  
  const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
  
  // Set distribution
  const setDistribution = {};
  cardArray.forEach(card => {
    const setId = card.setId || card.id?.split('-')[0] || 'unknown';
    setDistribution[setId] = (setDistribution[setId] || 0) + 1;
  });
  
  console.log('📦 Cards by set:');
  Object.entries(setDistribution)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([setId, count]) => {
      console.log(`  Set ${setId}: ${count} cards`);
    });
  
  // Rarity distribution for Fabled set
  const fabledCards = cardArray.filter(card => 
    card.setId === '001' || card.id?.startsWith('001-')
  );
  
  const rarityDist = {};
  fabledCards.forEach(card => {
    const rarity = card.rarity || 'unknown';
    rarityDist[rarity] = (rarityDist[rarity] || 0) + 1;
  });
  
  console.log('\n🎯 Fabled set rarity distribution:');
  Object.entries(rarityDist)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([rarity, count]) => {
      console.log(`  ${rarity}: ${count} cards`);
    });
}

// Run all verifications
async function main() {
  console.log('🚀 Starting Lorcana EV data verification...\n');
  
  let allPassed = true;
  
  allPassed &= verifyCardStructure();
  allPassed &= verifyPricingCoverage();
  allPassed &= verifyPriceConsistency();
  
  generateDataSummary();
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All verifications passed! Data integrity looks good.');
  } else {
    console.log('❌ Some verifications failed. Please review the issues above.');
  }
  console.log('='.repeat(50));
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);