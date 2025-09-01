// src/lib/prices.js
import { median, mean, trimOutliers } from './util.js';

/** Normalize price data into a quick lookup. */
export function indexPrices(pricesBlob) {
  const idx = new Map(); // printing_id -> {market, low, median, ts}
  
  if (Array.isArray(pricesBlob)) {
    // Handle array format
    for (const row of pricesBlob) {
      const pid = row.printing_id || row.id || resolvePid(row);
      if (!pid) continue;
      idx.set(pid, {
        market: num(row.market),
        low: num(row.low),
        median: num(row.median),
        ts: row.ts || row.updated || null
      });
    }
  } else {
    // Handle object format (card_id -> variants)
    for (const [cardId, cardData] of Object.entries(pricesBlob)) {
      if (!cardData || typeof cardData !== 'object') continue;
      
      // Handle base variant
      if (cardData.base?.TP?.price !== undefined) {
        idx.set(`${cardId}-base`, {
          market: num(cardData.base.TP.price),
          low: num(cardData.base.TP.price), // Using price as fallback
          median: num(cardData.base.TP.price),
          ts: null
        });
      }
      
      // Handle foil variant
      if (cardData.foil?.TP?.price !== undefined) {
        const foilPriceData = {
          market: num(cardData.foil.TP.price),
          low: num(cardData.foil.TP.price),
          median: num(cardData.foil.TP.price),
          ts: null
        };
        
        idx.set(`${cardId}-foil`, foilPriceData);
        
        // Check if this might be an enchanted card (only has foil pricing, high price, and card number > 204 for Set 1)
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyFoil = !cardData.base;
        const isHighValue = foilPriceData.market > 20; // Enchanted cards are typically expensive
        const isPotentiallyEnchanted = hasOnlyFoil && isHighValue && cardNumber > 204;
        
        // Also create enchanted variant pricing for potential enchanted cards
        if (isPotentiallyEnchanted) {
          idx.set(`${cardId}-foil-enchanted`, foilPriceData);
          idx.set(`${cardId}-special-enchanted`, foilPriceData);
        }
      }
    }
  }
  
  return idx;
}

const num = (x) => (x == null ? null : Number(x));

/** Build rarity/finish price summaries for EV calculation. */
export function buildRaritySummaries(printings, priceIndex, priceType = 'market', selectedSet = null) {
  const buckets = new Map(); // key: `${rarity}|${finish}` -> number[]
  
  for (const p of printings) {
    // Filter by selected set if specified
    if (selectedSet && p.set_code !== selectedSet) {
      continue;
    }
    
    const pr = priceIndex.get(p.printing_id);
    const val = pr?.[priceType];
    if (val == null || val <= 0) continue;
    
    const key = `${p.rarity}|${p.finish}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(val);
  }

  const summaries = {};
  for (const [key, arr] of buckets.entries()) {
    const [rarity, finish] = key.split('|');
    summaries[key] = {
      rarity, 
      finish,
      count: arr.length,
      mean: mean(trimOutliers(arr, 0.10)),   // trimmed mean (10%)
      median: median(arr),
      min: Math.min(...arr),
      max: Math.max(...arr)
    };
  }
  
  return summaries;
}

function resolvePid(row) {
  // Fallback if price rows keyed by set/number/finish
  if (row.set_code && row.number && row.finish) {
    return `${row.set_code}-${row.number}-${row.finish}`;
  }
  return null;
}