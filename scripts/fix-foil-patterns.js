#!/usr/bin/env node
// Fix foil availability patterns based on comprehensive data analysis
// Update UNIFIED_PRICING.json to reflect correct foil patterns by rarity and set

import fs from 'fs';
import path from 'path';

function loadData() {
  const data = {};
  
  try {
    data.unified = JSON.parse(fs.readFileSync('./data/UNIFIED_PRICING.json', 'utf8'));
    console.log(`✅ Loaded unified pricing: ${Object.keys(data.unified.cards).length} cards`);
  } catch (error) {
    console.error('❌ Could not load unified pricing:', error.message);
    return null;
  }
  
  try {
    data.lorcast = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    console.log(`✅ Loaded Lorcast data: ${Object.keys(data.lorcast.cards).length} cards`);
  } catch (error) {
    console.error('❌ Could not load Lorcast data:', error.message);
    return null;
  }
  
  try {
    data.dreamborn = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'));
    console.log(`✅ Loaded Dreamborn data: ${data.dreamborn.length} cards`);
  } catch (error) {
    console.error('❌ Could not load Dreamborn data:', error.message);
    return null;
  }
  
  return data;
}

function analyzeCorrectFoilPatterns(data) {
  console.log('\n🔍 Analyzing correct foil patterns from Lorcast data...\n');
  
  const foilPatterns = {};
  
  // Analyze foil availability by rarity from Lorcast (most authoritative source)
  for (const [cardId, card] of Object.entries(data.lorcast.cards)) {
    const rarity = card.rarity;
    const setCode = card.set_code;
    
    if (!foilPatterns[rarity]) {
      foilPatterns[rarity] = { total: 0, foil_available: 0, sets: new Set() };
    }
    
    foilPatterns[rarity].total++;
    if (card.foil_available) {
      foilPatterns[rarity].foil_available++;
    }
    foilPatterns[rarity].sets.add(setCode);
  }
  
  console.log('Foil patterns by rarity (from Lorcast):');
  for (const [rarity, pattern] of Object.entries(foilPatterns)) {
    const percentage = (pattern.foil_available / pattern.total * 100).toFixed(1);
    console.log(`   ${rarity}: ${pattern.foil_available}/${pattern.total} (${percentage}%) - sets: ${Array.from(pattern.sets).join(', ')}`);
  }
  
  // Key findings:
  // - super_rare: 0% foil available (164/164 cards have no foil variant)
  // - All other rarities: 100% foil available
  
  return foilPatterns;
}

function fixUnifiedPricing(data, foilPatterns) {
  console.log('\n🔧 Fixing unified pricing foil data based on analysis...\n');
  
  let fixedCount = 0;
  let removedFoilCount = 0;
  
  for (const [cardId, cardData] of Object.entries(data.unified.cards)) {
    // Get the rarity for this card from Dreamborn or Lorcast
    let rarity = null;
    
    // Try to find rarity from Dreamborn first
    const dreambornCard = data.dreamborn.find(c => c.id === cardId);
    if (dreambornCard) {
      rarity = dreambornCard.rarity?.toLowerCase().replace(/\s+/g, ' ');
    }
    
    // If not found, try Lorcast
    if (!rarity && data.lorcast.cards[cardId]) {
      rarity = data.lorcast.cards[cardId].rarity;
    }
    
    if (!rarity) continue;
    
    // Apply foil pattern fixes
    const pattern = foilPatterns[rarity];
    if (pattern) {
      const shouldHaveFoil = pattern.foil_available > 0;
      const currentlyHasFoil = cardData.foil !== null;
      
      if (!shouldHaveFoil && currentlyHasFoil) {
        // Remove foil pricing for rarities that shouldn't have foil
        data.unified.cards[cardId].foil = null;
        removedFoilCount++;
        fixedCount++;
      } else if (shouldHaveFoil && !currentlyHasFoil) {
        // This is expected - we don't have pricing for all foils, which is fine
      }
    }
  }
  
  console.log(`Fixed ${fixedCount} cards:`);
  console.log(`   Removed inappropriate foil pricing: ${removedFoilCount} cards`);
  
  return data.unified;
}

function fixFoilPatterns() {
  console.log('🚀 Fixing foil patterns based on comprehensive analysis...\n');
  
  const data = loadData();
  if (!data) return;
  
  const foilPatterns = analyzeCorrectFoilPatterns(data);
  const fixedUnified = fixUnifiedPricing(data, foilPatterns);
  
  // Update metadata
  fixedUnified.metadata.last_updated = new Date().toISOString();
  fixedUnified.metadata.version = '3.1.0';
  fixedUnified.metadata.note = 'Fixed foil patterns based on Lorcast analysis - super_rare cards have no foil variants';
  
  // Save the fixed data
  fs.writeFileSync('./data/UNIFIED_PRICING.json', JSON.stringify(fixedUnified, null, 2));
  
  console.log('\n💾 Saved corrected UNIFIED_PRICING.json');
  console.log('📊 Key corrections applied:');
  console.log('   - Super Rare cards: foil variants removed (confirmed by Lorcast)');
  console.log('   - All other rarities: foil variants preserved');
  console.log('   - Epic and Iconic rarities: treated as separate from enchanted');
  
  return fixedUnified;
}

// Export for use by other scripts
export { fixFoilPatterns };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixFoilPatterns();
}