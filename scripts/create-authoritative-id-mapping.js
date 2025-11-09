#!/usr/bin/env node
/**
 * Create Authoritative Card ID Mapping
 * 
 * This script creates a canonical mapping between different card ID formats used by various sources:
 * - Dreamborn hash IDs (e.g., "010/8384b543c69a62baaba2fe2b4b3dab2b87123648")
 * - Standard set-number IDs (e.g., "010-001")
 * - TCGPlayer product IDs
 * - JustTCG identifiers
 * - Lorcast identifiers
 * 
 * The mapping uses TCGPlayer IDs as the authoritative bridge between sources,
 * following the same approach used in rebuild-unified-pricing.js.
 */

import fs from 'fs';
import path from 'path';

function loadSourceData() {
  console.log('📁 Loading source data files...\n');
  
  const sources = {};
  
  // Load cards.json (Dreamborn card data with hash IDs)
  try {
    sources.cards = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
    console.log(`✅ cards.json: ${sources.cards.length} cards`);
  } catch (error) {
    console.error('❌ Failed to load cards.json:', error.message);
    process.exit(1);
  }
  
  // Load LORCAST.json (metadata with TCGPlayer IDs)
  try {
    sources.lorcast = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    console.log(`✅ LORCAST.json: ${Object.keys(sources.lorcast.cards).length} cards`);
  } catch (error) {
    console.warn('⚠️  LORCAST.json not available:', error.message);
    sources.lorcast = { cards: {} };
  }
  
  // Load JUSTTCG.json (JustTCG pricing data)
  try {
    sources.justtcg = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
    console.log(`✅ JUSTTCG.json: ${Object.keys(sources.justtcg.cards).length} cards`);
  } catch (error) {
    console.warn('⚠️  JUSTTCG.json not available:', error.message);
    sources.justtcg = { cards: {} };
  }
  
  // Load USD.json (Dreamborn pricing with possible hash IDs)
  try {
    sources.dreamborn_prices = JSON.parse(fs.readFileSync('./data/USD.json', 'utf8'));
    console.log(`✅ USD.json: ${Object.keys(sources.dreamborn_prices).length} price entries`);
  } catch (error) {
    console.warn('⚠️  USD.json not available:', error.message);
    sources.dreamborn_prices = {};
  }
  
  // Load MANUAL_TCGPLAYER.json
  try {
    sources.manual_tcgplayer = JSON.parse(fs.readFileSync('./data/MANUAL_TCGPLAYER.json', 'utf8'));
    console.log(`✅ MANUAL_TCGPLAYER.json: ${Object.keys(sources.manual_tcgplayer.cards || {}).length} cards`);
  } catch (error) {
    console.warn('⚠️  MANUAL_TCGPLAYER.json not available:', error.message);
    sources.manual_tcgplayer = { cards: {} };
  }
  
  return sources;
}

