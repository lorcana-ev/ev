// src/lib/prices.js
import { median, mean, trimOutliers } from './util.js';

/** Multi-source pricing manager */
export class MultiSourcePricing {
  constructor(allSources) {
    this.sources = {};
    this.defaultPriority = ['manual_tcgplayer', 'justtcg', 'dreamborn', 'lorcast'];
    this.sourceLabels = {
      manual_tcgplayer: 'TCGPlayer',
      justtcg: 'JustTCG',
      dreamborn: 'Dreamborn',
      lorcast: 'Lorcast'
    };

    // Index each source in priority order
    if (allSources.manual_tcgplayer) {
      this.sources.manual_tcgplayer = this.indexManualTcgPlayerPricing(allSources.manual_tcgplayer);
      console.log('Indexed manual_tcgplayer:', this.sources.manual_tcgplayer.size, 'entries');
    }
    if (allSources.justtcg) {
      this.sources.justtcg = this.indexJustTcgPricing(allSources.justtcg);
      console.log('Indexed justtcg:', this.sources.justtcg.size, 'entries');
    }
    if (allSources.dreamborn) {
      this.sources.dreamborn = this.indexDreambornPricing(allSources.dreamborn);
      console.log('Indexed dreamborn:', this.sources.dreamborn.size, 'entries');
    }
    if (allSources.lorcast) {
      this.sources.lorcast = this.indexLorcastPricing(allSources.lorcast);
      console.log('Indexed lorcast:', this.sources.lorcast.size, 'entries');
    }
  }

  indexManualTcgPlayerPricing(manualData) {
    const idx = new Map();
    if (!manualData?.cards) return idx;

    for (const [cardId, cardPricing] of Object.entries(manualData.cards)) {
      // Handle base variant
      if (cardPricing.base_price !== null && cardPricing.base_price !== undefined && cardPricing.base_price > 0) {
        idx.set(`${cardId}-base`, {
          market: cardPricing.base_price,
          low: cardPricing.base_price,
          median: cardPricing.base_price,
          ts: cardPricing.last_updated
        });
      }

      // Handle foil variant
      if (cardPricing.foil_price !== null && cardPricing.foil_price !== undefined && cardPricing.foil_price > 0) {
        const foilPriceData = {
          market: cardPricing.foil_price,
          low: cardPricing.foil_price,
          median: cardPricing.foil_price,
          ts: cardPricing.last_updated
        };

        idx.set(`${cardId}-foil`, foilPriceData);

        // Check if this might be an enchanted card (high value, high card number)
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyFoil = !cardPricing.base_price;
        const isHighValue = cardPricing.foil_price > 20;
        const isPotentiallyEnchanted = hasOnlyFoil && isHighValue && cardNumber > 204;

        // Also create enchanted variant pricing for potential enchanted cards
        if (isPotentiallyEnchanted) {
          idx.set(`${cardId}-foil-enchanted`, foilPriceData);
          idx.set(`${cardId}-special-enchanted`, foilPriceData);
        }
      }
    }

    return idx;
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
      if (!card?.raw_data?.prices) continue;

      const basePrice = card.raw_data.prices.usd ? parseFloat(card.raw_data.prices.usd) : null;
      const foilPrice = card.raw_data.prices.usd_foil ? parseFloat(card.raw_data.prices.usd_foil) : null;

      // Base variant
      if (basePrice && basePrice < 999) { // Skip placeholder prices
        idx.set(`${cardId}-base`, {
          market: basePrice,
          low: basePrice,
          median: basePrice,
          ts: null
        });
      }

      // Foil variant - use separate usd_foil price if available
      if (foilPrice && foilPrice < 999) {
        const foilPriceData = {
          market: foilPrice,
          low: foilPrice,
          median: foilPrice,
          ts: null
        };

        idx.set(`${cardId}-foil`, foilPriceData);

        // Check if this might be an enchanted card
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyFoil = !basePrice;
        const isHighValue = foilPrice > 20;
        const isPotentiallyEnchanted = hasOnlyFoil && isHighValue && cardNumber > 204;

        if (isPotentiallyEnchanted) {
          idx.set(`${cardId}-foil-enchanted`, foilPriceData);
          idx.set(`${cardId}-special-enchanted`, foilPriceData);
        }
      }
    }

