#!/usr/bin/env node

/**
 * Script to show our current EV calculations for comparison
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
import { SET_NAMES } from '../src/lib/sets.js';

async function showCurrentEV() {
  console.log('🎯 Our Current Lorcana EV Calculations');
  console.log('═'.repeat(50));
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    const printings = buildPrintings(cards);
    const priceIndex = indexPrices(prices);
    
    // Main numbered sets only
    const mainSets = ['001', '002', '003', '004', '005', '006', '007', '008'];
    
    console.log('Main Set Pack EVs:');
    console.log('-'.repeat(40));
    
    for (const setCode of mainSets) {
      const summaries = buildRaritySummaries(printings, priceIndex, 'market', setCode);
      const packEV = evPack(summaries, packModel, 'market');
      const setName = SET_NAMES[setCode] || `Set ${setCode}`;
      
      // Get pricing coverage
      const totalCards = Object.values(summaries).reduce((sum, s) => sum + s.count, 0);
      const coverage = totalCards > 0 ? '✅' : '❌';
      
      console.log(`${setCode}: ${setName.padEnd(25)} ${fmt(packEV).padStart(8)} ${coverage}`);
    }
    
    console.log('\nDetailed Breakdown for Reference:');
    console.log('-'.repeat(50));
    
    // Show Set 1 breakdown as example
    const set1Summaries = buildRaritySummaries(printings, priceIndex, 'market', '001');
    console.log('\nSet 1 (The First Chapter) - Detailed Breakdown:');
    
    const sortedSummaries = Object.entries(set1Summaries)
      .sort(([,a], [,b]) => b.mean - a.mean)
      .slice(0, 8);
      
    for (const [key, summary] of sortedSummaries) {
      const [rarity, finish] = key.split('|');
      const contribution = rarity === 'enchanted' ? 
        (packModel.foil_odds.enchanted * summary.mean) :
        finish === 'foil' && packModel.foil_odds[rarity] ? 
          (packModel.foil_odds[rarity] * summary.mean) :
          rarity === 'legendary' && finish === 'base' ?
            (packModel.rare_slot_odds[rarity] * packModel.slots.rare_or_higher_slots * summary.mean) :
          rarity === 'super rare' && finish === 'base' ?
            (packModel.rare_slot_odds[rarity] * packModel.slots.rare_or_higher_slots * summary.mean) :
          rarity === 'rare' && finish === 'base' ?
            (packModel.rare_slot_odds[rarity] * packModel.slots.rare_or_higher_slots * summary.mean) : 0;
            
      console.log(`  ${key.padEnd(20)} ${summary.count.toString().padStart(2)} cards  ${fmt(summary.mean).padStart(8)}  →  ${fmt(contribution).padStart(8)}`);
    }
    
    const totalEV = evPack(set1Summaries, packModel, 'market');
    console.log(`  ${''.padEnd(20)} ${'-'.padStart(2)}       ${'-'.padStart(8)}     ${fmt(totalEV).padStart(8)}`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    return false;
  }
}

showCurrentEV().then(success => {
  process.exit(success ? 0 : 1);
});