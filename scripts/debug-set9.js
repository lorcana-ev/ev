#!/usr/bin/env node

/**
 * Debug script to investigate Set 9 EV calculation issues
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

async function debugSet9() {
  console.log('🔍 Debugging Set 9 EV calculation...\n');
  
  try {
    // Load test data
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    console.log('📊 Analyzing Set 9 specifically...');
    
    // Get all sets info
    const availableSets = getAllSets(cards);
    const set9Info = availableSets.find(s => s.code === '009');
    
    if (!set9Info) {
      console.log('❌ Set 9 not found in available sets!');
      return false;
    }
    
    console.log(`✅ Set 9 found: ${set9Info.name} with ${set9Info.count} cards`);
    
    // Get Set 9 cards
    const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
    const set9Cards = cardArray.filter(card => 
      card.setId === '009' || card.id?.startsWith('009-')
    );
    
    console.log(`\n🎴 Set 9 card analysis:`);
    console.log(`  Total cards: ${set9Cards.length}`);
    
    // Check rarity distribution
    const rarityDist = {};
    set9Cards.forEach(card => {
      const rarity = card.rarity || 'unknown';
      rarityDist[rarity] = (rarityDist[rarity] || 0) + 1;
    });
    
    console.log('  Rarity distribution:');
    Object.entries(rarityDist)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([rarity, count]) => {
        console.log(`    ${rarity}: ${count} cards`);
      });
    
    // Generate printings and check price coverage
    const printings = buildPrintings(cards);
    const set9Printings = printings.filter(p => p.set_code === '009');
    
    console.log(`\n💰 Set 9 pricing analysis:`);
    console.log(`  Total printings: ${set9Printings.length}`);
    
    // Index prices and check coverage
    const priceIndex = indexPrices(prices);
    
    let withPrices = 0;
    let withoutPrices = [];
    let pricesByRarity = {};
    
    for (const printing of set9Printings) {
      const priceData = priceIndex.get(printing.printing_id);
      
      if (priceData && (priceData.market > 0 || priceData.low > 0 || priceData.median > 0)) {
        withPrices++;
        
        // Track by rarity
        const key = `${printing.rarity}|${printing.finish}`;
        if (!pricesByRarity[key]) pricesByRarity[key] = [];
        pricesByRarity[key].push(priceData.market || priceData.median || priceData.low || 0);
      } else {
        withoutPrices.push({
          id: printing.printing_id,
          name: printing.name,
          rarity: printing.rarity,
          finish: printing.finish
        });
      }
    }
    
    console.log(`  Printings with prices: ${withPrices}/${set9Printings.length}`);
    console.log(`  Price coverage: ${(withPrices/set9Printings.length*100).toFixed(1)}%`);
    
    if (withoutPrices.length > 0) {
      console.log('\n❌ Printings without prices:');
      withoutPrices.slice(0, 10).forEach(p => {
        console.log(`    ${p.id} - ${p.name} (${p.rarity}, ${p.finish})`);
      });
      if (withoutPrices.length > 10) {
        console.log(`    ... and ${withoutPrices.length - 10} more`);
      }
    }
    
    // Check price summaries
    console.log('\n📈 Set 9 rarity summaries:');
    const summaries = buildRaritySummaries(printings, priceIndex, 'market', '009');
    
    if (Object.keys(summaries).length === 0) {
      console.log('❌ No price summaries generated for Set 9!');
      console.log('   This is likely why EV is not calculating.');
      
      // Let's check if any Set 9 cards have pricing at all
      const set9CardIds = set9Cards.map(c => c.id);
      const set9PriceEntries = Object.keys(prices).filter(cardId => 
        cardId.startsWith('009-')
      );
      
      console.log(`\n🔍 Direct price data check:`);
      console.log(`  Set 9 card IDs: ${set9CardIds.length}`);
      console.log(`  Price entries starting with 009-: ${set9PriceEntries.length}`);
      
      if (set9PriceEntries.length > 0) {
        console.log('  Sample price entries:');
        set9PriceEntries.slice(0, 5).forEach(cardId => {
          const priceData = prices[cardId];
          console.log(`    ${cardId}: base=${priceData.base?.TP?.price}, foil=${priceData.foil?.TP?.price}`);
        });
      }
    } else {
      Object.entries(summaries).forEach(([key, summary]) => {
        console.log(`  ${key}: ${summary.count} cards, avg ${fmt(summary.mean)}`);
      });
      
      // Calculate EV
      const packEV = evPack(summaries, packModel, 'market');
      console.log(`\n✅ Set 9 Pack EV: ${fmt(packEV)}`);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

debugSet9().then(success => {
  process.exit(success ? 0 : 1);
});