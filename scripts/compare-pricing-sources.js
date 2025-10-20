#!/usr/bin/env node
// Compare pricing data across JustTCG, Lorcast, and Dreamborn sources
// Find major discrepancies for spot checking

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Load all pricing sources
function loadPricingData() {
  console.log('📂 Loading pricing data from all sources...\n');

  const sources = {
    dreamborn: null,
    justtcg: null,
    lorcast: null
  };

  // Load Dreamborn (USD.json)
  try {
    const dreambornPath = path.join(DATA_DIR, 'USD.json');
    sources.dreamborn = JSON.parse(fs.readFileSync(dreambornPath, 'utf8'));
    console.log(`✅ Dreamborn: ${Object.keys(sources.dreamborn).length} cards`);
  } catch (error) {
    console.log(`⚠️  Dreamborn: Not available (${error.message})`);
  }

  // Load JustTCG
  try {
    const justtcgPath = path.join(DATA_DIR, 'JUSTTCG.json');
    const data = JSON.parse(fs.readFileSync(justtcgPath, 'utf8'));
    sources.justtcg = data.cards || {};
    console.log(`✅ JustTCG: ${Object.keys(sources.justtcg).length} cards`);
  } catch (error) {
    console.log(`⚠️  JustTCG: Not available (${error.message})`);
  }

  // Load Lorcast
  try {
    const lorcastPath = path.join(DATA_DIR, 'LORCAST.json');
    const data = JSON.parse(fs.readFileSync(lorcastPath, 'utf8'));
    sources.lorcast = data.cards || {};
    console.log(`✅ Lorcast: ${Object.keys(sources.lorcast).length} cards`);
  } catch (error) {
    console.log(`⚠️  Lorcast: Not available (${error.message})`);
  }

  return sources;
}

// Extract price from JustTCG card data
function getJustTcgPrice(card, variant = 'base') {
  if (!card || !card.variants) return null;

  // Look for Near Mint Normal (base) or Near Mint Foil/Holofoil
  const printing = variant === 'foil' ? ['Foil', 'Holofoil', 'Cold Foil'] : ['Normal'];

  // Try exact match first
  for (const printType of printing) {
    const key = `Near_Mint_${printType}`;
    if (card.variants[key]) {
      return card.variants[key].price || null;
    }
  }

  // Fallback: find any variant matching the printing type
  for (const [variantKey, variantData] of Object.entries(card.variants)) {
    if (variantData.condition === 'Near Mint') {
      if (variant === 'foil' && printing.includes(variantData.printing)) {
        return variantData.price || null;
      }
      if (variant === 'base' && variantData.printing === 'Normal') {
        return variantData.price || null;
      }
    }
  }

  return null;
}

// Extract price from Dreamborn data
function getDreambornPrice(cardData, variant = 'base') {
  if (!cardData || !cardData[variant]) return null;
  return cardData[variant]?.TP?.price || null;
}

// Compare prices for a single card
function compareCardPrices(cardId, sources) {
  const comparison = {
    cardId,
    name: null,
    rarity: null,
    base: {
      dreamborn: null,
      justtcg: null
    },
    foil: {
      dreamborn: null,
      justtcg: null
    }
  };

  // Get Dreamborn prices
  if (sources.dreamborn && sources.dreamborn[cardId]) {
    comparison.base.dreamborn = getDreambornPrice(sources.dreamborn[cardId], 'base');
    comparison.foil.dreamborn = getDreambornPrice(sources.dreamborn[cardId], 'foil');
  }

  // Get JustTCG prices
  if (sources.justtcg && sources.justtcg[cardId]) {
    const card = sources.justtcg[cardId];
    comparison.name = card.name;
    comparison.rarity = card.rarity;
    comparison.base.justtcg = getJustTcgPrice(card, 'base');
    comparison.foil.justtcg = getJustTcgPrice(card, 'foil');
  }

  // Get card name from Lorcast if not found
  if (!comparison.name && sources.lorcast && sources.lorcast[cardId]) {
    comparison.name = sources.lorcast[cardId].name;
    comparison.rarity = sources.lorcast[cardId].rarity;
  }

  return comparison;
}

// Calculate discrepancy metrics
function calculateDiscrepancy(price1, price2) {
  if (!price1 || !price2) return null;

  const diff = Math.abs(price1 - price2);
  const avg = (price1 + price2) / 2;
  const percentDiff = (diff / avg) * 100;

  return {
    diff,
    percentDiff,
    higher: price1 > price2 ? 'dreamborn' : 'justtcg',
    ratio: Math.max(price1, price2) / Math.min(price1, price2)
  };
}

