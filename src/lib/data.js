// src/lib/data.js
import { mapRarity } from './util.js';

/**
 * Load the authoritative card ID mapping.
 * This provides canonical hash -> set-number ID conversions.
 */
async function loadCardIdMapping() {
  try {
    const lookup = await fetch('./data/CARD_ID_LOOKUP.json').then(r => r.json());
    const mapping = new Map();
    
    // Convert to Map for fast lookups
    for (const [hashId, canonicalId] of Object.entries(lookup.hash_to_canonical)) {
      mapping.set(hashId, canonicalId);
    }
    
    console.log(`Loaded card ID mapping: ${mapping.size} hash IDs mapped to canonical format`);
    return mapping;
  } catch (error) {
    console.warn('Card ID lookup not available, will construct IDs from set/number:', error.message);
    return new Map();
  }
}

export async function loadAll() {
  const [filters, sorts, cards, manualTcgPlayerData, dreambornPrices, lorcastData, justTcgData, packModel, cardIdMapping] = await Promise.all([
    fetch('./data/filters.json').then(r => r.json()),
    fetch('./data/sorts.json').then(r => r.json()),
    fetch('./data/cards.json').then(r => r.json()),
    fetch('./data/MANUAL_TCGPLAYER.json').then(r => r.json()).catch(err => {
      console.warn('Manual TCGPlayer pricing not available:', err.message);
      return null;
    }),
    fetch('./data/USD.json').then(r => r.json()).catch(() => null),
    fetch('./data/LORCAST.json').then(r => r.json()).catch(() => null),
    fetch('./data/JUSTTCG.json').then(r => r.json()).catch(() => null),
    fetch('./config/pack_model.json').then(r => r.json()),
    loadCardIdMapping(),
  ]);
  
  const printings = buildPrintings(cards, cardIdMapping);

  console.log('Loaded pricing sources:', {
    manual_tcgplayer: manualTcgPlayerData ? Object.keys(manualTcgPlayerData.cards || {}).length + ' cards' : 'not available',
    justtcg: justTcgData ? 'loaded' : 'not available',
    dreamborn: dreambornPrices ? Object.keys(dreambornPrices).length + ' entries' : 'not available',
    lorcast: lorcastData ? 'loaded' : 'not available'
  });

  // Bundle all pricing sources - four sources with priority: Manual TCGPlayer > JustTCG > Dreamborn > Lorcast
  const allPricingSources = {
    manual_tcgplayer: manualTcgPlayerData,
    justtcg: justTcgData,
    dreamborn: dreambornPrices,
    lorcast: lorcastData
  };

  // For backward compatibility with code that uses state.priceIndex,
  // return Dreamborn as the fallback (it has the most complete data structure)
  // The primary pricing now comes from multiSourcePricing which handles all 4 sources
  return { filters, sorts, cards, printings, prices: dreambornPrices, allPricingSources, packModel };
}

/**
 * Build one row per printing/finish. 
 * Creates separate entries for base and foil variants of each card.
 * Uses cardIdMapping to convert hash-based IDs to set-number format for pricing lookups.
 */
export function buildPrintings(cardsBlob, cardIdMapping = new Map()) {
  const out = [];
  const cardArray = Array.isArray(cardsBlob) ? cardsBlob : Object.values(cardsBlob);
  
  for (const c of cardArray) {
    const set_code = c?.setId || c?.set?.code || c?.setCode || c?.set || 'UNK';
    const set_name = c?.set?.name || c?.setName || set_code;
    const number = String(c?.number ?? c?.nr ?? '');
    const name = c?.name || 'Unknown';
    const baseRarity = mapRarity(c?.rarity);
    
    // Determine the proper card ID for pricing lookups
    // If this card has a hash-based ID, use the mapping to get the set-number format
    let pricingCardId;
    if (c.id && cardIdMapping.has(c.id)) {
      // Use mapped ID (hash -> set-number)
      pricingCardId = cardIdMapping.get(c.id);
    } else if (c.id && !c.id.includes('/')) {
      // Already in proper format (e.g., "010-001")
      pricingCardId = c.id;
    } else {
      // Fallback: construct from set and number
      const paddedNumber = String(number).padStart(3, '0');
      pricingCardId = `${set_code}-${paddedNumber}`;
    }
    
    // Handle variants - if no variants array, assume base and foil
    let variants = [];
    if (c?.variants && Array.isArray(c.variants)) {
      // Use existing variants
      variants = c.variants.map(v => ({ finish: v, rarity: baseRarity }));
    } else {
      // Default to base and foil variants
      variants = [
        { finish: 'base', rarity: baseRarity },
        { finish: 'foil', rarity: baseRarity }
      ];
    }
    
    for (const v of variants) {
      const finish = (v.finish || 'base').toLowerCase();
      const rarity = mapRarity(v.rarity || baseRarity);
      const is_enchanted = rarity === 'enchanted';
      
      // Create printing ID for pricing lookups using the standardized format
      const printing_id = `${pricingCardId}-${finish}`;

      out.push({
        printing_id, 
        card_id: c.id || pricingCardId,  // Keep original ID (may be hash) for card lookup
        name, 
        set_code, 
        set_name, 
        number,
        rarity, 
        finish: is_enchanted ? 'special' : finish, 
        is_enchanted,
        cost: c?.cost,
        type: c?.type,
        lore: c?.lore,
        strength: c?.strength,
        willpower: c?.willpower,
        colors: c?.colors || [],
        franchise: c?.franchise
      });
    }
  }
  return out;
}