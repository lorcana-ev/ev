#!/usr/bin/env node
// Analyze unmapped JustTCG cards to identify potential reprints

import fs from 'fs';
import path from 'path';

function loadCards() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'cards-formatted.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading cards-formatted.json:', error.message);
    return [];
  }
}

function loadJustTcgData() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'JUSTTCG.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading JUSTTCG.json:', error.message);
    return null;
  }
}

function normalizeCardName(name) {
  // Remove extra formatting and normalize for comparison
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();
}

function findPotentialMatches(justTcgCard, allCards) {
  // Parse JustTCG card name
  let character, title;
  const cleanName = justTcgCard.name.replace(/\s*\([^)]*\)\s*$/, ''); // Remove (Iconic), (Epic) etc.
  
  if (cleanName.includes(' - ')) {
    [character, title] = cleanName.split(' - ').map(s => s.trim());
  } else {
    character = cleanName.trim();
    title = null;
  }
  
  const normalizedCharacter = normalizeCardName(character);
  const normalizedTitle = title ? normalizeCardName(title) : null;
  
  // Find potential matches across all sets
  const matches = allCards.filter(ourCard => {
    const ourCharacter = normalizeCardName(ourCard.name || '');
    const ourTitle = normalizeCardName(ourCard.title || '');
    
    const characterMatch = ourCharacter === normalizedCharacter;
    const titleMatch = !normalizedTitle || ourTitle === normalizedTitle;
    
    return characterMatch && titleMatch;
  });
  
  return matches;
}

function analyzeUnmappedCards() {
  console.log('🔍 Analyzing unmapped JustTCG cards for potential reprints...\n');
  
  const allCards = loadCards();
  const justTcgData = loadJustTcgData();
  
  if (!justTcgData || allCards.length === 0) {
    return;
  }
  
  // List of cards that failed to map to Set 9
  const unmappedCards = [
    'A Pirate\'s Life',
    'White Rabbit\'s Pocket Watch',
    'Bruno Madrigal - Undetected Uncle',
    'Ursula\'s Shell Necklace',
    'Beast\'s Mirror',
    'I Find \'Em, I Flatten \'Em'
  ];
  
  console.log(`📊 Analyzing ${unmappedCards.length} unmapped cards:\n`);
  
  for (const cardName of unmappedCards) {
    console.log(`🎯 Analyzing: "${cardName}"`);
    
    // Create a mock JustTCG card object for analysis
    const mockJustTcgCard = { name: cardName };
    const potentialMatches = findPotentialMatches(mockJustTcgCard, allCards);
    
    if (potentialMatches.length > 0) {
      console.log(`   ✅ Found ${potentialMatches.length} potential match(es):`);
      potentialMatches.forEach(match => {
        console.log(`      ${match.id} (Set ${match.setId}): ${match.name} - ${match.title || 'N/A'} (${match.rarity})`);
      });
    } else {
      console.log(`   ❌ No matches found in existing database`);
    }
    console.log();
  }
  
  // Also analyze all unmapped cards from the actual JustTCG data
  console.log('🔍 Analyzing all JustTCG cards that failed to map...\n');
  
  const unmappedFromJustTcg = [];
  
  // Go through all JustTCG batches and find cards that weren't mapped
  for (const [batchKey, batch] of Object.entries(justTcgData.batches)) {
    for (const card of batch.raw_cards) {
      // Check if this card was successfully mapped
      const wasSuccessfullyMapped = Object.values(justTcgData.cards).some(mappedCard => 
        mappedCard.name === card.name
      );
      
      if (!wasSuccessfullyMapped) {
        unmappedFromJustTcg.push(card);
      }
    }
  }
  
  console.log(`📊 Found ${unmappedFromJustTcg.length} unmapped cards from JustTCG data:\n`);
  
  const reprints = [];
  const truelyMissing = [];
  const sealedProducts = [];
  
  for (const card of unmappedFromJustTcg) {
    console.log(`🔍 ${card.name}`);
    
    // Skip obvious sealed products
    if (card.name.includes('Booster Box') || 
        card.name.includes('Starter Deck') ||
        card.name.includes('Gift Set') ||
        card.name.includes('Illumineer') ||
        card.name.includes('Collection') ||
        card.name.includes('Booster Pack')) {
      console.log('   📦 Sealed product - skipping');
      sealedProducts.push(card);
      continue;
    }
    
    const potentialMatches = findPotentialMatches(card, allCards);
    
    if (potentialMatches.length > 0) {
      console.log(`   ✅ Potential reprint! Found ${potentialMatches.length} match(es):`);
      potentialMatches.forEach(match => {
        console.log(`      ${match.id} (Set ${match.setId}): ${match.name} - ${match.title || 'N/A'} (${match.rarity})`);
      });
      
      reprints.push({
        justTcgCard: card,
        potentialMatches: potentialMatches
      });
    } else {
      console.log('   ❌ No matches - truly missing from database');
      truelyMissing.push(card);
    }
    console.log();
  }
  
  // Summary
  console.log('📊 Analysis Summary:');
  console.log(`   Sealed products: ${sealedProducts.length}`);
  console.log(`   Potential reprints: ${reprints.length}`);
  console.log(`   Truly missing cards: ${truelyMissing.length}`);
  console.log();
  
  if (reprints.length > 0) {
    console.log('🔄 Identified Reprints:');
    reprints.forEach(reprint => {
      const bestMatch = reprint.potentialMatches[0]; // Take the first/best match
      console.log(`   "${reprint.justTcgCard.name}" → ${bestMatch.id} (${bestMatch.name} - ${bestMatch.title || 'N/A'})`);
    });
    console.log();
  }
  
  if (truelyMissing.length > 0) {
    console.log('❓ Truly Missing Cards (need to be added to database):');
    truelyMissing.forEach(card => {
      console.log(`   ${card.name} (${card.rarity || 'Unknown rarity'})`);
    });
  }
  
  return {
    sealedProducts: sealedProducts.length,
    reprints: reprints.length,
    trulyMissing: truelyMissing.length,
    reprintData: reprints
  };
}

// Export for use by other scripts
export { analyzeUnmappedCards };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeUnmappedCards();
}