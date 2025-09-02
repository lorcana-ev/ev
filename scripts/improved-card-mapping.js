#!/usr/bin/env node
// Improved Card Mapping for JustTCG Data
// Handles variants, reprints, and special editions properly

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

function saveJustTcgData(data) {
  const filePath = path.join(process.cwd(), 'data', 'JUSTTCG.json');
  data.metadata.last_updated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('💾 Updated JUSTTCG.json with improved mappings');
}

function normalizeCardName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();
}

function findImprovedMatches(justTcgCard, allCards) {
  // Parse JustTCG card name and extract variant info
  let baseName = justTcgCard.name;
  let variant = null;
  let isEnchanted = false;
  let isEpic = false;
  let isIconic = false;
  
  // Extract variant information
  if (baseName.includes('(Enchanted)')) {
    variant = 'enchanted';
    isEnchanted = true;
    baseName = baseName.replace(/\s*\(Enchanted\)\s*$/, '');
  } else if (baseName.includes('(Epic)')) {
    variant = 'epic';
    isEpic = true;
    baseName = baseName.replace(/\s*\(Epic\)\s*$/, '');
  } else if (baseName.includes('(Iconic)')) {
    variant = 'iconic';
    isIconic = true;
    baseName = baseName.replace(/\s*\(Iconic\)\s*$/, '');
  }
  
  // Parse character and title
  let character, title;
  if (baseName.includes(' - ')) {
    [character, title] = baseName.split(' - ').map(s => s.trim());
  } else {
    character = baseName.trim();
    title = null;
  }
  
  const normalizedCharacter = normalizeCardName(character);
  const normalizedTitle = title ? normalizeCardName(title) : null;
  
  // Find all matches first
  const matches = allCards.filter(ourCard => {
    const ourCharacter = normalizeCardName(ourCard.name || '');
    const ourTitle = normalizeCardName(ourCard.title || '');
    
    const characterMatch = ourCharacter === normalizedCharacter;
    const titleMatch = !normalizedTitle || ourTitle === normalizedTitle;
    
    return characterMatch && titleMatch;
  });
  
  if (matches.length === 0) {
    return null;
  }
  
  // Now prioritize matches based on variant type and set
  let bestMatch = null;
  
  if (isEnchanted) {
    // Look for enchanted version first, then legendary/super rare from Set 9
    bestMatch = matches.find(m => m.rarity === 'enchanted') ||
                matches.find(m => m.setId === '009' && (m.rarity === 'legendary' || m.rarity === 'super rare')) ||
                matches.find(m => m.setId === '009');
  } else if (isEpic) {
    // Look for epic version first, then regular version from Set 9
    bestMatch = matches.find(m => m.rarity === 'epic') ||
                matches.find(m => m.setId === '009') ||
                matches[0]; // Fallback to first match
  } else if (isIconic) {
    // Look for iconic version first, then legendary/super rare from Set 9
    bestMatch = matches.find(m => m.rarity === 'iconic') ||
                matches.find(m => m.setId === '009' && (m.rarity === 'legendary' || m.rarity === 'super rare')) ||
                matches.find(m => m.setId === '009');
  } else {
    // For base versions, prefer Set 9 versions first
    bestMatch = matches.find(m => m.setId === '009') || matches[0];
  }
  
  return {
    match: bestMatch || matches[0],
    allMatches: matches,
    variantInfo: { variant, isEnchanted, isEpic, isIconic }
  };
}

function convertJustTcgCardToStandardFormat(justTcgCard, matchInfo, batchTimestamp) {
  if (!justTcgCard || !justTcgCard.variants || justTcgCard.variants.length === 0) {
    return null;
  }
  
  const result = {
    name: justTcgCard.name,
    set: justTcgCard.set,
    number: justTcgCard.number,
    rarity: justTcgCard.rarity,
    tcgplayerId: justTcgCard.tcgplayerId,
    fetched_at: batchTimestamp,
    matched_card_id: matchInfo.match.id,
    variant_info: matchInfo.variantInfo,
    all_potential_matches: matchInfo.allMatches.map(m => ({
      card_id: m.id,
      name: m.name,
      title: m.title,
      rarity: m.rarity,
      set_id: m.setId
    })),
    variants: {}
  };
  
  // Process all variants
  for (const variant of justTcgCard.variants) {
    const key = `${variant.condition || 'Near Mint'}_${variant.printing || 'Normal'}`.replace(/\s+/g, '_');
    
    result.variants[key] = {
      condition: variant.condition || 'Near Mint',
      printing: variant.printing || 'Normal',
      price: variant.price || 0,
      priceChange7d: variant.priceChange7d || 0,
      priceChange30d: variant.priceChange30d || 0,
      lastUpdated: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null
    };
  }
  
  return result;
}

