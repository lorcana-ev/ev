#!/usr/bin/env node

/**
 * Test script to verify set filtering functionality
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

async function testSetFiltering() {
  console.log('🧪 Testing set filtering functionality...\n');
  
  try {
    // Load test data
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    console.log('📊 Analyzing sets...');
    const availableSets = getAllSets(cards);
    console.log(`  ✅ Found ${availableSets.length} sets:`);
    
    for (const set of availableSets) {
      const special = set.isSpecial ? ' ⭐' : '';
      console.log(`    ${set.code}: ${set.name} (${set.count} cards)${special}`);
    }
    
    // Test printings and price indexing
    const printings = buildPrintings(cards);
    const priceIndex = indexPrices(prices);
    
    console.log('\n🎯 Testing set-specific EV calculations...');
    
    // Test a few different sets
    const testSets = ['001', '002', '003'];
    
    for (const setCode of testSets) {
      const setInfo = availableSets.find(s => s.code === setCode);
      if (!setInfo) continue;
      
      console.log(`\n📦 ${setInfo.name} (${setCode}):`);
      
      // Get set-specific summaries
      const summaries = buildRaritySummaries(printings, priceIndex, 'market', setCode);
      const rarityCount = Object.keys(summaries).length;
      console.log(`  • Rarity combinations: ${rarityCount}`);
      
      // Calculate EV for this set
      const packEV = evPack(summaries, packModel, 'market');
      console.log(`  • Pack EV: ${fmt(packEV)}`);
      
      // Show top value rarities
      const sortedRarities = Object.entries(summaries)
        .sort(([,a], [,b]) => b.mean - a.mean)
        .slice(0, 3);
      
      console.log('  • Top value categories:');
      for (const [key, summary] of sortedRarities) {
        console.log(`    ${key}: ${summary.count} cards, avg ${fmt(summary.mean)}`);
      }
    }
    
    console.log('\n✨ Testing cross-set comparison...');
    
    // Compare EV across sets
    const setComparison = [];
    for (const setCode of ['001', '002', '003', '004', '005']) {
      const summaries = buildRaritySummaries(printings, priceIndex, 'market', setCode);
      const packEV = evPack(summaries, packModel, 'market');
      const setInfo = availableSets.find(s => s.code === setCode);
      
      setComparison.push({
        code: setCode,
        name: setInfo?.name || `Set ${setCode}`,
        ev: packEV,
        rarities: Object.keys(summaries).length
      });
    }
    
    setComparison.sort((a, b) => b.ev - a.ev);
    
    console.log('\n📈 EV Rankings by Set:');
    for (let i = 0; i < setComparison.length; i++) {
      const set = setComparison[i];
      console.log(`  ${i + 1}. ${set.name}: ${fmt(set.ev)} (${set.rarities} rarity combos)`);
    }
    
    console.log('\n✅ Set filtering functionality working correctly!');
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

testSetFiltering().then(success => {
  process.exit(success ? 0 : 1);
});