    return idx;
  }
  
  indexJustTcgPricing(justTcgData) {
    const idx = new Map();
    if (!justTcgData?.cards) return idx;

    // Process cards indexed by card ID
    for (const [cardId, cardData] of Object.entries(justTcgData.cards)) {
      if (!cardData?.variants) continue;

      const variants = cardData.variants;

      // Index base variants (Normal printing)
      const baseVariant = variants['Near Mint_Normal'] ||
                         Object.values(variants).find(v =>
                           v.condition === 'Near Mint' &&
                           (!v.printing || v.printing === 'Normal')
                         );

      if (baseVariant && baseVariant.price > 0) {
        idx.set(`${cardId}-base`, {
          market: baseVariant.price,
          low: baseVariant.price,
          median: baseVariant.price,
          ts: baseVariant.lastUpdated
        });
      }

      // Index foil variants (Cold Foil or Holofoil)
      const foilVariant = variants['Near Mint_Cold Foil'] ||
                         variants['Near Mint_Holofoil'] ||
                         Object.values(variants).find(v =>
                           v.condition === 'Near Mint' &&
                           (v.printing === 'Cold Foil' || v.printing === 'Holofoil')
                         );

      if (foilVariant && foilVariant.price > 0) {
        const foilPriceData = {
          market: foilVariant.price,
          low: foilVariant.price,
          median: foilVariant.price,
          ts: foilVariant.lastUpdated
        };

        idx.set(`${cardId}-foil`, foilPriceData);

        // Check if this might be an enchanted card
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyFoil = !baseVariant;
        const isHighValue = foilVariant.price > 20;
        const isPotentiallyEnchanted = hasOnlyFoil && isHighValue && cardNumber > 204;

        if (isPotentiallyEnchanted) {
          idx.set(`${cardId}-foil-enchanted`, foilPriceData);
          idx.set(`${cardId}-special-enchanted`, foilPriceData);
        }
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
    // Handle UNIFIED_PRICING.json format (v3.0.0+)
    // New structure has unified_pricing nested object
    for (const [cardId, cardData] of Object.entries(pricesBlob.cards)) {
      if (!cardData) continue;

      // v3.0.0+ uses nested unified_pricing object
      const pricing = cardData.unified_pricing || cardData;

      // Handle base variant
      if (pricing.base !== null && pricing.base !== undefined && pricing.base > 0) {
        idx.set(`${cardId}-base`, {
          market: num(pricing.base),
          low: num(pricing.base),
          median: num(pricing.base),
          ts: pricesBlob.metadata.created_at || pricesBlob.metadata.last_updated
        });
      }

      // Handle foil variant
      if (pricing.foil !== null && pricing.foil !== undefined && pricing.foil > 0) {
        const foilPriceData = {
          market: num(pricing.foil),
          low: num(pricing.foil),
          median: num(pricing.foil),
          ts: pricesBlob.metadata.created_at || pricesBlob.metadata.last_updated
        };

        idx.set(`${cardId}-foil`, foilPriceData);

        // Check if this might be an enchanted card
        const cardNumber = parseInt(cardId.split('-')[1] || '0');
        const hasOnlyBase = pricing.base === null || pricing.base === undefined;
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
export function buildPriceComparisons(printings, multiSourcePricing, selectedSet = null, cardsById = null) {
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

    // Get full card details if cardsById is provided
    let fullName = p.name;
    let setName = p.set_code;
    if (cardsById) {
      const cardId = p.printing_id.split('-').slice(0, 2).join('-'); // Extract card ID (e.g., "009-001" from "009-001-base")
      const card = cardsById.get(cardId);
      if (card) {
        fullName = card.title ? `${card.name} - ${card.title}` : card.name;
        setName = card.setId || p.set_code;
      }
    }

    comparisons.push({
      printing_id: p.printing_id,
      card_id: p.printing_id.split('-').slice(0, 2).join('-'),
      card_name: p.name,
      full_name: fullName,
      rarity: p.rarity,
      finish: p.finish,
      set_code: p.set_code,
      set_name: setName,
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