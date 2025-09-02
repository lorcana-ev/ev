#!/usr/bin/env node
// Analyze name mismatches across sources to understand patterns

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

function normalizeCardName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function analyzeNameMismatches() {
  console.log('🔍 Analyzing Name Mismatches Across Sources\n');
  
  const { dreambornCards, lorcastCards, justTcgCards } = loadSources();
  const coreSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  
  const nameMismatches = [];
  const namePatterns = {
    punctuation_differences: [],
    case_differences: [],
    word_order_differences: [],
    significant_differences: [],
    subtitle_differences: []
  };
  
  // Get all core set card IDs
  const coreCardIds = new Set();
  [dreambornCards, lorcastCards, justTcgCards].forEach(source => {
    Object.keys(source).forEach(cardId => {
      const setCode = cardId.split('-')[0];
      if (coreSets.includes(setCode)) {
        coreCardIds.add(cardId);
      }
    });
  });
  
  Array.from(coreCardIds).forEach(cardId => {
    const dreamborn = dreambornCards[cardId];
    const lorcast = lorcastCards[cardId];
    const justtcg = justTcgCards[cardId];
    
    const names = {
      dreamborn: dreamborn?.name || null,
      lorcast: lorcast?.name || null,
      justtcg: justtcg?.name || null
    };
    
    // Compare names between available sources
    const availableSources = Object.entries(names).filter(([source, name]) => name !== null);
    
    if (availableSources.length >= 2) {
      const [source1, name1] = availableSources[0];
      const [source2, name2] = availableSources[1];
      
      if (name1 !== name2) {
        const mismatch = {
          cardId,
          names,
          normalized: {
            [source1]: normalizeCardName(name1),
            [source2]: normalizeCardName(name2)
          },
          setCode: cardId.split('-')[0]
        };
        
        nameMismatches.push(mismatch);
        
        // Categorize the type of mismatch
        const norm1 = normalizeCardName(name1);
        const norm2 = normalizeCardName(name2);
        
        if (norm1 === norm2) {
          // Only punctuation/case differences
          if (name1.toLowerCase() === name2.toLowerCase()) {
            namePatterns.case_differences.push(mismatch);
          } else {
            namePatterns.punctuation_differences.push(mismatch);
          }
        } else if (name1.includes(' - ') || name2.includes(' - ')) {
          // Subtitle differences
          namePatterns.subtitle_differences.push(mismatch);
        } else if (norm1.split(' ').sort().join(' ') === norm2.split(' ').sort().join(' ')) {
          // Word order differences
          namePatterns.word_order_differences.push(mismatch);
        } else {
          // Significant differences
          namePatterns.significant_differences.push(mismatch);
        }
      }
    }
  });
  
  console.log(`📊 Name Mismatch Analysis Results:`);
  console.log(`   Total cards analyzed: ${coreCardIds.size}`);
  console.log(`   Cards with name mismatches: ${nameMismatches.length}`);
  console.log('');
  
  console.log('📋 Mismatch Categories:');
  Object.entries(namePatterns).forEach(([category, matches]) => {
    console.log(`   ${category.replace(/_/g, ' ')}: ${matches.length} cases`);
    
    if (matches.length > 0) {
      console.log('     Examples:');
      matches.slice(0, 3).forEach(match => {
        const availableNames = Object.entries(match.names)
          .filter(([source, name]) => name !== null)
          .map(([source, name]) => `${source}: "${name}"`)
          .join(' vs ');
        console.log(`       ${match.cardId}: ${availableNames}`);
      });
      if (matches.length > 3) {
        console.log(`       ... and ${matches.length - 3} more`);
      }
      console.log('');
    }
  });
  
  // Set-by-set breakdown
  console.log('📈 Name Mismatches by Set:');
  const setBreakdown = {};
  nameMismatches.forEach(match => {
    const setCode = match.setCode;
    if (!setBreakdown[setCode]) setBreakdown[setCode] = 0;
    setBreakdown[setCode]++;
  });
  
  coreSets.forEach(setCode => {
    const count = setBreakdown[setCode] || 0;
    console.log(`   Set ${setCode}: ${count} name mismatches`);
  });
  
  // Check for patterns that might indicate systematic issues
  console.log('\n🔍 Pattern Analysis:');
  
  const dreambornLorcastMismatches = nameMismatches.filter(m => 
    m.names.dreamborn && m.names.lorcast && m.names.dreamborn !== m.names.lorcast
  );
  console.log(`   Dreamborn vs Lorcast mismatches: ${dreambornLorcastMismatches.length}`);
  
  const dreambornJustTcgMismatches = nameMismatches.filter(m =>
    m.names.dreamborn && m.names.justtcg && m.names.dreamborn !== m.names.justtcg
  );
  console.log(`   Dreamborn vs JustTCG mismatches: ${dreambornJustTcgMismatches.length}`);
  
  const lorcastJustTcgMismatches = nameMismatches.filter(m =>
    m.names.lorcast && m.names.justtcg && m.names.lorcast !== m.names.justtcg
  );
  console.log(`   Lorcast vs JustTCG mismatches: ${lorcastJustTcgMismatches.length}`);
  
  return {
    totalMismatches: nameMismatches.length,
    patterns: namePatterns,
    setBreakdown,
    allMismatches: nameMismatches
  };
}

// Run the analysis
const results = analyzeNameMismatches();

// Save detailed results
fs.writeFileSync('./data/NAME_MISMATCH_ANALYSIS.json', JSON.stringify(results, null, 2));
console.log('\n💾 Name mismatch analysis saved to NAME_MISMATCH_ANALYSIS.json');