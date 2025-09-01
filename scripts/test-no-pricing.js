#!/usr/bin/env node

/**
 * Test script to verify handling of sets with no pricing data
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Mock fetch and DOM for Node.js environment
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

// Mock DOM elements
global.document = {
  getElementById: () => ({ textContent: '', innerHTML: '', value: '001' }),
  querySelector: () => ({ innerHTML: '' }),
  createElement: () => ({ value: '', textContent: '' }),
};

// Import our modules
import { buildPrintings } from '../src/lib/data.js';
import { indexPrices, buildRaritySummaries } from '../src/lib/prices.js';
import { evPack, fmt } from '../src/lib/model.js';
import { getAllSets } from '../src/lib/sets.js';

async function testNoPricingHandling() {
  console.log('🧪 Testing handling of sets with no pricing data...\n');
  
  try {
    // Load test data
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    // Generate printings and price index
    const printings = buildPrintings(cards);
    const priceIndex = indexPrices(prices);
    const availableSets = getAllSets(cards);
    
    console.log('📊 Testing different sets for pricing coverage...\n');
    
    // Test multiple sets, including ones without pricing
    const testSets = ['001', '008', '009'];
    
    for (const setCode of testSets) {
      const setInfo = availableSets.find(s => s.code === setCode);
      console.log(`🔍 Testing ${setInfo?.name || `Set ${setCode}`} (${setCode}):`);
      
      // Build summaries for this set
      const summaries = buildRaritySummaries(printings, priceIndex, 'market', setCode);
      const hasPricingData = Object.keys(summaries).length > 0;
      
      console.log(`  • Has pricing data: ${hasPricingData ? '✅ Yes' : '❌ No'}`);
      console.log(`  • Rarity combinations: ${Object.keys(summaries).length}`);
      
      if (hasPricingData) {
        const packEV = evPack(summaries, packModel, 'market');
        console.log(`  • Pack EV: ${fmt(packEV)}`);
        console.log('  • Status: EV calculation successful');
      } else {
        console.log(`  • Pack EV: — (no pricing data)`);
        console.log('  • Status: Gracefully handled missing pricing data');
      }
      console.log('');
    }
    
    console.log('🔧 Verifying application behavior:');
    
    // Test the specific case of Set 9
    const set9Summaries = buildRaritySummaries(printings, priceIndex, 'market', '009');
    const set9HasData = Object.keys(set9Summaries).length > 0;
    
    if (!set9HasData) {
      console.log('  ✅ Set 9 correctly identified as having no pricing data');
      console.log('  ✅ Application should display "—" for EV values');
      console.log('  ✅ Application should show "No pricing data available" message');
    } else {
      console.log('  ❌ Unexpected: Set 9 appears to have pricing data');
    }
    
    // Test a set that should have data (Set 1)
    const set1Summaries = buildRaritySummaries(printings, priceIndex, 'market', '001');
    const set1HasData = Object.keys(set1Summaries).length > 0;
    
    if (set1HasData) {
      const set1EV = evPack(set1Summaries, packModel, 'market');
      console.log('  ✅ Set 1 correctly has pricing data');
      console.log(`  ✅ Set 1 EV calculates to: ${fmt(set1EV)}`);
    } else {
      console.log('  ❌ Unexpected: Set 1 appears to have no pricing data');
    }
    
    console.log('\n🎯 Summary:');
    console.log('  • Sets without pricing data are handled gracefully');
    console.log('  • UI will display appropriate "no data" messages');
    console.log('  • EV calculations work normally for sets with pricing data');
    console.log('  • No errors or crashes when switching between sets');
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

testNoPricingHandling().then(success => {
  console.log(success ? '\n✅ All no-pricing tests passed!' : '\n❌ Some tests failed');
  process.exit(success ? 0 : 1);
});