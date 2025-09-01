#!/usr/bin/env node

/**
 * Test script to verify EV calculations across all sets after enchanted card fix
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Mock fetch for Node.js environment
global.fetch = async function mockFetch(url) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..');
  
  const filename = url.replace('./', '');
  const filePath = join(projectRoot, filename);
  
  try {
    const content = readFileSync(filePath, 'utf8');
    return {
      json: async () => JSON.parse(content)
    };
  } catch (error) {
    throw new Error(`Failed to load ${filename}: ${error.message}`);
  }
};

// Import our modules
import { buildPrintings } from '../src/lib/data.js';
import { indexPrices, buildRaritySummaries } from '../src/lib/prices.js';
import { evPack, fmt } from '../src/lib/model.js';
import { getAllSets } from '../src/lib/sets.js';

async function testEVAcrossAllSets() {
  console.log('🎯 Testing EV calculations across all sets after enchanted card fix...\n');
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
    const printings = buildPrintings(cards);
    const priceIndex = indexPrices(prices);
    
    // Get all sets from the card data
    const allSets = getAllSets(cards);
    
    console.log('📊 Pack EV Summary (Fixed Enchanted Card Pricing):');
    console.log('═'.repeat(60));
    
    let totalSetsWithPricing = 0;
    let setsWithSignificantEV = [];
    
    for (const set of allSets) {
      const setCode = set.code;
      const summaries = buildRaritySummaries(printings, priceIndex, 'market', setCode);
      const packEV = evPack(summaries, packModel, 'market');
      
      // Check enchanted contribution
      const enchantedKey = Object.keys(summaries).find(key => key.includes('enchanted'));
      const enchantedContribution = enchantedKey ? 
        (packModel.foil_odds.enchanted || 0) * summaries[enchantedKey].mean : 0;
      
      const hasSignificantEV = packEV > 0.50;
      const status = packEV === 0 ? '❌ No pricing' : 
                    hasSignificantEV ? '✅ Good EV' : '⚠️  Low EV';
      
      console.log(`${setCode.padEnd(4)} ${set.name.padEnd(25)} ${fmt(packEV).padStart(8)} ${status}`);
      console.log(`     ${set.count} cards | Enchanted contribution: ${fmt(enchantedContribution)}`);
      
      if (packEV > 0) totalSetsWithPricing++;
      if (hasSignificantEV) {
        setsWithSignificantEV.push({
          code: setCode,
          name: set.name,
          ev: packEV,
          enchantedContribution
        });
      }
    }
    
    console.log('\n🏆 Sets with Highest EV:');
    console.log('═'.repeat(50));
    setsWithSignificantEV
      .sort((a, b) => b.ev - a.ev)
      .slice(0, 5)
      .forEach((set, i) => {
        const enchantedPercent = ((set.enchantedContribution / set.ev) * 100).toFixed(1);
        console.log(`${(i+1)}. ${set.name}: ${fmt(set.ev)} (${enchantedPercent}% from enchanted)`);
      });
    
    console.log(`\n📈 Summary:`);
    console.log(`• Total sets: ${allSets.length}`);
    console.log(`• Sets with pricing: ${totalSetsWithPricing}`);
    console.log(`• Sets with good EV (>$0.50): ${setsWithSignificantEV.length}`);
    
    // Compare with old EV (approximately what it would be without enchanted cards)
    const sampleSet = setsWithSignificantEV[0];
    if (sampleSet) {
      const evWithoutEnchanted = sampleSet.ev - sampleSet.enchantedContribution;
      console.log(`\n🔍 Enchanted Card Impact Example (${sampleSet.name}):`);
      console.log(`• EV with enchanted cards: ${fmt(sampleSet.ev)}`);
      console.log(`• EV without enchanted cards: ${fmt(evWithoutEnchanted)}`);
      console.log(`• Improvement: ${fmt(sampleSet.enchantedContribution)} (+${((sampleSet.enchantedContribution / evWithoutEnchanted) * 100).toFixed(1)}%)`);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

testEVAcrossAllSets().then(success => {
  process.exit(success ? 0 : 1);
});