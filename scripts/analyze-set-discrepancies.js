#!/usr/bin/env node
// Analyze specific discrepancies for sets where we have JustTCG data
// Focus on sets 006, 007, 009 which have good JustTCG coverage

import fs from 'fs';

function loadMasterDatabase() {
  try {
    return JSON.parse(fs.readFileSync('./data/MASTER_CARD_DATABASE.json', 'utf8'));
  } catch (error) {
    console.error('❌ Could not load master database:', error.message);
    return null;
  }
}

function analyzeSetDiscrepancies() {
  console.log('🔍 Analyzing Set-Specific Discrepancies\n');
  
  const masterDb = loadMasterDatabase();
  if (!masterDb) return;

  // Focus on sets with good JustTCG coverage
  const setsToAnalyze = ['006', '007', '009'];
  
  setsToAnalyze.forEach(setCode => {
    console.log(`\n📦 SET ${setCode} (${getSetName(setCode)}) ANALYSIS`);
    console.log('='.repeat(60));
    
    // Get all cards for this set
    const setCards = Object.values(masterDb.cards).filter(card => card.set_code === setCode);
    
    console.log(`Total cards in set: ${setCards.length}`);
    
    // Categorize cards by source availability
    const categories = {
      all_three: setCards.filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && c.sources_available.justtcg),
      dreamborn_lorcast_only: setCards.filter(c => c.sources_available.dreamborn && c.sources_available.lorcast && !c.sources_available.justtcg),
      dreamborn_justtcg_only: setCards.filter(c => c.sources_available.dreamborn && !c.sources_available.lorcast && c.sources_available.justtcg),
      lorcast_justtcg_only: setCards.filter(c => !c.sources_available.dreamborn && c.sources_available.lorcast && c.sources_available.justtcg),
      dreamborn_only: setCards.filter(c => c.sources_available.dreamborn && !c.sources_available.lorcast && !c.sources_available.justtcg),
      lorcast_only: setCards.filter(c => !c.sources_available.dreamborn && c.sources_available.lorcast && !c.sources_available.justtcg),
      justtcg_only: setCards.filter(c => !c.sources_available.dreamborn && !c.sources_available.lorcast && c.sources_available.justtcg)
    };
    
    console.log(`\n📊 Coverage Breakdown:`);
    console.log(`   All 3 sources: ${categories.all_three.length} cards`);
    console.log(`   Dreamborn + Lorcast only: ${categories.dreamborn_lorcast_only.length} cards`);
    console.log(`   Dreamborn + JustTCG only: ${categories.dreamborn_justtcg_only.length} cards`);
    console.log(`   Lorcast + JustTCG only: ${categories.lorcast_justtcg_only.length} cards`);
    console.log(`   Dreamborn only: ${categories.dreamborn_only.length} cards`);
    console.log(`   Lorcast only: ${categories.lorcast_only.length} cards`);
    console.log(`   JustTCG only: ${categories.justtcg_only.length} cards`);
    
    // Analyze missing cards in detail
    console.log(`\n🔍 Missing Card Analysis:`);
    
    if (categories.dreamborn_lorcast_only.length > 0) {
      console.log(`\n   Missing from JustTCG (${categories.dreamborn_lorcast_only.length} cards):`);
      categories.dreamborn_lorcast_only.slice(0, 10).forEach(card => {
        console.log(`     ${card.master_id}: ${card.name} (${card.rarity})`);
      });
      if (categories.dreamborn_lorcast_only.length > 10) {
        console.log(`     ... and ${categories.dreamborn_lorcast_only.length - 10} more`);
      }
    }
    
    if (categories.lorcast_justtcg_only.length > 0) {
      console.log(`\n   Missing from Dreamborn (${categories.lorcast_justtcg_only.length} cards):`);
      categories.lorcast_justtcg_only.slice(0, 10).forEach(card => {
        console.log(`     ${card.master_id}: ${card.name} (${card.rarity})`);
      });
      if (categories.lorcast_justtcg_only.length > 10) {
        console.log(`     ... and ${categories.lorcast_justtcg_only.length - 10} more`);
      }
    }
    
    if (categories.dreamborn_justtcg_only.length > 0) {
      console.log(`\n   Missing from Lorcast (${categories.dreamborn_justtcg_only.length} cards):`);
      categories.dreamborn_justtcg_only.slice(0, 10).forEach(card => {
        console.log(`     ${card.master_id}: ${card.name} (${card.rarity})`);
      });
    }
    
    if (categories.justtcg_only.length > 0) {
      console.log(`\n   JustTCG Exclusive Cards (${categories.justtcg_only.length} cards):`);
      categories.justtcg_only.forEach(card => {
        console.log(`     ${card.master_id}: ${card.name} (${card.rarity || 'unknown rarity'})`);
      });
    }
    
    // Analyze rarity distribution differences
    console.log(`\n🎯 Rarity Distribution Analysis:`);
    const rarityBreakdown = {
      dreamborn: {},
      lorcast: {},
      justtcg: {}
    };
    
    setCards.forEach(card => {
      if (card.sources_available.dreamborn && card.rarity) {
        rarityBreakdown.dreamborn[card.rarity] = (rarityBreakdown.dreamborn[card.rarity] || 0) + 1;
      }
      if (card.sources_available.lorcast && card.rarity) {
        rarityBreakdown.lorcast[card.rarity] = (rarityBreakdown.lorcast[card.rarity] || 0) + 1;
      }
      if (card.sources_available.justtcg && card.rarity) {
        rarityBreakdown.justtcg[card.rarity] = (rarityBreakdown.justtcg[card.rarity] || 0) + 1;
      }
    });
    
    const allRarities = new Set([
      ...Object.keys(rarityBreakdown.dreamborn),
      ...Object.keys(rarityBreakdown.lorcast),
      ...Object.keys(rarityBreakdown.justtcg)
    ]);
    
    allRarities.forEach(rarity => {
      const d = rarityBreakdown.dreamborn[rarity] || 0;
      const l = rarityBreakdown.lorcast[rarity] || 0;
      const j = rarityBreakdown.justtcg[rarity] || 0;
      console.log(`     ${rarity.padEnd(12)}: D:${d.toString().padStart(3)} L:${l.toString().padStart(3)} J:${j.toString().padStart(3)}`);
    });
    
    // Look for potential ID pattern issues
    console.log(`\n🔧 Card ID Pattern Analysis:`);
    const idPatterns = {
      standard: setCards.filter(c => /^\d{3}-\d{3}$/.test(c.master_id)),
      enchanted: setCards.filter(c => /^\d{3}-\d{3}E$/.test(c.master_id)),
      foil_variants: setCards.filter(c => /^\d{3}-\d{2,3}f$/.test(c.master_id)),
      special_codes: setCards.filter(c => /^\d{3}-00[A-Z]$/.test(c.master_id)),
      other: setCards.filter(c => !/^(\d{3}-\d{3}|\d{3}-\d{3}E|\d{3}-\d{2,3}f|\d{3}-00[A-Z])$/.test(c.master_id))
    };
    
    console.log(`     Standard (###-###): ${idPatterns.standard.length} cards`);
    console.log(`     Enchanted (###-###E): ${idPatterns.enchanted.length} cards`);
    console.log(`     Foil variants (###-##f): ${idPatterns.foil_variants.length} cards`);
    console.log(`     Special codes (###-00X): ${idPatterns.special_codes.length} cards`);
    console.log(`     Other patterns: ${idPatterns.other.length} cards`);
    
    if (idPatterns.other.length > 0) {
      console.log(`\n     Other pattern examples:`);
      idPatterns.other.slice(0, 5).forEach(card => {
        console.log(`       ${card.master_id}: ${card.name}`);
      });
    }
  });
}

function getSetName(setCode) {
  const setNames = {
    '006': 'Azurite Sea',
    '007': 'Archazia\'s Island', 
    '009': 'Fabled'
  };
  return setNames[setCode] || `Set ${setCode}`;
}

// Run the analysis
analyzeSetDiscrepancies();