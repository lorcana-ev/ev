// src/lib/data.js
import { mapRarity } from './util.js';

export async function loadAll() {
  const [filters, sorts, cards, prices, packModel] = await Promise.all([
    fetch('./data/filters.json').then(r => r.json()),
    fetch('./data/sorts.json').then(r => r.json()),
    fetch('./data/cards.json').then(r => r.json()),
    fetch('./data/USD.json').then(r => r.json()),
    fetch('./config/pack_model.json').then(r => r.json()),
  ]);
  const printings = buildPrintings(cards);
  return { filters, sorts, cards, printings, prices, packModel };
}

/**
 * Build one row per printing/finish. 
 * Creates separate entries for base and foil variants of each card.
 */
export function buildPrintings(cardsBlob) {
  const out = [];
  const cardArray = Array.isArray(cardsBlob) ? cardsBlob : Object.values(cardsBlob);
  
  for (const c of cardArray) {
    const set_code = c?.setId || c?.set?.code || c?.setCode || c?.set || 'UNK';
    const set_name = c?.set?.name || c?.setName || set_code;
    const number = String(c?.number ?? c?.nr ?? '');
    const name = c?.name || 'Unknown';
    const baseRarity = mapRarity(c?.rarity);
    
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
      const card_id = c.id || `${set_code}-${number}`;
      const printing_id = `${card_id}-${finish}${is_enchanted ? '-enchanted' : ''}`;

      out.push({
        printing_id, 
        card_id, 
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