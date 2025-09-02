#!/usr/bin/env node
// Filtered missing cards analysis - exclude promo codes, dalmatian variants, and puzzle inserts

import fs from 'fs';

function loadSources() {
  // Load Dreamborn
  const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'))
    .reduce((acc, card) => { acc[card.id] = card; return acc; }, {});
  
  // Load Lorcast
  const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
  const lorcastCards = lorcastData.cards;
  
  // Load JustTCG
  const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  const justTcgCards = justTcgData.cards;
  
  return { dreambornCards, lorcastCards, justTcgCards };
}

function shouldExcludeCard(cardId, cardInfo) {
  // Filter out promo codes (P1, P2, etc.)
  if (cardId.includes('-P1-') || cardId.includes('-P2-')) {
    return { exclude: true, reason: 'promo card' };
  }
  
  // Filter out dalmatian puppy variants (04a, 04b, etc.)
  if (cardId.match(/003-04[a-e]/)) {
    return { exclude: true, reason: 'dalmatian puppy variant' };
  }
  
  // Filter out puzzle inserts and booster packs (00N, 000 patterns)
  if (cardId.includes('-00N') || cardId.includes('-000')) {
    const name = cardInfo.name.toLowerCase();
    if (name.includes('puzzle') || name.includes('booster') || name.includes('insert')) {
      return { exclude: true, reason: 'puzzle insert/booster pack' };
    }
  }
  
  return { exclude: false, reason: null };
}

function getSetName(setCode) {
  const setNames = {
    '001': 'The First Chapter',
    '002': 'Rise of the Floodborn', 
    '003': 'Into the Inklands',
    '004': 'Ursula\'s Return',
    '005': 'Shimmering Skies',
    '006': 'Azurite Sea',
    '007': 'Archazia\'s Island',
    '008': 'Reign of Jafar',
    '009': 'Fabled'
  };
  return setNames[setCode] || `Set ${setCode}`;
}

function getCardInfo(cardId, sources) {
  const { dreambornCards, lorcastCards, justTcgCards } = sources;
  
  const dreamborn = dreambornCards[cardId];
  const lorcast = lorcastCards[cardId];
  const justtcg = justTcgCards[cardId];
  
  const cardInfo = {
    id: cardId,
    setCode: cardId.split('-')[0],
    cardNumber: cardId.split('-')[1],
    name: lorcast?.name || dreamborn?.name || justtcg?.name || 'Unknown',
    rarity: lorcast?.rarity || dreamborn?.rarity || justtcg?.rarity || 'unknown',
    type: lorcast?.type || dreamborn?.type || justtcg?.type || 'unknown',
    presentIn: {
      dreamborn: !!dreamborn,
      lorcast: !!lorcast,
      justtcg: !!justtcg
    }
  };
  
  return cardInfo;
}

