// src/lib/prices.js
import { median, mean, trimOutliers } from './util.js';

/** Multi-source pricing manager */
export class MultiSourcePricing {
  constructor(allSources) {
    this.sources = {};
    this.defaultPriority = ['justtcg', 'dreamborn', 'lorcast'];
    this.sourceLabels = {
      dreamborn: 'Dreamborn',
      lorcast: 'Lorcast', 
      justtcg: 'JustTCG'
    };
    
    // Index each source
    if (allSources.dreamborn) {
      this.sources.dreamborn = this.indexDreambornPricing(allSources.dreamborn);
    }
    if (allSources.lorcast) {
      this.sources.lorcast = this.indexLorcastPricing(allSources.lorcast);
    }
    if (allSources.justtcg) {
      this.sources.justtcg = this.indexJustTcgPricing(allSources.justtcg);
    }
    if (allSources.unified) {
      this.sources.unified = indexPrices(allSources.unified);
    }
  }
  
  indexDreambornPricing(dreambornData) {
    const idx = new Map();
    if (!dreambornData || typeof dreambornData !== 'object') return idx;
    
    for (const [cardId, cardData] of Object.entries(dreambornData)) {
      if (!cardData || typeof cardData !== 'object') continue;
      
      // Handle base variant from Dreamborn USD.json format
      if (cardData.base?.TP?.price !== undefined) {
        const price = parseFloat(cardData.base.TP.price);
        if (price > 0) {
          idx.set(`${cardId}-base`, {
            market: price,
            low: price,
            median: price,
            ts: null
          });
        }
      }
      
      // Handle foil variant from Dreamborn USD.json format
      if (cardData.foil?.TP?.price !== undefined) {
        const price = parseFloat(cardData.foil.TP.price);
        if (price > 0) {
          const foilPriceData = {
            market: price,
            low: price,
            median: price,
            ts: null
          };
          
          idx.set(`${cardId}-foil`, foilPriceData);
          
          // Check if this might be an enchanted card (high value, high card number)
          const cardNumber = parseInt(cardId.split('-')[1] || '0');
          const hasOnlyFoil = !cardData.base;
          const isHighValue = price > 20;
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
  
  indexLorcastPricing(lorcastData) {
    const idx = new Map();
    if (!lorcastData?.cards) return idx;
    
    for (const [cardId, card] of Object.entries(lorcastData.cards)) {
      if (!card?.raw_data?.prices?.usd) continue;
      
      const price = parseFloat(card.raw_data.prices.usd);
      if (price >= 999) continue; // Skip placeholder prices
      
      const priceData = {
        market: price,
        low: price,
        median: price,
        ts: null
      };
      
      // Base variant (assume all Lorcast prices are base)
      idx.set(`${cardId}-base`, priceData);
      
      // If foil is available, use same pricing (Lorcast doesn't separate foil pricing)
      if (card.foil_available) {
        idx.set(`${cardId}-foil`, priceData);
      }
    }
    
    return idx;
  }
  
  indexJustTcgPricing(justTcgData) {
    const idx = new Map();
    if (!justTcgData?.cards) return idx;
    
    for (const [cardId, card] of Object.entries(justTcgData.cards)) {
      if (!card?.variants) continue;
      
      // Index base variants
      const baseVariants = Object.values(card.variants).filter(v => 
        v.condition === 'Near Mint' && 
        (!v.printing || v.printing === 'Regular' || v.printing === 'Normal')
      );
      
      if (baseVariants.length > 0) {
        const price = parseFloat(baseVariants[0].price);
        idx.set(`${cardId}-base`, {
          market: price,
          low: price,
          median: price,
          ts: baseVariants[0].lastUpdated
        });
      }
      
      // Index foil variants
      const foilVariants = Object.values(card.variants).filter(v => 
        v.condition === 'Near Mint' && 
        (v.printing === 'Holofoil' || v.printing === 'Cold Foil')
      );
      
      if (foilVariants.length > 0) {
        const price = parseFloat(foilVariants[0].price);
        idx.set(`${cardId}-foil`, {
          market: price,
          low: price,
          median: price,
          ts: foilVariants[0].lastUpdated
        });
      }
    }
    
    return idx;
  }
  
  getPrice(printingId, sourcePriority = null) {
    const priority = sourcePriority || this.defaultPriority;
    
    for (const source of priority) {
      if (this.sources[source]?.has(printingId)) {
        const priceData = this.sources[source].get(printingId);
        return {
          ...priceData,
          source: source
        };
      }
    }
    
    return null;
  }
  
  getAllPrices(printingId) {
    const allPrices = {};
    
    for (const [source, index] of Object.entries(this.sources)) {
      if (index.has(printingId)) {
        allPrices[source] = index.get(printingId);
      }
    }
    
    return allPrices;
  }
  
  setPriority(newPriority) {
    this.defaultPriority = newPriority;
  }
}

/** Normalize price data into a quick lookup. */
export function indexPrices(pricesBlob) {
  const idx = new Map(); // printing_id -> {market, low, median, ts}
  
  // Check if this is unified pricing format
  if (pricesBlob?.metadata?.version && pricesBlob?.cards) {
    // Handle simplified UNIFIED_PRICING.json format (v3.0.0+)
    for (const [cardId, cardData] of Object.entries(pricesBlob.cards)) {
      if (!cardData) continue;
      
      // Handle base variant
      if (cardData.base !== null && cardData.base > 0) {
        idx.set(`${cardId}-base`, {
          market: num(cardData.base),
          low: num(cardData.base),
          median: num(cardData.base),
          ts: pricesBlob.metadata.created_at
        });
      }
      
      // Handle foil variant
      if (cardData.foil !== null && cardData.foil > 0) {
        const foilPriceData = {
          market: num(cardData.foil),
          low: num(cardData.foil),
          median: num(cardData.foil),
          ts: pricesBlob.metadata.created_at
        };
        
        idx.set(`${cardId}-foil`, foilPriceData);
        
        // Check if this might be an enchanted card
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyBase = cardData.base === null;
        const isHighValue = foilPriceData.market > 20;
        const isPotentiallyEnchanted = hasOnlyBase && isHighValue && cardNumber > 204;
        
        // Also create enchanted variant pricing for potential enchanted cards
        if (isPotentiallyEnchanted) {
          idx.set(`${cardId}-foil-enchanted`, foilPriceData);
          idx.set(`${cardId}-special-enchanted`, foilPriceData);
        }
      }
    }
  } else if (Array.isArray(pricesBlob)) {
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
    // Handle legacy object format (card_id -> variants)
    for (const [cardId, cardData] of Object.entries(pricesBlob)) {
      if (!cardData || typeof cardData !== 'object') continue;
      
      // Handle base variant
      if (cardData.base?.TP?.price !== undefined) {
        idx.set(`${cardId}-base`, {
          market: num(cardData.base.TP.price),
          low: num(cardData.base.TP.price),
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
        
        // Check if this might be an enchanted card
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyFoil = !cardData.base;
        const isHighValue = foilPriceData.market > 20;
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

/** Build rarity/finish price summaries for EV calculation with multi-source support. */
export function buildRaritySummaries(printings, priceIndex, priceType = 'market', selectedSet = null, sourcePriority = null) {
  const buckets = new Map(); // key: `${rarity}|${finish}` -> {prices: number[], sources: string[]}
  
  for (const p of printings) {
    // Filter by selected set if specified
    if (selectedSet && p.set_code !== selectedSet) {
      continue;
    }
    
    let priceData = null;
    let val = null;
    
    // Handle both legacy single-source and new multi-source pricing
    if (priceIndex instanceof MultiSourcePricing) {
      priceData = priceIndex.getPrice(p.printing_id, sourcePriority);
      val = priceData?.[priceType];
    } else {
      // Legacy single-source
      priceData = priceIndex.get(p.printing_id);
      val = priceData?.[priceType];
    }
    
    if (val == null || val <= 0) continue;
    
    const key = `${p.rarity}|${p.finish}`;
    if (!buckets.has(key)) {
      buckets.set(key, { prices: [], sources: [] });
    }
    
    buckets.get(key).prices.push(val);
    if (priceData?.source) {
      buckets.get(key).sources.push(priceData.source);
    }
  }

  const summaries = {};
  for (const [key, bucket] of buckets.entries()) {
    const [rarity, finish] = key.split('|');
    const arr = bucket.prices;
    
    // Count sources used
    const sourceCounts = {};
    bucket.sources.forEach(source => {
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    summaries[key] = {
      rarity, 
      finish,
      count: arr.length,
      mean: mean(trimOutliers(arr, 0.10)),   // trimmed mean (10%)
      median: median(arr),
      min: Math.min(...arr),
      max: Math.max(...arr),
      sources: sourceCounts  // Track which sources were used
    };
  }
  
  return summaries;
}

/** Build detailed price comparisons across all sources */
export function buildPriceComparisons(printings, multiSourcePricing, selectedSet = null) {
  const comparisons = [];
  
  for (const p of printings) {
    if (selectedSet && p.set_code !== selectedSet) continue;
    
    const allPrices = multiSourcePricing.getAllPrices(p.printing_id);
    if (Object.keys(allPrices).length < 2) continue; // Need at least 2 sources
    
    const prices = {};
    Object.entries(allPrices).forEach(([source, priceData]) => {
      prices[source] = priceData.market;
    });
    
    const priceValues = Object.values(prices);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    const variance = maxPrice - minPrice;
    const percentDiff = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
    
    comparisons.push({
      printing_id: p.printing_id,
      card_name: p.name,
      rarity: p.rarity,
      finish: p.finish,
      set_code: p.set_code,
      prices,
      variance,
      percentDiff,
      sourceCount: Object.keys(prices).length
    });
  }
  
  return comparisons.sort((a, b) => b.variance - a.variance);
}

function resolvePid(row) {
  // Fallback if price rows keyed by set/number/finish
  if (row.set_code && row.number && row.finish) {
    return `${row.set_code}-${row.number}-${row.finish}`;
  }
  return null;
}