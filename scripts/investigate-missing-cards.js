#!/usr/bin/env node
// Investigate the specific missing high-value cards

import fs from 'fs';

function investigateMissingCards() {
  console.log('🔍 Investigating Missing High-Value Cards\n');
  
  const justTcg = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  
  // Check Set 007 card range around the missing super rares (007-223, 007-224)
  console.log('🔍 Set 007 cards in 220-225 range:');
  Object.keys(justTcg.cards)
    .filter(id => id.startsWith('007-') && id.match(/007-22[0-5]/))
    .sort()
    .forEach(id => {
      const card = justTcg.cards[id];
      console.log(`   ${id}: ${card.name} (${card.rarity})`);
    });
  
  // Check Set 009 enchanted/high-number cards
  console.log('\n🔍 Set 009 enchanted/high-number cards:');
  Object.keys(justTcg.cards)
    .filter(id => id.startsWith('009-') && (parseInt(id.split('-')[1]) > 220 || id.includes('000')))
    .sort()
    .forEach(id => {
      const card = justTcg.cards[id];
      console.log(`   ${id}: ${card.name} (${card.rarity})`);
    });
  
  // Check what's the highest card number in each set
  console.log('\n📊 Highest card numbers by set:');
  const setSummary = {};
  Object.keys(justTcg.cards).forEach(id => {
    const [set, num] = id.split('-');
    if (set.match(/^00[1-9]$/)) {
      const cardNum = parseInt(num);
      if (!isNaN(cardNum)) {
        if (!setSummary[set] || cardNum > setSummary[set]) {
          setSummary[set] = cardNum;
        }
      }
    }
  });
  
  Object.entries(setSummary).forEach(([set, max]) => {
    console.log(`   Set ${set}: highest card number ${max}`);
  });
  
  // Check for any enchanted cards we do have
  console.log('\n✨ Enchanted cards found in JustTCG:');
  const enchantedCards = Object.entries(justTcg.cards)
    .filter(([id, card]) => card.rarity === 'Enchanted')
    .sort();
  
  if (enchantedCards.length > 0) {
    enchantedCards.slice(0, 10).forEach(([id, card]) => {
      console.log(`   ${id}: ${card.name}`);
    });
    if (enchantedCards.length > 10) {
      console.log(`   ... and ${enchantedCards.length - 10} more enchanted cards`);
    }
  } else {
    console.log('   ❌ No enchanted cards found in JustTCG data');
  }
  
  // Check for super rare cards
  console.log('\n⭐ Super rare cards found in JustTCG:');
  const superRareCards = Object.entries(justTcg.cards)
    .filter(([id, card]) => card.rarity === 'Super Rare')
    .sort();
  
  if (superRareCards.length > 0) {
    console.log(`   Found ${superRareCards.length} super rare cards`);
    // Show a few examples from sets 007 and 009
    const set007SuperRare = superRareCards.filter(([id]) => id.startsWith('007-'));
    const set009SuperRare = superRareCards.filter(([id]) => id.startsWith('009-'));
    
    if (set007SuperRare.length > 0) {
      console.log(`   Set 007 super rares (${set007SuperRare.length}):`);
      set007SuperRare.forEach(([id, card]) => {
        console.log(`     ${id}: ${card.name}`);
      });
    }
    
    if (set009SuperRare.length > 0) {
      console.log(`   Set 009 super rares (${set009SuperRare.length}):`);
      set009SuperRare.forEach(([id, card]) => {
        console.log(`     ${id}: ${card.name}`);
      });
    }
  } else {
    console.log('   ❌ No super rare cards found');
  }
}

// Run the investigation
investigateMissingCards();