// Analyze all cards and find discrepancies
function findDiscrepancies(sources) {
  console.log('\n🔍 Analyzing price discrepancies...\n');

  // Get all unique card IDs
  const allCardIds = new Set();
  if (sources.dreamborn) Object.keys(sources.dreamborn).forEach(id => allCardIds.add(id));
  if (sources.justtcg) Object.keys(sources.justtcg).forEach(id => allCardIds.add(id));

  const discrepancies = [];

  for (const cardId of allCardIds) {
    const comparison = compareCardPrices(cardId, sources);

    // Check base variant discrepancy
    if (comparison.base.dreamborn && comparison.base.justtcg) {
      const baseDisc = calculateDiscrepancy(
        comparison.base.dreamborn,
        comparison.base.justtcg
      );

      if (baseDisc && (baseDisc.percentDiff > 20 || baseDisc.diff > 5)) {
        discrepancies.push({
          cardId,
          name: comparison.name,
          rarity: comparison.rarity,
          variant: 'base',
          dreamborn: comparison.base.dreamborn,
          justtcg: comparison.base.justtcg,
          ...baseDisc
        });
      }
    }

    // Check foil variant discrepancy
    if (comparison.foil.dreamborn && comparison.foil.justtcg) {
      const foilDisc = calculateDiscrepancy(
        comparison.foil.dreamborn,
        comparison.foil.justtcg
      );

      if (foilDisc && (foilDisc.percentDiff > 20 || foilDisc.diff > 5)) {
        discrepancies.push({
          cardId,
          name: comparison.name,
          rarity: comparison.rarity,
          variant: 'foil',
          dreamborn: comparison.foil.dreamborn,
          justtcg: comparison.foil.justtcg,
          ...foilDisc
        });
      }
    }
  }

  // Sort by percent difference (highest first)
  discrepancies.sort((a, b) => b.percentDiff - a.percentDiff);

  return discrepancies;
}

// Display discrepancies report
function displayReport(discrepancies) {
  console.log('═'.repeat(100));
  console.log('📊 MAJOR PRICE DISCREPANCIES REPORT');
  console.log('═'.repeat(100));
  console.log(`Found ${discrepancies.length} cards with significant price differences (>20% or >$5 difference)\n`);

  if (discrepancies.length === 0) {
    console.log('✅ No major discrepancies found!');
    return;
  }

  // Top 20 discrepancies
  const topDiscrepancies = discrepancies.slice(0, 20);

  console.log('🔴 TOP 20 LARGEST DISCREPANCIES:\n');
  console.log('─'.repeat(100));
  console.log(`${'#'.padEnd(4)} ${'Card ID'.padEnd(12)} ${'Variant'.padEnd(8)} ${'Card Name'.padEnd(35)} ${'Dreamborn'.padEnd(12)} ${'JustTCG'.padEnd(12)} ${'Diff %'.padEnd(10)}`);
  console.log('─'.repeat(100));

  topDiscrepancies.forEach((disc, idx) => {
    const rank = (idx + 1).toString().padEnd(4);
    const cardId = disc.cardId.padEnd(12);
    const variant = disc.variant.padEnd(8);
    const name = (disc.name || 'Unknown').substring(0, 35).padEnd(35);
    const dreamborn = `$${disc.dreamborn.toFixed(2)}`.padEnd(12);
    const justtcg = `$${disc.justtcg.toFixed(2)}`.padEnd(12);
    const percentDiff = `${disc.percentDiff.toFixed(1)}%`.padEnd(10);

    console.log(`${rank} ${cardId} ${variant} ${name} ${dreamborn} ${justtcg} ${percentDiff}`);
  });

  // Statistics
  console.log('\n' + '═'.repeat(100));
  console.log('📈 STATISTICS:\n');

  const baseDiscrepancies = discrepancies.filter(d => d.variant === 'base');
  const foilDiscrepancies = discrepancies.filter(d => d.variant === 'foil');

  console.log(`Base variant discrepancies: ${baseDiscrepancies.length}`);
  console.log(`Foil variant discrepancies: ${foilDiscrepancies.length}`);

  if (discrepancies.length > 0) {
    const avgPercentDiff = discrepancies.reduce((sum, d) => sum + d.percentDiff, 0) / discrepancies.length;
    const maxPercentDiff = Math.max(...discrepancies.map(d => d.percentDiff));
    const avgDollarDiff = discrepancies.reduce((sum, d) => sum + d.diff, 0) / discrepancies.length;

    console.log(`\nAverage percent difference: ${avgPercentDiff.toFixed(1)}%`);
    console.log(`Maximum percent difference: ${maxPercentDiff.toFixed(1)}%`);
    console.log(`Average dollar difference: $${avgDollarDiff.toFixed(2)}`);
  }

  // Save detailed report
  const reportPath = path.join(DATA_DIR, 'PRICE_DISCREPANCIES.json');
  fs.writeFileSync(reportPath, JSON.stringify(discrepancies, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);

  // Show some spot check suggestions
  console.log('\n🎯 SUGGESTED SPOT CHECKS:');
  console.log('─'.repeat(100));
  console.log('Check these cards manually on both sources:\n');

  topDiscrepancies.slice(0, 5).forEach((disc, idx) => {
    console.log(`${idx + 1}. ${disc.name || disc.cardId} (${disc.variant}) - ${disc.rarity || 'unknown rarity'}`);
    console.log(`   Dreamborn: $${disc.dreamborn.toFixed(2)}`);
    console.log(`   JustTCG: $${disc.justtcg.toFixed(2)}`);
    console.log(`   Difference: ${disc.percentDiff.toFixed(1)}% ($${disc.diff.toFixed(2)}) - ${disc.higher} is higher`);
    console.log('');
  });
}

// Main function
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Price Discrepancy Analysis - JustTCG vs Dreamborn         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const sources = loadPricingData();

  if (!sources.dreamborn || !sources.justtcg) {
    console.error('\n❌ Error: Need both Dreamborn and JustTCG data to compare.');
    console.error('Run: node scripts/update-all.js');
    process.exit(1);
  }

  const discrepancies = findDiscrepancies(sources);
  displayReport(discrepancies);

  console.log('\n' + '═'.repeat(100) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { loadPricingData, findDiscrepancies };