function analyzeFilteredMissingCards() {
  console.log('🔍 Filtered Missing Cards Analysis');
  console.log('   (Excluding: promos, dalmatian variants, puzzle inserts)\n');
  
  const sources = loadSources();
  const { dreambornCards, lorcastCards, justTcgCards } = sources;
  const coreSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  
  // Get all unique card IDs across core sets
  const allCoreCardIds = new Set();
  [dreambornCards, lorcastCards, justTcgCards].forEach(source => {
    Object.keys(source).forEach(cardId => {
      const setCode = cardId.split('-')[0];
      if (coreSets.includes(setCode)) {
        allCoreCardIds.add(cardId);
      }
    });
  });
  
  const filteredMissingAnalysis = {
    dreamborn: [],
    lorcast: [],
    justtcg: []
  };
  
  const excludedCards = {
    dreamborn: [],
    lorcast: [],
    justtcg: []
  };
  
  // Analyze each card for missing status
  Array.from(allCoreCardIds).forEach(cardId => {
    const cardInfo = getCardInfo(cardId, sources);
    const exclusionCheck = shouldExcludeCard(cardId, cardInfo);
    
    // Track missing cards for each source
    ['dreamborn', 'lorcast', 'justtcg'].forEach(sourceName => {
      if (!cardInfo.presentIn[sourceName]) {
        if (exclusionCheck.exclude) {
          excludedCards[sourceName].push({
            ...cardInfo,
            exclusionReason: exclusionCheck.reason
          });
        } else {
          filteredMissingAnalysis[sourceName].push(cardInfo);
        }
      }
    });
  });
  
  // Sort by set and card number
  const sortBySetAndNumber = (a, b) => {
    if (a.setCode !== b.setCode) {
      return a.setCode.localeCompare(b.setCode);
    }
    return a.cardNumber.localeCompare(b.cardNumber);
  };
  
  Object.keys(filteredMissingAnalysis).forEach(source => {
    filteredMissingAnalysis[source].sort(sortBySetAndNumber);
  });
  
  // Summary
  console.log('📊 Filtered Missing Cards Summary:');
  console.log(`   Total unique core set cards: ${allCoreCardIds.size}`);
  console.log(`   Missing from Dreamborn: ${filteredMissingAnalysis.dreamborn.length} cards (excluded: ${excludedCards.dreamborn.length})`);
  console.log(`   Missing from Lorcast: ${filteredMissingAnalysis.lorcast.length} cards (excluded: ${excludedCards.lorcast.length})`);
  console.log(`   Missing from JustTCG: ${filteredMissingAnalysis.justtcg.length} cards (excluded: ${excludedCards.justtcg.length})`);
  console.log('');
  
  // Detailed breakdown by source
  ['dreamborn', 'lorcast', 'justtcg'].forEach(sourceName => {
    const missing = filteredMissingAnalysis[sourceName];
    
    console.log(`🔍 LEGITIMATE MISSING FROM ${sourceName.toUpperCase()} (${missing.length} cards):`);
    
    if (missing.length === 0) {
      console.log('   ✅ No legitimate missing cards!');
      console.log('');
      return;
    }
    
    // Group by set
    const bySet = {};
    missing.forEach(card => {
      if (!bySet[card.setCode]) bySet[card.setCode] = [];
      bySet[card.setCode].push(card);
    });
    
    coreSets.forEach(setCode => {
      const setCards = bySet[setCode] || [];
      if (setCards.length > 0) {
        console.log(`   📦 ${setCode} (${getSetName(setCode)}): ${setCards.length} missing cards`);
        setCards.forEach(card => {
          const availableIn = Object.entries(card.presentIn)
            .filter(([source, present]) => present && source !== sourceName)
            .map(([source]) => source.charAt(0).toUpperCase())
            .join('');
          
          // Add notes for special cases
          let notes = '';
          if (card.id.includes('f')) {
            notes = ' [Foil variant]';
          } else if (card.id.includes('000') && card.name.includes('Bruno')) {
            notes = ' [Legitimate card]';
          }
          
          console.log(`     ${card.id} (#${card.cardNumber}): ${card.name} (${card.rarity})${notes} [Available in: ${availableIn}]`);
        });
        console.log('');
      }
    });
  });
  
  // High-value legitimate missing cards
  console.log('⭐ HIGH-VALUE LEGITIMATE MISSING CARDS:');
  const highValueRarities = ['enchanted', 'legendary', 'super_rare', 'epic', 'iconic'];
  
  ['dreamborn', 'lorcast', 'justtcg'].forEach(sourceName => {
    const highValueMissing = filteredMissingAnalysis[sourceName].filter(card =>
      highValueRarities.includes(card.rarity)
    );
    
    if (highValueMissing.length > 0) {
      console.log(`   ${sourceName}: ${highValueMissing.length} high-value cards missing`);
      highValueMissing.forEach(card => {
        let notes = '';
        if (card.id.includes('f')) notes = ' [Foil variant]';
        console.log(`     ${card.id}: ${card.name} (${card.rarity})${notes}`);
      });
      console.log('');
    }
  });
  
  // Cards only in one source
  console.log('🎯 CARDS ONLY IN ONE SOURCE:');
  const onlyInOneSource = Array.from(allCoreCardIds)
    .map(cardId => getCardInfo(cardId, sources))
    .filter(card => {
      const exclusionCheck = shouldExcludeCard(card.id, card);
      if (exclusionCheck.exclude) return false;
      
      const sourceCount = Object.values(card.presentIn).filter(present => present).length;
      return sourceCount === 1;
    });
  
  if (onlyInOneSource.length === 0) {
    console.log('   ✅ All legitimate cards are in multiple sources!');
  } else {
    const groupedBySource = {};
    onlyInOneSource.forEach(card => {
      const onlySource = Object.entries(card.presentIn)
        .find(([source, present]) => present)[0];
      
      if (!groupedBySource[onlySource]) groupedBySource[onlySource] = [];
      groupedBySource[onlySource].push(card);
    });
    
    Object.entries(groupedBySource).forEach(([source, cards]) => {
      console.log(`   Only in ${source}: ${cards.length} cards`);
      cards.forEach(card => {
        let notes = '';
        if (card.id.includes('f')) notes = ' [Foil variant]';
        else if (card.id.includes('000')) notes = ' [Special numbering]';
        
        console.log(`     ${card.id}: ${card.name} (${card.rarity})${notes}`);
      });
      console.log('');
    });
  }
  
  return {
    totalCards: allCoreCardIds.size,
    filteredMissing: filteredMissingAnalysis,
    excludedCounts: Object.fromEntries(
      Object.entries(excludedCards).map(([source, cards]) => [source, cards.length])
    ),
    onlyInOneSource
  };
}

// Run the analysis
const results = analyzeFilteredMissingCards();

// Save detailed results
fs.writeFileSync('./data/FILTERED_MISSING_CARDS.json', JSON.stringify(results, null, 2));
console.log('💾 Filtered missing cards analysis saved to FILTERED_MISSING_CARDS.json');