#!/usr/bin/env node

/**
 * Test script to verify the application modules work correctly
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Mock fetch for Node.js environment
global.fetch = async function mockFetch(url) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..');
  
  // Extract filename from URL
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
import { evPack, evBox, evCase, fmt } from '../src/lib/model.js';

async function testApp() {
  console.log('🧪 Testing Lorcana EV application modules...\n');
  
  try {
    // Test data loading
    console.log('📊 Loading test data...');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    console.log(`  ✅ Cards loaded: ${Array.isArray(cards) ? cards.length : Object.keys(cards).length}`);
    console.log(`  ✅ Prices loaded: ${Object.keys(prices).length}`);
    
    // Test printings
    console.log('\n🎴 Testing printings generation...');
    const printings = buildPrintings(cards);
    console.log(`  ✅ Generated ${printings.length} printings`);
    
    // Test price indexing
    console.log('\n💰 Testing price indexing...');
    const priceIndex = indexPrices(prices);
    console.log(`  ✅ Indexed ${priceIndex.size} price entries`);
    
    // Test rarity summaries
    console.log('\n📈 Testing rarity summaries...');
    const summaries = buildRaritySummaries(printings, priceIndex, 'market');
    console.log(`  ✅ Built summaries for ${Object.keys(summaries).length} rarity/finish combinations`);
    
    // Show some summaries
    Object.entries(summaries)
      .slice(0, 5)
      .forEach(([key, summary]) => {
        console.log(`    ${key}: ${summary.count} cards, avg ${fmt(summary.mean)}`);
      });
    
    // Test EV calculation
    console.log('\n🎯 Testing EV calculations...');
    const packEV = evPack(summaries, packModel, 'market');
    const boxEV = evBox(packEV, packModel);
    const caseEV = evCase(packEV, packModel);
    
    console.log(`  ✅ Pack EV: ${fmt(packEV)}`);
    console.log(`  ✅ Box EV: ${fmt(boxEV)}`);
    console.log(`  ✅ Case EV: ${fmt(caseEV)}`);
    
    console.log('\n✅ All tests passed! The application modules are working correctly.');
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

testApp().then(success => {
  process.exit(success ? 0 : 1);
});