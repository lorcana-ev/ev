#!/usr/bin/env node
// Rebuild unified pricing from scratch using only Dreamborn + JustTCG
// Skip TCGPlayer entirely

import fs from 'fs';
import path from 'path';

function loadDreambornPricing() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'USD.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading USD.json:', error.message);
    return null;
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

function loadLorcastData() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'LORCAST.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading LORCAST.json:', error.message);
    return null;
  }
}

function buildTcgPlayerMapping(lorcastData) {
  // Build a mapping of TCGPlayer ID → card ID using Lorcast data
  const mapping = {};

  if (!lorcastData || !lorcastData.cards) {
    return mapping;
  }

  for (const [cardId, cardData] of Object.entries(lorcastData.cards)) {
    const tcgPlayerId = cardData.raw_data?.tcgplayer_id;
    if (tcgPlayerId) {
      mapping[tcgPlayerId] = cardId;
    }
  }

  return mapping;
}

function extractTcgPlayerIdFromLink(link) {
  // Extract TCGPlayer product ID from URL like:
  // "https://partner.tcgplayer.com/c/4892540/1830156/21018/?u=https%3A%2F%2Ftcgplayer.com%2Fproduct%2F660029"
  if (!link) return null;

  const match = link.match(/product\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function remapDreambornHashes(dreambornData, tcgPlayerMapping) {
  // Remap Dreamborn's hash-based card IDs to proper card IDs using TCGPlayer IDs
  const remapped = {};
  let hashEntriesProcessed = 0;
  let hashEntriesRemapped = 0;
  let hashEntriesUnmapped = 0;
  let remappedViaProductId = 0;
  let remappedViaLink = 0;
  const unmappedEntries = [];

  for (const [cardId, priceData] of Object.entries(dreambornData)) {
    // Check if this is a hash-based ID (contains '/' character)
    if (cardId.includes('/')) {
      hashEntriesProcessed++;

      // Extract TCGPlayer ID from the pricing data
      // Try productId first (preferred), then fall back to extracting from link
      let tcgPlayerId = priceData.base?.TP?.productId || priceData.foil?.TP?.productId;
      let mappingMethod = null;

      if (tcgPlayerId) {
        mappingMethod = 'productId';
      } else {
        // Try extracting from links
        const baseLink = priceData.base?.TP?.link;
        const foilLink = priceData.foil?.TP?.link;
        tcgPlayerId = extractTcgPlayerIdFromLink(baseLink) || extractTcgPlayerIdFromLink(foilLink);

        if (tcgPlayerId) {
          mappingMethod = 'link';
        }
      }

      if (tcgPlayerId && tcgPlayerMapping[tcgPlayerId]) {
        // Found a mapping! Use the proper card ID
        const properCardId = tcgPlayerMapping[tcgPlayerId];
        remapped[properCardId] = priceData;
        hashEntriesRemapped++;

        if (mappingMethod === 'productId') {
          remappedViaProductId++;
        } else if (mappingMethod === 'link') {
          remappedViaLink++;
        }
      } else {
        // No mapping found, keep the hash ID but track it
        remapped[cardId] = priceData;
        hashEntriesUnmapped++;

        // Track why we couldn't map it
        unmappedEntries.push({
          hash: cardId,
          tcgPlayerId: tcgPlayerId,
          hasProductId: !!(priceData.base?.TP?.productId || priceData.foil?.TP?.productId),
          hasLink: !!(priceData.base?.TP?.link || priceData.foil?.TP?.link),
          hasPrice: !!(priceData.base?.TP?.price || priceData.foil?.TP?.price),
          reason: tcgPlayerId ? 'TCGPlayer ID not in Lorcast mapping' : 'No TCGPlayer ID found'
        });
      }
    } else {
      // Normal card ID, keep as-is
      remapped[cardId] = priceData;
    }
  }

  if (hashEntriesProcessed > 0) {
    console.log(`   🔗 Processed ${hashEntriesProcessed} hash-based entries:`);
    console.log(`      ✅ Remapped to proper IDs: ${hashEntriesRemapped}`);
    console.log(`         - Via productId: ${remappedViaProductId}`);
    console.log(`         - Via link extraction: ${remappedViaLink}`);
    console.log(`      ⚠️  Could not map: ${hashEntriesUnmapped}`);

    if (unmappedEntries.length > 0 && unmappedEntries.length <= 10) {
      console.log(`\n      Unmapped hash entries:`);
      unmappedEntries.forEach(entry => {
        console.log(`         ${entry.hash}:`);
        console.log(`            TCGPlayer ID: ${entry.tcgPlayerId || 'None'}`);
        console.log(`            Has productId: ${entry.hasProductId}, Has link: ${entry.hasLink}, Has price: ${entry.hasPrice}`);
        console.log(`            Reason: ${entry.reason}`);
      });
    } else if (unmappedEntries.length > 10) {
      console.log(`\n      (${unmappedEntries.length} unmapped entries - showing first 5):`);
      unmappedEntries.slice(0, 5).forEach(entry => {
        console.log(`         ${entry.hash}: ${entry.reason} (TCGPlayer ID: ${entry.tcgPlayerId || 'None'})`);
      });
    }
  }

  return remapped;
}

function extractJustTcgPricing(justTcgData) {
  const pricing = {};
  
  for (const [cardId, cardData] of Object.entries(justTcgData.cards)) {
    const variants = cardData.variants || {};
    
    // Extract base and foil pricing
    let basePrice = null;
    let foilPrice = null;
    
    // Look for Near Mint Normal (base)
    const nearMintNormal = variants['Near_Mint_Normal'] || variants['Near_Mint_Holofoil'];
    if (nearMintNormal && nearMintNormal.price > 0) {
      if (nearMintNormal.printing === 'Normal') {
        basePrice = nearMintNormal.price;
      } else if (nearMintNormal.printing === 'Holofoil') {
        foilPrice = nearMintNormal.price;
      }
    }
    
    // Look for foil variants
    const foilVariants = Object.values(variants).filter(v => 
      v.printing === 'Holofoil' && v.condition === 'Near Mint' && v.price > 0
    );
    
    if (foilVariants.length > 0) {
      foilPrice = foilVariants[0].price;
    }
    
    // Look for base variants if we haven't found one
    if (!basePrice) {
      const baseVariants = Object.values(variants).filter(v => 
        v.printing === 'Normal' && v.condition === 'Near Mint' && v.price > 0
      );
      
      if (baseVariants.length > 0) {
        basePrice = baseVariants[0].price;
      }
    }
    
    if (basePrice || foilPrice) {
      pricing[cardId] = {
        base_price: basePrice,
        foil_price: foilPrice,
        source: 'justtcg_api',
        reliability: 'high',
        last_updated: cardData.fetched_at,
        variant_count: Object.keys(variants).length
      };
    }
  }
  
  return pricing;
}

function buildUnifiedPricing() {
  console.log('🔧 Rebuilding unified pricing from Dreamborn + JustTCG sources...\n');

  const dreambornDataRaw = loadDreambornPricing();
  const justTcgData = loadJustTcgData();
  const lorcastData = loadLorcastData();

  if (!dreambornDataRaw) {
    console.error('❌ Cannot proceed without Dreamborn pricing data');
    return;
  }

  // Build TCGPlayer ID mapping and remap Dreamborn hash-based entries
  console.log('🔗 Building TCGPlayer ID mapping from Lorcast...');
  const tcgPlayerMapping = buildTcgPlayerMapping(lorcastData);
  console.log(`   Found ${Object.keys(tcgPlayerMapping).length} TCGPlayer ID mappings`);

  console.log('\n🔄 Remapping Dreamborn hash-based card IDs...');
  const dreambornData = remapDreambornHashes(dreambornDataRaw, tcgPlayerMapping);
  
  const unifiedData = {
    metadata: {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      sources: {
        dreamborn: 0,
        justtcg_api: 0
      },
      version: '2.0.0',
      note: 'Rebuilt with Dreamborn + JustTCG sources only'
    },
    cards: {}
  };
  
  // Extract JustTCG pricing
  let justTcgPricing = {};
  if (justTcgData) {
    console.log('📊 Extracting JustTCG pricing data...');
    justTcgPricing = extractJustTcgPricing(justTcgData);
    console.log(`   Found pricing for ${Object.keys(justTcgPricing).length} cards`);
  } else {
    console.log('⚠️  No JustTCG data found, using Dreamborn only');
  }
  
  console.log('\n🔄 Processing all cards...\n');
  
  // Get all unique card IDs from both sources
  const allCardIds = new Set([
    ...Object.keys(dreambornData),
    ...Object.keys(justTcgPricing)
  ]);
  
  let cardsWithBothSources = 0;
  let cardsWithOnlyDreamborn = 0;
  let cardsWithOnlyJustTcg = 0;
  let cardsSkippedNoPricing = 0;
  const skippedCards = [];

  for (const cardId of allCardIds) {
    const dreambornPrice = dreambornData[cardId];
    const justTcgPrice = justTcgPricing[cardId];
    
    if (!dreambornPrice && !justTcgPrice) continue;
    
    const cardData = {
      cardId: cardId,
      sources: {},
      unified_pricing: {}
    };
    
    // Add Dreamborn data
    if (dreambornPrice && (dreambornPrice.base?.TP?.price > 0 || dreambornPrice.foil?.TP?.price > 0)) {
      cardData.sources.dreamborn = {
        base_price: dreambornPrice.base?.TP?.price || null,
        foil_price: dreambornPrice.foil?.TP?.price || null,
        source: 'dreamborn_original',
        reliability: 'medium'
      };
      unifiedData.metadata.sources.dreamborn++;
    }
    
    // Add JustTCG data
    if (justTcgPrice) {
      cardData.sources.justtcg_api = justTcgPrice;
      unifiedData.metadata.sources.justtcg_api++;
    }
    
    // Calculate unified pricing
    const sourcesWithBase = Object.values(cardData.sources).filter(s => s.base_price && s.base_price > 0);
    const sourcesWithFoil = Object.values(cardData.sources).filter(s => s.foil_price && s.foil_price > 0);
    
    let basePrice = null;
    let foilPrice = null;
    let baseMethod = 'no_data';
    let foilMethod = 'no_data';
    let confidence = 'no_data';
    
    // Calculate base price
    if (sourcesWithBase.length === 1) {
      basePrice = sourcesWithBase[0].base_price;
      baseMethod = 'single_source';
    } else if (sourcesWithBase.length > 1) {
      // Weighted average (JustTCG gets 2x weight)
      let totalWeight = 0;
      let weightedSum = 0;
      
      sourcesWithBase.forEach(source => {
        const weight = source.source === 'justtcg_api' ? 2.0 : 1.0;
        weightedSum += source.base_price * weight;
        totalWeight += weight;
      });
      
      basePrice = Math.round((weightedSum / totalWeight) * 100) / 100;
      baseMethod = 'weighted_average';
    }
    
    // Calculate foil price (similar logic)
    if (sourcesWithFoil.length === 1) {
      foilPrice = sourcesWithFoil[0].foil_price;
      foilMethod = 'single_source';
    } else if (sourcesWithFoil.length > 1) {
      let totalWeight = 0;
      let weightedSum = 0;
      
      sourcesWithFoil.forEach(source => {
        const weight = source.source === 'justtcg_api' ? 2.0 : 1.0;
        weightedSum += source.foil_price * weight;
        totalWeight += weight;
      });
      
      foilPrice = Math.round((weightedSum / totalWeight) * 100) / 100;
      foilMethod = 'weighted_average';
    }
    
    // Determine confidence
    const hasBothSources = Object.keys(cardData.sources).length > 1;
    const hasJustTcg = !!cardData.sources.justtcg_api;
    
    if (baseMethod === 'weighted_average' || foilMethod === 'weighted_average') {
      confidence = 'high';
    } else if (hasJustTcg) {
      confidence = 'high';
    } else if (baseMethod !== 'no_data' || foilMethod !== 'no_data') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    cardData.unified_pricing = {
      base: basePrice,
      foil: foilPrice,
      confidence: confidence,
      last_calculated: new Date().toISOString(),
      base_method: baseMethod,
      foil_method: foilMethod,
      base_sources: sourcesWithBase.map(s => s.source),
      foil_sources: sourcesWithFoil.map(s => s.source)
    };

    // Skip cards with no actual pricing sources
    if (Object.keys(cardData.sources).length === 0) {
      cardsSkippedNoPricing++;
      skippedCards.push({
        cardId: cardId,
        inDreamborn: !!dreambornPrice,
        inJustTcg: !!justTcgPrice,
        dreambornHasBase: dreambornPrice?.base?.TP?.price > 0,
        dreambornHasFoil: dreambornPrice?.foil?.TP?.price > 0,
        justTcgHasBase: !!justTcgPrice?.base_price,
        justTcgHasFoil: !!justTcgPrice?.foil_price
      });
      continue; // Card exists in source data but has no valid pricing
    }

    unifiedData.cards[cardId] = cardData;

    // Count source combinations
    if (hasBothSources) {
      cardsWithBothSources++;
    } else if (cardData.sources.dreamborn) {
      cardsWithOnlyDreamborn++;
    } else if (cardData.sources.justtcg_api) {
      cardsWithOnlyJustTcg++;
    }
  }
  
  // Save the unified data
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json'),
    JSON.stringify(unifiedData, null, 2)
  );
  
  console.log('📊 Rebuilt Unified Pricing Summary:');
  console.log(`   Total cards with pricing: ${Object.keys(unifiedData.cards).length}`);
  console.log(`   Cards with both sources: ${cardsWithBothSources}`);
  console.log(`   Cards with only Dreamborn: ${cardsWithOnlyDreamborn}`);
  console.log(`   Cards with only JustTCG: ${cardsWithOnlyJustTcg}`);
  if (cardsSkippedNoPricing > 0) {
    console.log(`   ⚠️  Cards skipped (no valid pricing): ${cardsSkippedNoPricing}`);
  }
  console.log(`   Dreamborn coverage: ${unifiedData.metadata.sources.dreamborn} cards`);
  console.log(`   JustTCG coverage: ${unifiedData.metadata.sources.justtcg_api} cards`);

  // Show details about skipped cards
  if (skippedCards.length > 0) {
    console.log('\n⚠️  Skipped Cards (no valid pricing):');

    // Group by set
    const skippedBySet = {};
    skippedCards.forEach(card => {
      const setCode = card.cardId.split('-')[0];
      if (!skippedBySet[setCode]) skippedBySet[setCode] = [];
      skippedBySet[setCode].push(card);
    });

    Object.keys(skippedBySet).sort().forEach(setCode => {
      console.log(`\n   Set ${setCode}: ${skippedBySet[setCode].length} cards`);
      skippedBySet[setCode].forEach(card => {
        const reasons = [];
        if (card.inDreamborn && !card.dreambornHasBase && !card.dreambornHasFoil) reasons.push('Dreamborn: $0');
        if (card.inJustTcg && !card.justTcgHasBase && !card.justTcgHasFoil) reasons.push('JustTCG: $0');
        if (!card.inDreamborn && !card.inJustTcg) reasons.push('Not in any source');
        console.log(`      ${card.cardId}: ${reasons.join(', ')}`);
      });
    });
  }
  
  // Show Set 9 and Set 10 specific coverage
  const set9Cards = Object.keys(unifiedData.cards).filter(cardId => cardId.startsWith('009-'));
  const set9WithJustTcg = set9Cards.filter(cardId => unifiedData.cards[cardId].sources.justtcg_api);
  const set9WithDreamborn = set9Cards.filter(cardId => unifiedData.cards[cardId].sources.dreamborn);

  const set10Cards = Object.keys(unifiedData.cards).filter(cardId => cardId.startsWith('010-'));
  const set10WithJustTcg = set10Cards.filter(cardId => unifiedData.cards[cardId].sources.justtcg_api);
  const set10WithDreamborn = set10Cards.filter(cardId => unifiedData.cards[cardId].sources.dreamborn);
  const set10WithBothSources = set10Cards.filter(cardId =>
    unifiedData.cards[cardId].sources.justtcg_api && unifiedData.cards[cardId].sources.dreamborn
  );

  console.log(`\\n🎯 Set 9 (Fabled) Coverage:`);
  console.log(`   Total cards with pricing: ${set9Cards.length}`);
  console.log(`   Cards with JustTCG data: ${set9WithJustTcg.length}`);
  console.log(`   Cards with Dreamborn data: ${set9WithDreamborn.length}`);

  console.log(`\\n🎯 Set 10 (Whispers in the Well) Coverage:`);
  console.log(`   Total cards with pricing: ${set10Cards.length}`);
  console.log(`   Cards with JustTCG data: ${set10WithJustTcg.length}`);
  console.log(`   Cards with Dreamborn data: ${set10WithDreamborn.length}`);
  console.log(`   Cards with both sources: ${set10WithBothSources.length}`);

  // Show some examples from Set 10
  if (set10Cards.length > 0) {
    console.log('\\n📝 Sample Set 10 cards:');
    set10Cards.slice(0, 5).forEach(cardId => {
      const cardData = unifiedData.cards[cardId];
      const sources = Object.keys(cardData.sources).join(', ');
      console.log(`   ${cardId}:`);
      console.log(`     Base: $${cardData.unified_pricing.base || 'N/A'} (${cardData.unified_pricing.base_method})`);
      console.log(`     Foil: $${cardData.unified_pricing.foil || 'N/A'} (${cardData.unified_pricing.foil_method})`);
      console.log(`     Sources: ${sources}`);
      console.log(`     Confidence: ${cardData.unified_pricing.confidence}`);
    });
  }
  
  console.log('\\n💾 Saved rebuilt UNIFIED_PRICING.json');
  return unifiedData;
}

// Export for use by other scripts
export { buildUnifiedPricing };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildUnifiedPricing();
}