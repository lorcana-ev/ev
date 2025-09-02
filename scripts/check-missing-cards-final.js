#!/usr/bin/env node
// Final check for the missing high-value cards after Set 4 refetch

import fs from 'fs';

function checkMissingCards() {
  console.log('🔍 Final Check for Missing High-Value Cards\n');
  
  const justTcg = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  
  // Check all unique set names
  console.log('📦 Available set names in JustTCG:');
  const setNames = new Set();
  Object.values(justTcg.cards).forEach(card => {
    if (card.set) setNames.add(card.set);
  });
  
  Array.from(setNames).sort().forEach(name => {
    console.log(`   "${name}"`);
  });
  
  console.log('\n🔍 Looking for Bolt and Elsa cards:');
  Object.entries(justTcg.cards).forEach(([id, card]) => {
    if (card.name && (card.name.includes('Bolt') || card.name.includes('Elsa'))) {
      if (!card.name.includes('Thunderbolt')) {
        console.log(`   ${id}: ${card.name} (${card.rarity}) [${card.number}] - ${card.set}`);
      }
    }
  });
  
  console.log('\n🧞 Looking for Genie cards in Set 009:');
  Object.entries(justTcg.cards)
    .filter(([id, card]) => id.startsWith('009-') && card.name.includes('Genie'))
    .forEach(([id, card]) => {
      console.log(`   ${id}: ${card.name} (${card.rarity}) [${card.number}]`);
    });
  
  console.log('\n👸 Looking for Mulan cards in Set 009:');
  Object.entries(justTcg.cards)
    .filter(([id, card]) => id.startsWith('009-') && card.name.includes('Mulan'))
    .forEach(([id, card]) => {
      console.log(`   ${id}: ${card.name} (${card.rarity}) [${card.number}]`);
    });
  
  // Check specific card IDs that were originally missing
  console.log('\n🎯 Checking originally missing card IDs:');
  const originallyMissing = ['007-223', '007-224', '009-229', '009-235', '009-000'];
  
  originallyMissing.forEach(cardId => {
    const found = justTcg.cards[cardId];
    if (found) {
      console.log(`   ✅ ${cardId}: ${found.name} - NOW FOUND!`);
    } else {
      console.log(`   ❌ ${cardId}: Still missing`);
    }
  });
  
  // Check if we have enchanted cards 229 and 235 under different IDs
  console.log('\n✨ Checking Set 009 enchanted cards in 220+ range:');
  Object.entries(justTcg.cards)
    .filter(([id, card]) => {
      const number = parseInt(id.split('-')[1]);
      return id.startsWith('009-') && number >= 220 && card.rarity === 'Enchanted';
    })
    .sort()
    .forEach(([id, card]) => {
      console.log(`   ${id}: ${card.name} [${card.number}]`);
    });
  
  // Check Set 007 high-numbered cards
  console.log('\n⭐ Checking Set 007 cards in 220+ range:');
  Object.entries(justTcg.cards)
    .filter(([id, card]) => {
      const number = parseInt(id.split('-')[1]);
      return id.startsWith('007-') && number >= 220;
    })
    .sort()
    .forEach(([id, card]) => {
      console.log(`   ${id}: ${card.name} (${card.rarity}) [${card.number}]`);
    });
  
  // Summary statistics
  console.log('\n📊 Updated Coverage Summary:');
  const sets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  sets.forEach(setCode => {
    const setCards = Object.keys(justTcg.cards).filter(id => id.startsWith(setCode + '-'));
    console.log(`   Set ${setCode}: ${setCards.length} cards`);
  });
  
  console.log(`\n💾 Total JustTCG cards: ${Object.keys(justTcg.cards).length}`);
}

// Run the check
checkMissingCards();