function buildTcgPlayerIdMapping(lorcastData) {
  // Build TCGPlayer ID → set-number card ID mapping from Lorcast
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
  // Extract TCGPlayer product ID from URL
  if (!link) return null;
  const match = link.match(/product\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function createAuthoritativeMapping(sources) {
  console.log('\n🔨 Building authoritative card ID mapping (Sets 1-10 only)...\n');
  
  const mapping = {
    metadata: {
      created_at: new Date().toISOString(),
      version: '1.0.0',
      description: 'Authoritative mapping between card ID formats from different sources (Sets 1-10 only, no promo cards)',
      sources: {
        cards_json: sources.cards.length,
        lorcast: Object.keys(sources.lorcast.cards).length,
        justtcg: Object.keys(sources.justtcg.cards).length,
        dreamborn_prices: Object.keys(sources.dreamborn_prices).length,
        manual_tcgplayer: Object.keys(sources.manual_tcgplayer.cards || {}).length
      },
      id_formats: {
        canonical: 'set-number format (e.g., "010-001") - used for all pricing lookups',
        dreamborn_hash: 'hash format (e.g., "010/8384b543c69...") - used in cards.json',
        tcgplayer_id: 'TCGPlayer product ID (numeric) - authoritative bridge between sources'
      },
      included_sets: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010']
    },
    cards: {},
    statistics: {
      total_cards: 0,
      cards_with_tcgplayer_id: 0,
      cards_with_hash_id: 0,
      cards_with_dreamborn_pricing: 0,
      cards_with_justtcg_pricing: 0,
      cards_with_lorcast_data: 0,
      cards_with_manual_pricing: 0,
      hash_ids_mapped: 0,
      hash_ids_unmapped: 0,
      promo_cards_skipped: 0
    }
  };
  
  // Build TCGPlayer ID mapping from Lorcast
  const tcgPlayerMapping = buildTcgPlayerIdMapping(sources.lorcast);
  console.log(`📋 Built TCGPlayer ID mapping: ${Object.keys(tcgPlayerMapping).length} IDs`);
  
  // Define valid set codes (Sets 1-10 only)
  const validSets = new Set(['001', '002', '003', '004', '005', '006', '007', '008', '009', '010']);
  
  // Process all cards from cards.json
  for (const card of sources.cards) {
    const setId = card.setId || card.set?.code || card.setCode;
    const number = String(card.number || card.nr || '');
    
    if (!setId || !number) {
      continue; // Skip cards without proper identification
    }
    
    // Skip promo cards and non-standard sets
    if (!validSets.has(setId)) {
      mapping.statistics.promo_cards_skipped++;
      continue;
    }
    
    // Skip promo variants with non-numeric card numbers (e.g., "13/P3", "27/P2")
    // or cards explicitly marked as promo rarity
    const hasPromoNumber = number.includes('P2') || number.includes('P3') || number.includes('/');
    const isPromoRarity = card.rarity === 'promo';
    
    if (hasPromoNumber || isPromoRarity) {
      mapping.statistics.promo_cards_skipped++;
      continue;
    }
    
    // Create canonical ID (set-number format with zero-padded number)
    const paddedNumber = number.padStart(3, '0');
    const canonicalId = `${setId}-${paddedNumber}`;
    
    // Initialize card entry
    const cardEntry = {
      canonical_id: canonicalId,
      set_id: setId,
      number: number,
      name: card.name || 'Unknown',
      title: card.title || null,
      rarity: card.rarity || null,
      identifiers: {
        dreamborn_hash: null,
        tcgplayer_id: null,
        justtcg_available: false,
        lorcast_available: false,
        manual_tcgplayer_available: false
      },
      pricing_availability: {
        dreamborn: false,
        justtcg: false,
        lorcast: false,
        manual_tcgplayer: false
      },
      finish_mappings: {
        // Map canonical finish names to source-specific representations
        // Canonical: base, foil, special (for enchanted)
        // This tells us what finishes are available from which sources
        base: [],
        foil: [],
        special: []
      }
    };
    
    // Check if this card has a hash-based ID in cards.json
    if (card.id && card.id.includes('/')) {
      cardEntry.identifiers.dreamborn_hash = card.id;
      mapping.statistics.cards_with_hash_id++;
    }
    
    // Try to extract TCGPlayer ID from Dreamborn pricing data
    // Check both canonical ID and hash ID (for promo cards, card.id might be the canonical ID like "P2-015")
    const dreambornPrice = sources.dreamborn_prices[canonicalId] || 
                           sources.dreamborn_prices[card.id] ||
                           (cardEntry.identifiers.dreamborn_hash ? sources.dreamborn_prices[cardEntry.identifiers.dreamborn_hash] : null);
    
    if (dreambornPrice) {
      let tcgPlayerId = dreambornPrice.base?.TP?.productId || dreambornPrice.foil?.TP?.productId;
      
      if (!tcgPlayerId) {
        // Try extracting from links
        const baseLink = dreambornPrice.base?.TP?.link;
        const foilLink = dreambornPrice.foil?.TP?.link;
        tcgPlayerId = extractTcgPlayerIdFromLink(baseLink) || extractTcgPlayerIdFromLink(foilLink);
      }
      
      if (tcgPlayerId) {
        cardEntry.identifiers.tcgplayer_id = tcgPlayerId;
      }
    }
    
    // Verify hash ID mapping worked (if applicable)
    if (cardEntry.identifiers.dreamborn_hash) {
      if (cardEntry.identifiers.tcgplayer_id && tcgPlayerMapping[cardEntry.identifiers.tcgplayer_id] === canonicalId) {
        mapping.statistics.hash_ids_mapped++;
      } else {
        mapping.statistics.hash_ids_unmapped++;
      }
    }
    
    // Check Lorcast for TCGPlayer ID if we don't have it yet
    const lorcastCard = sources.lorcast.cards[canonicalId];
    if (lorcastCard) {
      cardEntry.identifiers.lorcast_available = true;
      mapping.statistics.cards_with_lorcast_data++;
      
      if (!cardEntry.identifiers.tcgplayer_id && lorcastCard.raw_data?.tcgplayer_id) {
        cardEntry.identifiers.tcgplayer_id = lorcastCard.raw_data.tcgplayer_id;
      }
    }
    
    // Check pricing availability and finish mappings
    
    // Dreamborn pricing (already loaded above for TCGPlayer ID extraction)
    if (dreambornPrice) {
      cardEntry.pricing_availability.dreamborn = true;
      mapping.statistics.cards_with_dreamborn_pricing++;
      
      // Track which finishes Dreamborn has for this card
      if (dreambornPrice.base?.TP?.price) cardEntry.finish_mappings.base.push('dreamborn');
      if (dreambornPrice.foil?.TP?.price) {
        // For enchanted cards, map foil to special
        if (card.rarity === 'enchanted') {
          cardEntry.finish_mappings.special.push('dreamborn');
        } else {
          cardEntry.finish_mappings.foil.push('dreamborn');
        }
      }
    }
    
    // JustTCG pricing
    const justTcgCard = sources.justtcg.cards[canonicalId];
    if (justTcgCard) {
      cardEntry.identifiers.justtcg_available = true;
      cardEntry.pricing_availability.justtcg = true;
      mapping.statistics.cards_with_justtcg_pricing++;
      
      // Track which finishes JustTCG has
      if (justTcgCard.variants) {
        const hasNormal = Object.keys(justTcgCard.variants).some(k => k.includes('Normal'));
        const hasFoil = Object.keys(justTcgCard.variants).some(k => k.includes('Cold Foil') || k.includes('Holofoil'));
        
        if (hasNormal) cardEntry.finish_mappings.base.push('justtcg');
        if (hasFoil) {
          if (card.rarity === 'enchanted') {
            cardEntry.finish_mappings.special.push('justtcg');
          } else {
            cardEntry.finish_mappings.foil.push('justtcg');
          }
        }
      }
    }
    
    // Lorcast pricing
    if (lorcastCard && lorcastCard.raw_data?.prices) {
      cardEntry.pricing_availability.lorcast = true;
      
      // Track which finishes Lorcast has
      if (lorcastCard.raw_data.prices.usd) cardEntry.finish_mappings.base.push('lorcast');
      if (lorcastCard.raw_data.prices.usd_foil) {
        if (card.rarity === 'enchanted') {
          cardEntry.finish_mappings.special.push('lorcast');
        } else {
          cardEntry.finish_mappings.foil.push('lorcast');
        }
      }
    }
    
    // Manual TCGPlayer pricing
    const manualCard = sources.manual_tcgplayer.cards?.[canonicalId];
    if (manualCard) {
      cardEntry.identifiers.manual_tcgplayer_available = true;
      cardEntry.pricing_availability.manual_tcgplayer = true;
      mapping.statistics.cards_with_manual_pricing++;
      
      // Track which finishes Manual TCGPlayer has
      if (manualCard.base_price) cardEntry.finish_mappings.base.push('manual_tcgplayer');
      if (manualCard.foil_price) {
        if (card.rarity === 'enchanted') {
          cardEntry.finish_mappings.special.push('manual_tcgplayer');
        } else {
          cardEntry.finish_mappings.foil.push('manual_tcgplayer');
        }
      }
    }
    
    // Track TCGPlayer ID availability
    if (cardEntry.identifiers.tcgplayer_id) {
      mapping.statistics.cards_with_tcgplayer_id++;
    }
    
    // Add to mapping
    mapping.cards[canonicalId] = cardEntry;
    mapping.statistics.total_cards++;
  }
  
  return mapping;
}

function generateReport(mapping) {
  console.log('\n📊 Mapping Statistics (Sets 1-10 only):\n');
  console.log(`   Total cards: ${mapping.statistics.total_cards}`);
  console.log(`   Promo cards skipped: ${mapping.statistics.promo_cards_skipped}`);
  console.log(`   Cards with TCGPlayer ID: ${mapping.statistics.cards_with_tcgplayer_id} (${(mapping.statistics.cards_with_tcgplayer_id / mapping.statistics.total_cards * 100).toFixed(1)}%)`);
  console.log(`   Cards with hash ID: ${mapping.statistics.cards_with_hash_id}`);
  console.log(`   Hash IDs successfully mapped: ${mapping.statistics.hash_ids_mapped}`);
  console.log(`   Hash IDs unmapped: ${mapping.statistics.hash_ids_unmapped}`);
  console.log('');
  console.log('   Pricing source coverage:');
  console.log(`     - Dreamborn: ${mapping.statistics.cards_with_dreamborn_pricing} cards (${(mapping.statistics.cards_with_dreamborn_pricing / mapping.statistics.total_cards * 100).toFixed(1)}%)`);
  console.log(`     - JustTCG: ${mapping.statistics.cards_with_justtcg_pricing} cards (${(mapping.statistics.cards_with_justtcg_pricing / mapping.statistics.total_cards * 100).toFixed(1)}%)`);
  console.log(`     - Lorcast: ${mapping.statistics.cards_with_lorcast_data} cards (${(mapping.statistics.cards_with_lorcast_data / mapping.statistics.total_cards * 100).toFixed(1)}%)`);
  console.log(`     - Manual TCGPlayer: ${mapping.statistics.cards_with_manual_pricing} cards (${(mapping.statistics.cards_with_manual_pricing / mapping.statistics.total_cards * 100).toFixed(1)}%)`);
  
  // Sample unmapped hash cards
  const unmappedHashCards = Object.values(mapping.cards)
    .filter(c => c.identifiers.dreamborn_hash && !c.identifiers.tcgplayer_id)
    .slice(0, 5);
  
  if (unmappedHashCards.length > 0) {
    console.log('\n⚠️  Sample unmapped hash IDs (no TCGPlayer ID found):');
    unmappedHashCards.forEach(card => {
      console.log(`   ${card.canonical_id}: ${card.name}${card.title ? ' - ' + card.title : ''}`);
      console.log(`      Hash: ${card.identifiers.dreamborn_hash}`);
    });
  }
}

function saveMapping(mapping) {
  const outputPath = path.join(process.cwd(), 'data', 'AUTHORITATIVE_CARD_ID_MAPPING.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
  console.log(`\n💾 Saved authoritative mapping to: ${outputPath}`);
  
  // Also create a simplified lookup file for quick hash -> canonical ID lookups
  const simplifiedLookup = {
    metadata: {
      created_at: mapping.metadata.created_at,
      version: mapping.metadata.version,
      description: 'Simplified lookup for hash ID to canonical ID conversion'
    },
    hash_to_canonical: {},
    canonical_to_hash: {}
  };
  
  for (const [canonicalId, card] of Object.entries(mapping.cards)) {
    if (card.identifiers.dreamborn_hash) {
      simplifiedLookup.hash_to_canonical[card.identifiers.dreamborn_hash] = canonicalId;
      simplifiedLookup.canonical_to_hash[canonicalId] = card.identifiers.dreamborn_hash;
    }
  }
  
  const lookupPath = path.join(process.cwd(), 'data', 'CARD_ID_LOOKUP.json');
  fs.writeFileSync(lookupPath, JSON.stringify(simplifiedLookup, null, 2));
  console.log(`💾 Saved simplified lookup to: ${lookupPath}`);
}

function main() {
  console.log('🚀 Creating Authoritative Card ID Mapping\n');
  console.log('This mapping provides a canonical reference for all card identifiers');
  console.log('and tracks pricing availability across all sources.\n');
  
  const sources = loadSourceData();
  const mapping = createAuthoritativeMapping(sources);
  generateReport(mapping);
  saveMapping(mapping);
  
  console.log('\n✅ Mapping creation complete!');
  console.log('\nUsage:');
  console.log('  - Use AUTHORITATIVE_CARD_ID_MAPPING.json for comprehensive card data');
  console.log('  - Use CARD_ID_LOOKUP.json for quick hash ↔ canonical ID conversions');
}

main();