function remapJustTcgData() {
  console.log('🔄 Re-mapping JustTCG data with improved variant handling...\n');
  
  const allCards = loadCards();
  const justTcgData = loadJustTcgData();
  
  if (!justTcgData || allCards.length === 0) {
    return;
  }
  
  // Clear existing mappings to start fresh
  justTcgData.cards = {};
  
  let totalCards = 0;
  let successfulMappings = 0;
  let variantMappings = 0;
  let sealedProducts = 0;
  
  console.log('🔍 Processing all JustTCG cards with improved mapping...\n');
  
  // Process all cards from all batches
  for (const [batchKey, batch] of Object.entries(justTcgData.batches)) {
    console.log(`📦 Processing ${batchKey}: ${batch.card_count} cards`);
    
    for (const justTcgCard of batch.raw_cards) {
      totalCards++;
      
      // Skip sealed products
      if (justTcgCard.name.includes('Booster Box') || 
          justTcgCard.name.includes('Starter Deck') ||
          justTcgCard.name.includes('Gift Set') ||
          justTcgCard.name.includes('Illumineer') ||
          justTcgCard.name.includes('Collection') ||
          justTcgCard.name.includes('Booster Pack')) {
        console.log(`   📦 Skipping sealed product: ${justTcgCard.name}`);
        sealedProducts++;
        continue;
      }
      
      console.log(`   🔍 Processing: ${justTcgCard.name}`);
      
      const matchInfo = findImprovedMatches(justTcgCard, allCards);
      
      if (matchInfo) {
        const pricingInfo = convertJustTcgCardToStandardFormat(justTcgCard, matchInfo, batch.fetched_at);
        
        if (pricingInfo) {
          // Use the matched card ID as the key
          const cardId = matchInfo.match.id;
          
          // If we already have data for this card, merge the variants
          if (justTcgData.cards[cardId]) {
            console.log(`   ⚙️  Merging variants for existing mapping: ${cardId}`);
            Object.assign(justTcgData.cards[cardId].variants, pricingInfo.variants);
            
            // Add this as an additional variant mapping
            if (!justTcgData.cards[cardId].additional_variants) {
              justTcgData.cards[cardId].additional_variants = [];
            }
            justTcgData.cards[cardId].additional_variants.push({
              justtcg_name: justTcgCard.name,
              variant_info: matchInfo.variantInfo
            });
          } else {
            justTcgData.cards[cardId] = pricingInfo;
          }
          
          successfulMappings++;
          
          if (matchInfo.variantInfo.variant) {
            variantMappings++;
            console.log(`   ✅ Mapped ${matchInfo.variantInfo.variant} variant: ${cardId} (${matchInfo.match.name} - ${matchInfo.match.title || 'N/A'})`);
          } else {
            console.log(`   ✅ Mapped base card: ${cardId} (${matchInfo.match.name} - ${matchInfo.match.title || 'N/A'})`);
          }
          
          // Show sample pricing
          const variants = Object.values(pricingInfo.variants);
          const bestPrice = variants.find(v => v.condition === 'Near Mint') || variants[0];
          if (bestPrice) {
            console.log(`     💰 $${bestPrice.price} (${variants.length} variants)`);
          }
        }
      } else {
        console.log(`   ❌ No match found for: ${justTcgCard.name}`);
      }
    }
  }
  
  // Update metadata
  justTcgData.metadata.total_cards_processed = totalCards;
  justTcgData.metadata.successful_mappings = successfulMappings;
  justTcgData.metadata.variant_mappings = variantMappings;
  justTcgData.metadata.sealed_products_skipped = sealedProducts;
  justTcgData.metadata.mapping_method = 'improved_variant_handling';
  
  // Save updated data
  saveJustTcgData(justTcgData);
  
  // Summary
  console.log('\n📊 Improved Mapping Summary:');
  console.log(`   Total JustTCG cards processed: ${totalCards}`);
  console.log(`   Sealed products skipped: ${sealedProducts}`);
  console.log(`   Successful mappings: ${successfulMappings}/${totalCards - sealedProducts} (${((successfulMappings / (totalCards - sealedProducts)) * 100).toFixed(1)}%)`);
  console.log(`   Variant cards mapped: ${variantMappings}`);
  console.log(`   Unique cards with pricing: ${Object.keys(justTcgData.cards).length}`);
  
  const set9Coverage = Object.keys(justTcgData.cards).filter(cardId => cardId.startsWith('009-')).length;
  console.log(`   Set 9 coverage: ${set9Coverage}/242 cards (${(set9Coverage / 242 * 100).toFixed(1)}%)`);
  
  return justTcgData;
}

// Export for use by other scripts
export { remapJustTcgData };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  remapJustTcgData();
}