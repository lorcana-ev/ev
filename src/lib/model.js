// src/lib/model.js
import { formatUSD, clamp } from './util.js';

export function applyScenario(baseConfig, scenarioName) {
  const cfg = structuredClone(baseConfig);
  const s = cfg.scenarios?.[scenarioName];
  if (!s) return cfg;
  
  if (s.rare_slot_odds) {
    cfg.rare_slot_odds = s.rare_slot_odds;
  }

  // Adjust foil enchanted mass proportionally within foil_odds
  if (typeof s.foil_enchanted_per_pack === 'number') {
    const target = clamp(s.foil_enchanted_per_pack, 0, 0.05);
    const current = cfg.foil_odds.enchanted || 0;
    const delta = target - current;
    
    // Redistribute the difference among other foil rarities
    const restKeys = ['common', 'uncommon', 'rare', 'super rare', 'legendary'];
    const restSum = restKeys.reduce((t, k) => t + (cfg.foil_odds[k] || 0), 0);
    
    for (const k of restKeys) {
      const prop = (cfg.foil_odds[k] || 0) / (restSum || 1);
      cfg.foil_odds[k] = Math.max(0, (cfg.foil_odds[k] || 0) - delta * prop);
    }
    cfg.foil_odds.enchanted = target;
  }
  
  return cfg;
}

export function evPack(summaries, cfg, priceType = 'market', bulkFloor = { common: 0, uncommon: 0 }) {
  // Helper to fetch average (use mean; switch to median if you prefer)
  const avg = (rarity, finish) => summaries[`${rarity}|${finish}`]?.mean ?? 0;

  // Rare-or-higher slots (base by default)
  const rOdds = cfg.rare_slot_odds;
  const EV_slot =
    (rOdds.rare || 0) * avg('rare', 'base') +
    (rOdds['super rare'] || 0) * avg('super rare', 'base') +
    (rOdds.legendary || 0) * avg('legendary', 'base');

  const EV_rareplus = (cfg.slots.rare_or_higher_slots || 2) * EV_slot;

  // Foil slot: can yield enchanted via special finish
  const f = cfg.foil_odds || {};
  const EV_foil =
    (f.common || 0) * (avg('common', 'foil') || bulkFloor.common || 0) +
    (f.uncommon || 0) * (avg('uncommon', 'foil') || bulkFloor.uncommon || 0) +
    (f.rare || 0) * avg('rare', 'foil') +
    (f['super rare'] || 0) * avg('super rare', 'foil') +
    (f.legendary || 0) * avg('legendary', 'foil') +
    (f.enchanted || 0) * (summaries['enchanted|special']?.mean ?? summaries['enchanted|foil']?.mean ?? 0);

  // Optional: bulk floors for 6 commons, 3 uncommons (base)
  const bulk = (cfg.slots.commons || 6) * (bulkFloor.common || 0) +
               (cfg.slots.uncommons || 3) * (bulkFloor.uncommon || 0);

  return EV_rareplus + EV_foil + bulk;
}

export function evBox(packEV, cfg) { 
  return packEV * (cfg.packs_per_box || 24); 
}

export function evCase(packEV, cfg) { 
  return packEV * ((cfg.boxes_per_case || 4) * (cfg.packs_per_box || 24)); 
}

/** 1 - (1 - p)^n */
export function atLeastOne(pPerPack, nPacks) {
  pPerPack = clamp(pPerPack, 0, 1);
  return 1 - Math.pow(1 - pPerPack, nPacks);
}

/** Simple Monte Carlo of n boxes; returns percentiles. */
export function simulateEV(summaries, cfg, nBoxes = 1000) {
  const packsPerBox = cfg.packs_per_box || 24;
  const results = [];
  
  // Precompute average prices for quick sampling
  const avg = (r, f) => summaries[`${r}|${f}`]?.mean ?? 0;

  const rareBuckets = [
    { r: 'rare', p: cfg.rare_slot_odds.rare, v: avg('rare', 'base') },
    { r: 'super rare', p: cfg.rare_slot_odds['super rare'], v: avg('super rare', 'base') },
    { r: 'legendary', p: cfg.rare_slot_odds.legendary, v: avg('legendary', 'base') },
  ];
  
  const foilBuckets = [
    { r: 'common', p: cfg.foil_odds.common, v: avg('common', 'foil') },
    { r: 'uncommon', p: cfg.foil_odds.uncommon, v: avg('uncommon', 'foil') },
    { r: 'rare', p: cfg.foil_odds.rare, v: avg('rare', 'foil') },
    { r: 'super rare', p: cfg.foil_odds['super rare'], v: avg('super rare', 'foil') },
    { r: 'legendary', p: cfg.foil_odds.legendary, v: avg('legendary', 'foil') },
    { r: 'enchanted', p: cfg.foil_odds.enchanted, v: summaries['enchanted|special']?.mean ?? 0 },
  ];
  
  const cum = (arr) => { 
    let t = 0; 
    return arr.map(x => ({ ...x, c: (t += x.p) })); 
  };
  
  const rC = cum(rareBuckets);
  const fC = cum(foilBuckets);

  for (let i = 0; i < nBoxes; i++) {
    let boxVal = 0;
    for (let p = 0; p < packsPerBox; p++) {
      // 2 rare+ slots
      for (let s = 0; s < (cfg.slots.rare_or_higher_slots || 2); s++) {
        const r = Math.random();
        const pick = rC.find(x => r <= x.c) || rC[rC.length - 1];
        boxVal += pick.v;
      }
      // 1 foil slot
      const rf = Math.random();
      const pickF = fC.find(x => rf <= x.c) || fC[fC.length - 1];
      boxVal += pickF.v;
    }
    results.push(boxVal);
  }
  
  results.sort((a, b) => a - b);
  const pct = (q) => results[Math.floor(q * (results.length - 1))];
  
  return { 
    mean: results.reduce((a, b) => a + b, 0) / results.length, 
    p5: pct(0.05), 
    p50: pct(0.50), 
    p95: pct(0.95) 
  };
}

export function summarizeHitOdds(cfg) {
  const pEnchanted = cfg.foil_odds?.enchanted || 0;
  const packsBox = cfg.packs_per_box || 24;
  const packsCase = packsBox * (cfg.boxes_per_case || 4);
  
  return {
    enchanted: {
      perPack: pEnchanted,
      perBox: atLeastOne(pEnchanted, packsBox),
      perCase: atLeastOne(pEnchanted, packsCase),
    }
  };
}

export const fmt = formatUSD;