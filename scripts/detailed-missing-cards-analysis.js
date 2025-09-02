#!/usr/bin/env node
// Generate detailed list of all missing cards by source with card numbers

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
  
  // Get card info from any available source
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

function analyzeDetailedMissingCards() {
  console.log('🔍 Detailed Missing Cards Analysis\n');
  
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
  
  const missingAnalysis = {
    dreamborn: [],
    lorcast: [],
    justtcg: []
  };
  
  // Analyze each card for missing status
  Array.from(allCoreCardIds).forEach(cardId => {
    const cardInfo = getCardInfo(cardId, sources);
    
    if (!cardInfo.presentIn.dreamborn) {
      missingAnalysis.dreamborn.push(cardInfo);
    }
    if (!cardInfo.presentIn.lorcast) {
      missingAnalysis.lorcast.push(cardInfo);
    }
    if (!cardInfo.presentIn.justtcg) {
      missingAnalysis.justtcg.push(cardInfo);
    }
  });
  
  // Sort by set and card number
  const sortBySetAndNumber = (a, b) => {
    if (a.setCode !== b.setCode) {
      return a.setCode.localeCompare(b.setCode);
    }
    return a.cardNumber.localeCompare(b.cardNumber);
  };
  
  missingAnalysis.dreamborn.sort(sortBySetAndNumber);
  missingAnalysis.lorcast.sort(sortBySetAndNumber);
  missingAnalysis.justtcg.sort(sortBySetAndNumber);
  
  // Generate detailed reports
  console.log('📊 Missing Cards Summary:');
  console.log(`   Total unique core set cards: ${allCoreCardIds.size}`);
  console.log(`   Missing from Dreamborn: ${missingAnalysis.dreamborn.length} cards`);
  console.log(`   Missing from Lorcast: ${missingAnalysis.lorcast.length} cards`);
  console.log(`   Missing from JustTCG: ${missingAnalysis.justtcg.length} cards`);
  console.log('');
  
  // Detailed breakdown by source
  ['dreamborn', 'lorcast', 'justtcg'].forEach(sourceName => {
    const missing = missingAnalysis[sourceName];
    
    console.log(`🔍 MISSING FROM ${sourceName.toUpperCase()} (${missing.length} cards):`);
    console.log('');
    
    if (missing.length === 0) {
      console.log('   ✅ No missing cards!');
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
          
          console.log(`     ${card.id} (#${card.cardNumber}): ${card.name} (${card.rarity}) [Available in: ${availableIn}]`);
        });
        console.log('');
      }
    });
  });
  
  // Pattern analysis
  console.log('🔍 PATTERN ANALYSIS:');
  console.log('');
  
  // Cards missing from multiple sources
  const missingFromMultiple = Array.from(allCoreCardIds)
    .map(cardId => getCardInfo(cardId, sources))
    .filter(card => {
      const sourceCount = Object.values(card.presentIn).filter(present => present).length;
      return sourceCount <= 1; // Missing from 2+ sources
    });
  
  console.log(`📋 Cards missing from multiple sources: ${missingFromMultiple.length}`);
  if (missingFromMultiple.length > 0) {
    missingFromMultiple.forEach(card => {
      const availableIn = Object.entries(card.presentIn)
        .filter(([source, present]) => present)
        .map(([source]) => source)
        .join(', ') || 'none';
      console.log(`   ${card.id}: ${card.name} (only in: ${availableIn})`);
    });
    console.log('');
  }
  
  // High-value cards missing (enchanted, legendary, super_rare)
  const highValueMissing = [];
  ['dreamborn', 'lorcast', 'justtcg'].forEach(sourceName => {
    const missing = missingAnalysis[sourceName];
    const highValue = missing.filter(card => 
      ['enchanted', 'legendary', 'super_rare', 'epic', 'iconic'].includes(card.rarity)
    );
    
    if (highValue.length > 0) {
      highValueMissing.push({
        source: sourceName,
        cards: highValue
      });
    }
  });
  
  console.log(`⭐ High-value cards missing:`);
  if (highValueMissing.length === 0) {
    console.log('   ✅ No high-value cards missing from any source!');
  } else {
    highValueMissing.forEach(({ source, cards }) => {
      console.log(`   ${source}: ${cards.length} high-value cards missing`);
      cards.forEach(card => {
        console.log(`     ${card.id}: ${card.name} (${card.rarity})`);
      });
    });
  }
  
  return {
    totalCards: allCoreCardIds.size,
    missingAnalysis,
    missingFromMultiple,
    highValueMissing
  };
}

// Run the analysis
const results = analyzeDetailedMissingCards();

// Save detailed results
fs.writeFileSync('./data/DETAILED_MISSING_CARDS.json', JSON.stringify(results, null, 2));
console.log('\n💾 Detailed missing cards analysis saved to DETAILED_MISSING_CARDS.json');