// Analyze Fabled (Set 009) EV Calculation
// This script replicates the EV calculation logic to debug potential issues

import fs from 'fs';
import { MultiSourcePricing, buildRaritySummaries } from '../src/lib/prices.js';
import { evPack, applyScenario } from '../src/lib/model.js';
import { buildPrintings } from '../src/lib/data.js';

function analyzeSet009EV() {
  console.log('🔍 Analyzing Fabled (Set 009) EV Calculation - Script Version (using Web App Logic)\n');

  // Load data exactly like web app
  const cards = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
  const packModel = JSON.parse(fs.readFileSync('./config/pack_model.json', 'utf8'));
  
  // Load pricing sources
  let dreambornPrices = null;
  let lorcastData = null; 
  let justTcgData = null;
  
  try {
    dreambornPrices = JSON.parse(fs.readFileSync('./data/USD.json', 'utf8'));
  } catch (e) {
    console.log('❌ No Dreamborn pricing data found');
  }
  
  try {
    lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
  } catch (e) {
    console.log('❌ No Lorcast pricing data found');
  }
  
  try {
    justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  } catch (e) {
    console.log('❌ No JustTCG pricing data found');
  }

  console.log(`📊 Data loaded:`);
  console.log(`   Cards: ${cards.length}`);
  console.log(`   JustTCG batches: ${Object.keys(justTcgData?.batches || {}).length}`);
  console.log(`   Dreamborn entries: ${Object.keys(dreambornPrices || {}).length}`);
  console.log(`   Lorcast data: ${lorcastData ? 'Found' : 'Missing'}`);

  // Process printings exactly like web app
  const printings = buildPrintings(cards);
  console.log(`   Printings: ${printings.length}`);

  // Create multi-source pricing exactly like web app
  const allPricingSources = {
    dreamborn: dreambornPrices,
    lorcast: lorcastData,
    justtcg: justTcgData,
    unified: null // Not used in multi-source mode
  };
  
  const multiSourcePricing = new MultiSourcePricing(allPricingSources);
  const pricingPriority = ['justtcg', 'dreamborn', 'lorcast'];
  
  console.log(`\n💰 Multi-source pricing indexed:`);
  console.log(`   JustTCG: ${multiSourcePricing.sources.justtcg?.size || 0} entries`);
  console.log(`   Dreamborn: ${multiSourcePricing.sources.dreamborn?.size || 0} entries`);
  console.log(`   Lorcast: ${multiSourcePricing.sources.lorcast?.size || 0} entries`);

  // Set configuration exactly like web app
  const selectedSet = '009'; // Fabled
  const scenario = 'base';
  
  console.log(`\n⚙️ Configuration:`);
  console.log(`   Selected Set: ${selectedSet} (Fabled)`);
  console.log(`   Scenario: ${scenario}`);
  console.log(`   Pricing Priority: ${pricingPriority.join(' → ')}`);

  // Build rarity summaries exactly like web app
  const summaries = buildRaritySummaries(printings, multiSourcePricing, 'market', selectedSet, pricingPriority);
  
  console.log(`\n📈 Rarity Summaries for Set ${selectedSet}:`);
  const relevantSummaries = Object.entries(summaries)
    .filter(([key]) => summaries[key].count > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [key, summary] of relevantSummaries) {
    const [rarity, finish] = key.split('|');
    console.log(`   ${key}: ${summary.count} cards, mean=$${summary.mean?.toFixed(2) || '0.00'}, median=$${summary.median?.toFixed(2) || '0.00'}`);
  }

  // Apply scenario exactly like web app
  const scenarioConfig = applyScenario(packModel, scenario);
  console.log(`\n🎲 Applied Scenario Config:`);
  console.log(`   Rare slot odds:`, Object.entries(scenarioConfig.rare_slot_odds).map(([r, o]) => `${r}=${(o*100).toFixed(2)}%`).join(', '));
  console.log(`   Foil enchanted per pack: ${(scenarioConfig.foil_odds.enchanted * 100).toFixed(2)}%`);

  // Calculate pack EV exactly like web app
  const bulkFloor = scenarioConfig.bulk_floor || { common: 0, uncommon: 0 };
  const packEV = evPack(summaries, scenarioConfig, 'market', bulkFloor);
  
  console.log(`\n💸 Pack EV Calculation:`);
  
  // Debug individual contributions
  const rOdds = scenarioConfig.rare_slot_odds;
  const avg = (rarity, finish) => summaries[`${rarity}|${finish}`]?.mean ?? 0;
  
  console.log(`   Rare slot contributions (2 slots):`);
  let rareSlotTotal = 0;
  for (const [rarity, odds] of Object.entries(rOdds)) {
    const avgPrice = avg(rarity, 'base');
    const contribution = odds * avgPrice * 2;
    rareSlotTotal += contribution;
    console.log(`     ${rarity}: ${(odds * 100).toFixed(2)}% × $${avgPrice.toFixed(2)} × 2 = $${contribution.toFixed(3)}`);
  }
  
  console.log(`   Foil slot contributions (1 slot):`);
  const f = scenarioConfig.foil_odds || {};
  let foilSlotTotal = 0;
  for (const [rarity, odds] of Object.entries(f)) {
    if (!odds) continue;
    const avgPrice = rarity === 'enchanted' 
      ? (summaries['enchanted|special']?.mean ?? summaries['enchanted|foil']?.mean ?? 0)
      : avg(rarity, 'foil');
    const contribution = odds * avgPrice;
    foilSlotTotal += contribution;
    console.log(`     ${rarity}: ${(odds * 100).toFixed(2)}% × $${avgPrice.toFixed(2)} = $${contribution.toFixed(3)}`);
  }
  
  const bulkContrib = (scenarioConfig.slots.commons || 6) * (bulkFloor.common || 0) +
                     (scenarioConfig.slots.uncommons || 3) * (bulkFloor.uncommon || 0);
  
  console.log(`   Bulk floor contribution: $${bulkContrib.toFixed(3)}`);
  console.log(`   TOTAL COMPONENTS: Rare slots=$${rareSlotTotal.toFixed(3)} + Foil slot=$${foilSlotTotal.toFixed(3)} + Bulk=$${bulkContrib.toFixed(3)}`);
  console.log(`\n💸 FINAL PACK EV: $${packEV.toFixed(2)}`);
  console.log(`💸 BOX EV (24 packs): $${(packEV * 24).toFixed(2)}`);
  console.log(`💸 CASE EV (96 packs): $${(packEV * 96).toFixed(2)}`);

  // Check for Iconic card pricing specifically
  console.log(`\n🔍 Iconic Card Verification:`);
  const iconicCards = printings.filter(p => p.set_code === '009' && p.rarity === 'iconic');
  console.log(`   Found ${iconicCards.length} iconic printings in Set 009`);
  
  for (const iconic of iconicCards) {
    const priceData = multiSourcePricing.getPrice(iconic.printing_id, pricingPriority);
    console.log(`   ${iconic.printing_id} (${iconic.name}): ${priceData ? `$${priceData.market} [${priceData.source}]` : 'Not found'}`);
  }

  // Check high-value cards
  console.log(`\n💎 High-Value Card Analysis:`);
  const highValueCards = [];
  const set009Printings = printings.filter(p => p.set_code === '009');
  
  for (const printing of set009Printings) {
    const priceData = multiSourcePricing.getPrice(printing.printing_id, pricingPriority);
    if (priceData && priceData.market > 15) {
      highValueCards.push({
        name: printing.name,
        rarity: printing.rarity,
        finish: printing.finish,
        price: priceData.market,
        source: priceData.source,
        printing_id: printing.printing_id
      });
    }
  }
  
  highValueCards.sort((a, b) => b.price - a.price);
  console.log(`   Found ${highValueCards.length} high-value cards (>$15):`);
  
  highValueCards.slice(0, 15).forEach((card, i) => {
    console.log(`     ${i + 1}. ${card.name} (${card.rarity} ${card.finish}) - $${card.price.toFixed(2)} [${card.source}]`);
  });

  return {
    packEV,
    boxEV: packEV * 24,
    caseEV: packEV * 96,
    cardCount: set009Cards.length,
    pricingCoverage: {
      base: set009BaseCount / set009Cards.length,
      foil: set009FoilCount / set009Cards.length
    },
    rarityBreakdown: rarityPricing
  };
}

// Run the analysis
const results = analyzeSet009EV();
console.log('\n✅ Analysis Complete');