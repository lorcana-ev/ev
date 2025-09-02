#!/usr/bin/env node
// Examine the specific missing cards to understand discrepancy patterns

import fs from 'fs';

function loadAllSources() {
  const sources = {};
  
  // Load Dreamborn
  try {
    const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'));
    sources.dreamborn = dreambornCards.reduce((acc, card) => {
      acc[card.id] = card;
      return acc;
    }, {});
  } catch (error) {
    sources.dreamborn = {};
  }
  
  // Load Lorcast
  try {
    const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    sources.lorcast = lorcastData.cards;
  } catch (error) {
    sources.lorcast = {};
  }
  
  // Load JustTCG
  try {
    const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
    sources.justtcg = justTcgData.cards;
  } catch (error) {
    sources.justtcg = {};
  }
  
  return sources;
}

function loadMasterDatabase() {
  try {
    return JSON.parse(fs.readFileSync('./data/MASTER_CARD_DATABASE.json', 'utf8'));
  } catch (error) {
    console.error('❌ Could not load master database:', error.message);
    return null;
  }
}

function examineSpecificMissingCards() {
  console.log('🔍 Examining Specific Missing Cards\n');
  
  const masterDb = loadMasterDatabase();
  const sources = loadAllSources();
  
  if (!masterDb) return;
  
  // Focus on the problematic cards we found
  const problemCards = [
    '006-094', // Missing from JustTCG
    '006-00N', // JustTCG exclusive
    '007-00N', // JustTCG exclusive  
    '009-229', // Missing from JustTCG
    '009-235'  // Missing from JustTCG
  ];
  
  problemCards.forEach(cardId => {
    console.log(`\n📋 CARD: ${cardId}`);
    console.log('='.repeat(50));
    
    const masterCard = masterDb.cards[cardId];
    if (masterCard) {
      console.log(`Master DB Entry:`);
      console.log(`   Name: ${masterCard.name}`);
      console.log(`   Rarity: ${masterCard.rarity}`);
      console.log(`   Sources: D:${masterCard.sources_available.dreamborn} L:${masterCard.sources_available.lorcast} J:${masterCard.sources_available.justtcg}`);
    }
    
    // Check raw source data
    const dreambornCard = sources.dreamborn[cardId];
    const lorcastCard = sources.lorcast[cardId];
    const justTcgCard = sources.justtcg[cardId];
    
    if (dreambornCard) {
      console.log(`\n📚 Dreamborn Data:`);
      console.log(`   Name: ${dreambornCard.name}`);
      console.log(`   Rarity: ${dreambornCard.rarity}`);
      console.log(`   Set: ${dreambornCard.set} (${dreambornCard.setId})`);
      console.log(`   Type: ${dreambornCard.type}`);
      if (dreambornCard.variants) {
        console.log(`   Variants: ${dreambornCard.variants.join(', ')}`);
      }
    }
    
    if (lorcastCard) {
      console.log(`\n🎯 Lorcast Data:`);
      console.log(`   Name: ${lorcastCard.name}`);
      console.log(`   Rarity: ${lorcastCard.rarity}`);
      console.log(`   Set: ${lorcastCard.set_name} (${lorcastCard.set_code})`);
      console.log(`   Type: ${lorcastCard.type}`);
      console.log(`   Number: ${lorcastCard.number}`);
      if (lorcastCard.raw_data?.tcgplayer_id) {
        console.log(`   TCGPlayer ID: ${lorcastCard.raw_data.tcgplayer_id}`);
      }
    }
    
    if (justTcgCard) {
      console.log(`\n💰 JustTCG Data:`);
      console.log(`   Name: ${justTcgCard.name}`);
      console.log(`   Rarity: ${justTcgCard.rarity}`);
      console.log(`   Set: ${justTcgCard.set}`);
      console.log(`   Number: ${justTcgCard.number}`);
      console.log(`   TCGPlayer ID: ${justTcgCard.tcgplayer_id}`);
      if (justTcgCard.variants) {
        console.log(`   Pricing variants: ${Object.keys(justTcgCard.variants).length}`);
        Object.keys(justTcgCard.variants).slice(0, 3).forEach(variant => {
          const v = justTcgCard.variants[variant];
          console.log(`     ${variant}: $${v.price}`);
        });
      }
    }
    
    if (!dreambornCard && !lorcastCard && !justTcgCard) {
      console.log(`❌ Card not found in any source!`);
    }
  });
  
  // Now let's look for patterns in card numbering
  console.log(`\n\n🔍 CARD NUMBERING PATTERN ANALYSIS`);
  console.log('='.repeat(60));
  
  // Check JustTCG exclusive cards
  const justTcgExclusives = Object.values(masterDb.cards).filter(c => 
    !c.sources_available.dreamborn && !c.sources_available.lorcast && c.sources_available.justtcg
  );
  
  console.log(`\n📊 JustTCG Exclusive Cards (${justTcgExclusives.length} total):`);
  justTcgExclusives.forEach(card => {
    const rawCard = sources.justtcg[card.master_id];
    console.log(`   ${card.master_id}: ${card.name} (${card.rarity || 'no rarity'})`);
    if (rawCard) {
      console.log(`     JustTCG Name: "${rawCard.name}"`);
      console.log(`     JustTCG Number: "${rawCard.number}"`);
      console.log(`     JustTCG Set: "${rawCard.set}"`);
    }
  });
  
  // Check Dreamborn/Lorcast exclusive cards
  const dreambornLorcastExclusives = Object.values(masterDb.cards).filter(c => 
    (c.sources_available.dreamborn || c.sources_available.lorcast) && !c.sources_available.justtcg
  );
  
  console.log(`\n📊 Missing from JustTCG (${dreambornLorcastExclusives.length} total from sets 006, 007, 009):`);
  dreambornLorcastExclusives
    .filter(c => ['006', '007', '009'].includes(c.set_code))
    .forEach(card => {
      console.log(`   ${card.master_id}: ${card.name} (${card.rarity})`);
      
      const dreambornCard = sources.dreamborn[card.master_id];
      const lorcastCard = sources.lorcast[card.master_id];
      
      if (dreambornCard) {
        console.log(`     Dreamborn Number: "${dreambornCard.number || 'no number'}"`);
      }
      if (lorcastCard) {
        console.log(`     Lorcast Number: "${lorcastCard.number || 'no number'}"`);
      }
    });
}

// Run the analysis
examineSpecificMissingCards();