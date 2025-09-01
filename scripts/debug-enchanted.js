#!/usr/bin/env node

/**
 * Debug script to investigate enchanted card valuation in EV calculations
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
import { mapRarity } from '../src/lib/util.js';

async function debugEnchantedCards() {
  console.log('🔍 Debugging Enchanted Card Valuation in EV Calculations...\n');
  
  try {
    // Load test data
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = join(__dirname, '..');
    
    const cards = JSON.parse(readFileSync(join(projectRoot, 'data/cards.json'), 'utf8'));
    const prices = JSON.parse(readFileSync(join(projectRoot, 'data/USD.json'), 'utf8'));
    const packModel = JSON.parse(readFileSync(join(projectRoot, 'config/pack_model.json'), 'utf8'));
    
    console.log('📊 Analyzing enchanted cards across all sets...');
    
    const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
    const printings = buildPrintings(cards);
    const priceIndex = indexPrices(prices);
    
    // Find all enchanted cards
    const enchantedCards = cardArray.filter(card => {
      const mappedRarity = mapRarity(card.rarity);
      return mappedRarity === 'enchanted' || 
             card.rarity?.toLowerCase().includes('enchanted') ||
             card.rarity?.toLowerCase().includes('epic') ||
             card.rarity?.toLowerCase().includes('iconic');
    });
    
    console.log(`✨ Found ${enchantedCards.length} enchanted/special cards:`);
    
    // Group by set and show details
    const enchantedBySet = {};
    for (const card of enchantedCards) {
      const setId = card.setId || card.id?.split('-')[0] || 'unknown';
      if (!enchantedBySet[setId]) enchantedBySet[setId] = [];
      enchantedBySet[setId].push(card);
    }
    
    for (const [setId, setEnchanted] of Object.entries(enchantedBySet)) {
      console.log(`\n📦 Set ${setId} - ${setEnchanted.length} enchanted cards:`);
      
      let totalValue = 0;
      let cardsWithPricing = 0;
      
      for (const card of setEnchanted.slice(0, 5)) { // Show first 5
        const basePrice = priceIndex.get(`${card.id}-base`)?.market || null;
        const foilPrice = priceIndex.get(`${card.id}-foil`)?.market || null;
        const specialPrice = priceIndex.get(`${card.id}-special`)?.market || null;
        
        const highestPrice = Math.max(basePrice || 0, foilPrice || 0, specialPrice || 0);
        
        console.log(`  • ${card.name} (${card.rarity}): Base=${basePrice ? fmt(basePrice) : '—'}, Foil=${foilPrice ? fmt(foilPrice) : '—'}, Special=${specialPrice ? fmt(specialPrice) : '—'}`);
        
        if (highestPrice > 0) {
          totalValue += highestPrice;
          cardsWithPricing++;
        }
      }
      
      if (setEnchanted.length > 5) {
        console.log(`  ... and ${setEnchanted.length - 5} more enchanted cards`);
      }
      
      const avgValue = cardsWithPricing > 0 ? totalValue / cardsWithPricing : 0;
      console.log(`  💰 Average value: ${fmt(avgValue)} (${cardsWithPricing}/${setEnchanted.length} with pricing)`);
    }
    
    console.log('\n🧮 Checking pack model configuration...');
    console.log('Pack model foil odds:');
    for (const [rarity, odds] of Object.entries(packModel.foil_odds || {})) {
      console.log(`  ${rarity}: ${(odds * 100).toFixed(3)}%`);
    }
    
    console.log('\n🎯 Testing EV calculation breakdown for Set 1...');
    
    // Detailed EV breakdown for Set 1
    const set1Summaries = buildRaritySummaries(printings, priceIndex, 'market', '001');
    
    console.log('Set 1 rarity summaries:');
    const sortedSummaries = Object.entries(set1Summaries)
      .sort(([,a], [,b]) => b.mean - a.mean);
    
    for (const [key, summary] of sortedSummaries) {
      console.log(`  ${key}: ${summary.count} cards, avg ${fmt(summary.mean)}, median ${fmt(summary.median)}`);
    }
    
    console.log('\n🔬 Manual EV calculation breakdown:');
    
    // Manual calculation to see what's happening
    const cfg = packModel;
    
    // Rare-or-higher slots (base cards)
    const rareSlotEV = 
      (cfg.rare_slot_odds.rare || 0) * (set1Summaries['rare|base']?.mean || 0) +
      (cfg.rare_slot_odds['super rare'] || 0) * (set1Summaries['super rare|base']?.mean || 0) +
      (cfg.rare_slot_odds.legendary || 0) * (set1Summaries['legendary|base']?.mean || 0);
      
    console.log(`Rare slot EV (per slot): ${fmt(rareSlotEV)}`);
    console.log(`  • Rare (${(cfg.rare_slot_odds.rare * 100).toFixed(1)}%): ${fmt((cfg.rare_slot_odds.rare || 0) * (set1Summaries['rare|base']?.mean || 0))}`);
    console.log(`  • Super Rare (${(cfg.rare_slot_odds['super rare'] * 100).toFixed(1)}%): ${fmt((cfg.rare_slot_odds['super rare'] || 0) * (set1Summaries['super rare|base']?.mean || 0))}`);
    console.log(`  • Legendary (${(cfg.rare_slot_odds.legendary * 100).toFixed(1)}%): ${fmt((cfg.rare_slot_odds.legendary || 0) * (set1Summaries['legendary|base']?.mean || 0))}`);
    
    const totalRareSlots = (cfg.slots.rare_or_higher_slots || 2) * rareSlotEV;
    console.log(`Total rare slots EV (${cfg.slots.rare_or_higher_slots} slots): ${fmt(totalRareSlots)}`);
    
    // Foil slot calculation
    console.log(`\nFoil slot breakdown:`);
    let foilEV = 0;
    for (const [rarity, odds] of Object.entries(cfg.foil_odds)) {
      let value = 0;
      if (rarity === 'enchanted') {
        // Check if we have enchanted cards properly valued
        value = set1Summaries['enchanted|special']?.mean || 
                set1Summaries['enchanted|foil']?.mean || 
                set1Summaries['enchanted|base']?.mean || 0;
        console.log(`  • ${rarity} (${(odds * 100).toFixed(3)}%): ${fmt(value)} -> contributes ${fmt(odds * value)}`);
      } else {
        value = set1Summaries[`${rarity}|foil`]?.mean || 0;
        console.log(`  • ${rarity} foil (${(odds * 100).toFixed(2)}%): ${fmt(value)} -> contributes ${fmt(odds * value)}`);
      }
      foilEV += odds * value;
    }
    
    console.log(`Total foil slot EV: ${fmt(foilEV)}`);
    
    const totalPackEV = totalRareSlots + foilEV;
    console.log(`\n💰 Manual Pack EV: ${fmt(totalPackEV)}`);
    
    // Compare with our function
    const functionEV = evPack(set1Summaries, cfg, 'market');
    console.log(`🤖 Function Pack EV: ${fmt(functionEV)}`);
    
    console.log(`\n🚨 Difference: ${fmt(Math.abs(totalPackEV - functionEV))}`);
    
    if (Math.abs(totalPackEV - functionEV) > 0.01) {
      console.log('❌ Significant difference detected! There may be an issue with EV calculation.');
    } else {
      console.log('✅ Manual and function calculations match closely.');
    }
    
    // Check if enchanted cards are being found in the right category
    console.log('\n🔍 Checking enchanted card categorization:');
    const enchantedPrintings = printings.filter(p => 
      p.set_code === '001' && p.is_enchanted
    );
    console.log(`Enchanted printings in Set 1: ${enchantedPrintings.length}`);
    
    for (const printing of enchantedPrintings.slice(0, 3)) {
      console.log(`  • ${printing.name} (${printing.rarity}, ${printing.finish}) - ${printing.printing_id}`);
      const priceData = priceIndex.get(printing.printing_id);
      console.log(`    Price data: ${priceData?.market ? fmt(priceData.market) : 'None'}`);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

debugEnchantedCards().then(success => {
  process.exit(success ? 0 : 1);
});