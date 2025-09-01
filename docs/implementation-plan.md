https://dreamborn.ink/cache/filters.json
https://dreamborn.ink/cache/en/sorts.json
https://dreamborn.ink/cache/en/cards.json
https://dreamborn.ink/cache/prices/USD.json

Got it — let’s make this a **static website** (vanilla JS + ES modules) you can host on **GitHub Pages**, with your four JSON files bundled locally. No backend, no API.

Below is a ready-to-use project layout plus copy-paste code for the core pages/modules. You can drop this into a repo and publish.

---

# 1) Project structure

```
lorcana-ev/
├─ data/
│  ├─ filters.json
│  ├─ sorts.json
│  ├─ cards.json
│  └─ prices_USD.json          # (rename from prices/USD.json for simplicity)
├─ config/
│  └─ pack_model.json
├─ src/
│  ├─ lib/
│  │  ├─ data.js               # loads & normalizes dreamborn data
│  │  ├─ prices.js             # price index + summaries
│  │  ├─ model.js              # pack model + EV math + Monte Carlo
│  │  └─ util.js               # helpers (stats, formatting)
│  ├─ app.js                   # UI orchestration
│  └─ styles.css
├─ index.html
└─ README.md
```

> Everything is static. `fetch('./data/*.json')` works on GitHub Pages because the JSON lives in the same origin.

---

# 2) Config: `config/pack_model.json`

Use the assumptions we discussed (editable via the UI later).

```json
{
  "cards_per_pack": 12,
  "packs_per_box": 24,
  "boxes_per_case": 4,
  "slots": { "rare_or_higher_slots": 2, "foil_slots": 1, "commons": 6, "uncommons": 3 },

  "rare_slot_odds": { "RARE": 0.73, "SUPER_RARE": 0.19, "LEGENDARY": 0.08 },

  "foil_odds": {
    "COMMON": 0.70,
    "UNCOMMON": 0.20,
    "RARE": 0.07,
    "SUPER_RARE": 0.02,
    "LEGENDARY": 0.001,
    "TOP_CHASE": 0.009
  },

  "scenarios": {
    "conservative": {
      "rare_slot_odds": { "RARE": 0.76, "SUPER_RARE": 0.17, "LEGENDARY": 0.07 },
      "foil_TOP_CHASE_per_pack": 0.010
    },
    "base": {
      "rare_slot_odds": { "RARE": 0.73, "SUPER_RARE": 0.19, "LEGENDARY": 0.08 },
      "foil_TOP_CHASE_per_pack": 0.0125
    },
    "optimistic": {
      "rare_slot_odds": { "RARE": 0.70, "SUPER_RARE": 0.20, "LEGENDARY": 0.10 },
      "foil_TOP_CHASE_per_pack": 0.014
    }
  },

  "bulk_floor": { "COMMON": 0.00, "UNCOMMON": 0.00 }
}
```

---

# 3) HTML shell: `index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Lorcana EV – Fabled</title>
  <link rel="stylesheet" href="./src/styles.css" />
</head>
<body>
  <header>
    <h1>Lorcana EV (Fabled)</h1>
    <div class="controls">
      <label>
        Price Type
        <select id="priceType">
          <option value="market">Market</option>
          <option value="median">Median</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        Scenario
        <select id="scenario">
          <option value="base">Base</option>
          <option value="conservative">Conservative</option>
          <option value="optimistic">Optimistic</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <button id="reset">Reset</button>
    </div>
  </header>

  <main>
    <section class="ev-cards">
      <div class="card">
        <h2>Pack EV</h2>
        <div id="evPack" class="big-num">$–</div>
        <div id="packBreakdown" class="mini"></div>
      </div>
      <div class="card">
        <h2>Box EV (24)</h2>
        <div id="evBox" class="big-num">$–</div>
        <div id="boxOdds" class="mini"></div>
      </div>
      <div class="card">
        <h2>Case EV (96)</h2>
        <div id="evCase" class="big-num">$–</div>
        <div id="caseOdds" class="mini"></div>
      </div>
    </section>

    <section class="charts">
      <div class="card">
        <h3>Rarity Price Summary</h3>
        <table id="rarityTable">
          <thead><tr><th>Rarity</th><th>Finish</th><th>Count</th><th>Mean</th><th>Median</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <div class="card">
        <h3>Hit Odds</h3>
        <ul id="hitList">
          <!-- populated with odds for Top Chase, Foil Legendary, etc. -->
        </ul>
      </div>
    </section>

    <section class="fineprint">
      <p>
        Assumptions: 12-card pack (1 foil any rarity, 2 rare-or-higher, 3 uncommons, 6 commons). Box = 24 packs. Case = 4 boxes (96 packs).
        Odds are community-based estimates; adjust via Scenario or Custom.
      </p>
    </section>
  </main>

  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

---

# 4) Minimal styling: `src/styles.css`

```css
:root { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
body { margin: 0; background: #0b0e13; color: #e9eef5; }
header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #1e2430; }
.controls label { margin-right: 12px; font-size: 14px; }
.controls select, .controls button { margin-left: 6px; padding: 6px 8px; background: #151a22; color: #e9eef5; border: 1px solid #2b3140; border-radius: 6px; }
main { padding: 20px; }
.ev-cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(240px,1fr)); gap: 16px; margin-bottom: 20px; }
.card { background: #121722; border: 1px solid #1e2430; border-radius: 10px; padding: 16px; }
.big-num { font-size: 42px; font-weight: 700; margin: 6px 0; }
.mini { color: #a7b1c2; font-size: 13px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px; border-bottom: 1px solid #1e2430; font-size: 14px; }
h1, h2, h3 { margin: 0; }
.fineprint { color: #93a1b5; font-size: 12px; margin-top: 16px; }
```

---

# 5) Data loader & normalization: `src/lib/data.js`

```js
// src/lib/data.js
import { mapRarity } from './util.js';

export async function loadAll() {
  const [filters, sorts, cards, prices, packModel] = await Promise.all([
    fetch('./data/filters.json').then(r => r.json()),
    fetch('./data/sorts.json').then(r => r.json()),
    fetch('./data/cards.json').then(r => r.json()),
    fetch('./data/prices_USD.json').then(r => r.json()),
    fetch('./config/pack_model.json').then(r => r.json()),
  ]);
  const printings = buildPrintings(cards);
  return { filters, sorts, printings, prices, packModel };
}

/**
 * Build one row per printing/finish. Adjust this to the exact structure you see in cards.json.
 * Dreamborn cards usually have set, number, name, rarity, and sometimes variant/finish.
 */
export function buildPrintings(cardsBlob) {
  const out = [];
  for (const c of cardsBlob) {
    // Heuristics — tailor to your cards.json keys
    const set_code = c?.set?.code || c?.setCode || c?.set || 'UNK';
    const set_name = c?.set?.name || c?.setName || set_code;
    const number = String(c?.number ?? c?.nr ?? '');
    const name = c?.name || 'Unknown';
    const baseRarity = mapRarity(c?.rarity);

    // Some feeds list multiple finishes/variants; expand if present:
    const variants = c?.variants?.length ? c.variants : [{ finish: 'NONFOIL', rarity: baseRarity }];

    for (const v of variants) {
      const finish = (v.finish || 'NONFOIL').toUpperCase();
      const rarity = mapRarity(v.rarity || baseRarity);
      const is_top_chase = rarity === 'TOP_CHASE';
      const card_id = `${set_code}-${number}`;
      const printing_id = `${card_id}-${finish}${is_top_chase ? '-TC' : ''}`;

      out.push({
        printing_id, card_id, name, set_code, set_name, number,
        rarity, finish: is_top_chase ? 'SPECIAL' : finish, is_top_chase
      });
    }
  }
  return out;
}
```

---

# 6) Price indexing & summaries: `src/lib/prices.js`

```js
// src/lib/prices.js
import { median, mean } from './util.js';

/** Normalize whatever shape prices_USD.json has into a quick lookup. */
export function indexPrices(pricesBlob) {
  // Expect either { printing_id: {...} } or array; adapt here as needed
  const idx = new Map(); // printing_id -> {market, low, median, ts}
  if (Array.isArray(pricesBlob)) {
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
    for (const [pid, val] of Object.entries(pricesBlob)) {
      idx.set(pid, { market: num(val.market), low: num(val.low), median: num(val.median), ts: val.ts || null });
    }
  }
  return idx;
}

const num = (x) => (x == null ? null : Number(x));

/** Build rarity/finish price summaries for EV calculation. */
export function buildRaritySummaries(printings, priceIndex, priceType = 'market') {
  const buckets = new Map(); // key: `${rarity}|${finish}` -> number[]
  for (const p of printings) {
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
      rarity, finish,
      count: arr.length,
      mean: mean(trimOutliers(arr, 0.10)),   // trimmed mean (10%)
      median: median(arr)
    };
  }
  return summaries;
}

function trimOutliers(arr, frac) {
  if (arr.length < 5 || frac <= 0) return arr.slice().sort((a,b)=>a-b);
  const s = arr.slice().sort((a,b)=>a-b);
  const k = Math.floor(s.length * frac);
  return s.slice(k, s.length - k);
}

function resolvePid(row) {
  // Fallback if price rows keyed by set/number/finish
  if (row.set_code && row.number && row.finish) return `${row.set_code}-${row.number}-${row.finish}`;
  return null;
}
```

---

# 7) EV model & Monte Carlo: `src/lib/model.js`

```js
// src/lib/model.js
import { formatUSD, clamp } from './util.js';

export function applyScenario(baseConfig, scenarioName) {
  const cfg = structuredClone(baseConfig);
  const s = cfg.scenarios?.[scenarioName];
  if (!s) return cfg;
  if (s.rare_slot_odds) cfg.rare_slot_odds = s.rare_slot_odds;

  // Adjust foil TOP_CHASE mass proportionally within foil_odds
  if (typeof s.foil_TOP_CHASE_per_pack === 'number') {
    const target = clamp(s.foil_TOP_CHASE_per_pack, 0, 0.05);
    const current = cfg.foil_odds.TOP_CHASE || 0;
    const delta = target - current;
    const restKeys = ['COMMON','UNCOMMON','RARE','SUPER_RARE','LEGENDARY'];
    const restSum = restKeys.reduce((t,k)=>t+(cfg.foil_odds[k]||0),0);
    for (const k of restKeys) {
      const prop = (cfg.foil_odds[k]||0) / (restSum || 1);
      cfg.foil_odds[k] = Math.max(0, (cfg.foil_odds[k]||0) - delta*prop);
    }
    cfg.foil_odds.TOP_CHASE = target;
  }
  return cfg;
}

export function evPack(summaries, cfg, priceType='market', bulkFloor={COMMON:0,UNCOMMON:0}) {
  // Helper to fetch average (use mean; switch to median if you prefer)
  const avg = (rarity, finish) => summaries[`${rarity}|${finish}`]?.mean ?? 0;

  // Rare-or-higher slots (nonfoil by default)
  const rOdds = cfg.rare_slot_odds;
  const EV_slot =
    (rOdds.RARE || 0)       * avg('RARE','NONFOIL') +
    (rOdds.SUPER_RARE || 0) * avg('SUPER_RARE','NONFOIL') +
    (rOdds.LEGENDARY || 0)  * avg('LEGENDARY','NONFOIL');

  const EV_rareplus = (cfg.slots.rare_or_higher_slots || 2) * EV_slot;

  // Foil slot: can yield TOP_CHASE via SPECIAL finish
  const f = cfg.foil_odds || {};
  const EV_foil =
    (f.COMMON||0)      * (avg('COMMON','FOIL')      || bulkFloor.COMMON || 0) +
    (f.UNCOMMON||0)    * (avg('UNCOMMON','FOIL')    || bulkFloor.UNCOMMON || 0) +
    (f.RARE||0)        *  avg('RARE','FOIL') +
    (f.SUPER_RARE||0)  *  avg('SUPER_RARE','FOIL') +
    (f.LEGENDARY||0)   *  avg('LEGENDARY','FOIL') +
    (f.TOP_CHASE||0)   * (summaries['TOP_CHASE|SPECIAL']?.mean ?? summaries['TOP_CHASE|FOIL']?.mean ?? 0);

  // Optional: bulk floors for 6 commons, 3 uncommons (nonfoil)
  const bulk = (cfg.slots.commons || 6)   * (bulkFloor.COMMON || 0)
             + (cfg.slots.uncommons || 3)* (bulkFloor.UNCOMMON || 0);

  return EV_rareplus + EV_foil + bulk;
}

export function evBox(packEV, cfg)  { return packEV * (cfg.packs_per_box || 24); }
export function evCase(packEV, cfg) { return packEV * ((cfg.boxes_per_case || 4) * (cfg.packs_per_box || 24)); }

/** 1 - (1 - p)^n */
export function atLeastOne(pPerPack, nPacks) {
  pPerPack = clamp(pPerPack, 0, 1);
  return 1 - Math.pow(1 - pPerPack, nPacks);
}

/** Simple Monte Carlo of n boxes; returns percentiles. */
export function simulateEV(summaries, cfg, nBoxes=1000) {
  const rand = Math.random;
  const packsPerBox = cfg.packs_per_box || 24;
  const results = [];
  // Precompute average prices for quick sampling
  const avg = (r,f) => summaries[`${r}|${f}`]?.mean ?? 0;

  const rareBuckets = [
    { r:'RARE',        p: cfg.rare_slot_odds.RARE,        v: avg('RARE','NONFOIL') },
    { r:'SUPER_RARE',  p: cfg.rare_slot_odds.SUPER_RARE,  v: avg('SUPER_RARE','NONFOIL') },
    { r:'LEGENDARY',   p: cfg.rare_slot_odds.LEGENDARY,   v: avg('LEGENDARY','NONFOIL') },
  ];
  const foilBuckets = [
    { r:'COMMON',      p: cfg.foil_odds.COMMON,     v: avg('COMMON','FOIL') },
    { r:'UNCOMMON',    p: cfg.foil_odds.UNCOMMON,   v: avg('UNCOMMON','FOIL') },
    { r:'RARE',        p: cfg.foil_odds.RARE,       v: avg('RARE','FOIL') },
    { r:'SUPER_RARE',  p: cfg.foil_odds.SUPER_RARE, v: avg('SUPER_RARE','FOIL') },
    { r:'LEGENDARY',   p: cfg.foil_odds.LEGENDARY,  v: avg('LEGENDARY','FOIL') },
    { r:'TOP_CHASE',   p: cfg.foil_odds.TOP_CHASE,  v: summaries['TOP_CHASE|SPECIAL']?.mean ?? 0 },
  ];
  const cum = (arr)=>{ let t=0; return arr.map(x=>({ ...x, c:(t+=x.p) })); };
  const rC = cum(rareBuckets);
  const fC = cum(foilBuckets);

  for (let i=0;i<nBoxes;i++) {
    let boxVal = 0;
    for (let p=0;p<packsPerBox;p++) {
      // 2 rare+ slots
      for (let s=0;s<(cfg.slots.rare_or_higher_slots||2);s++) {
        const r = Math.random();
        const pick = rC.find(x => r <= x.c) || rC[rC.length-1];
        boxVal += pick.v;
      }
      // 1 foil slot
      const rf = Math.random();
      const pickF = fC.find(x => rf <= x.c) || fC[fC.length-1];
      boxVal += pickF.v;
    }
    results.push(boxVal);
  }
  results.sort((a,b)=>a-b);
  const pct = (q)=> results[Math.floor(q*(results.length-1))];
  return { mean: results.reduce((a,b)=>a+b,0)/results.length, p5: pct(0.05), p50: pct(0.50), p95: pct(0.95) };
}

export function summarizeHitOdds(cfg) {
  const pTop = cfg.foil_odds?.TOP_CHASE || 0;
  const packsBox = cfg.packs_per_box || 24;
  const packsCase = packsBox * (cfg.boxes_per_case || 4);
  return {
    topChase: {
      perPack: pTop,
      perBox: atLeastOne(pTop, packsBox),
      perCase: atLeastOne(pTop, packsCase),
    }
  };
}

export const fmt = formatUSD;
```

---

# 8) Utilities: `src/lib/util.js`

```js
// src/lib/util.js
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const formatUSD = (n) => isFinite(n) ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) : '—';

export function mapRarity(raw) {
  const r = String(raw || '').trim().toUpperCase().replace(' ', '_');
  if (['COMMON','UNCOMMON','RARE','SUPER_RARE','LEGENDARY'].includes(r)) return r;
  if (['ENCHANTED','ICONIC','EPIC','TOP_CHASE'].includes(r)) return 'TOP_CHASE';
  return 'COMMON';
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
}
export function mean(arr) { return arr.reduce((a,b)=>a+b,0) / (arr.length || 1); }
```

---

# 9) App orchestration: `src/app.js`

```js
// src/app.js
import { loadAll } from './lib/data.js';
import { indexPrices, buildRaritySummaries } from './lib/prices.js';
import { applyScenario, evPack, evBox, evCase, summarizeHitOdds, simulateEV, fmt } from './lib/model.js';

const els = {
  priceType: document.getElementById('priceType'),
  scenario: document.getElementById('scenario'),
  reset: document.getElementById('reset'),
  evPack: document.getElementById('evPack'),
  evBox: document.getElementById('evBox'),
  evCase: document.getElementById('evCase'),
  packBreakdown: document.getElementById('packBreakdown'),
  boxOdds: document.getElementById('boxOdds'),
  caseOdds: document.getElementById('caseOdds'),
  rarityTableBody: document.querySelector('#rarityTable tbody'),
  hitList: document.getElementById('hitList'),
};

let state = {
  printings: [],
  priceIndex: null,
  summaries: null,
  baseConfig: null,
  workingConfig: null
};

init();

async function init() {
  const { printings, prices, packModel } = await loadAll();
  state.printings = printings;
  state.baseConfig = packModel;

  state.priceIndex = indexPrices(prices);
  recomputeSummaries();

  wireUI();
  renderAll();
}

function wireUI() {
  els.priceType.addEventListener('change', ()=> { recomputeSummaries(); renderAll(); });
  els.scenario.addEventListener('change', ()=> { applyScenarioAndRender(); });
  els.reset.addEventListener('click', ()=> { els.scenario.value='base'; applyScenarioAndRender(); });
}

function recomputeSummaries() {
  state.summaries = buildRaritySummaries(state.printings, state.priceIndex, els.priceType.value);
}

function applyScenarioAndRender() {
  const s = els.scenario.value;
  state.workingConfig = applyScenario(state.baseConfig, s);
  renderAll();
}

function renderAll() {
  if (!state.workingConfig) state.workingConfig = applyScenario(state.baseConfig, 'base');
  const cfg = state.workingConfig;

  // EVs
  const pack = evPack(state.summaries, cfg, els.priceType.value, cfg.bulk_floor || {COMMON:0,UNCOMMON:0});
  const box  = evBox(pack, cfg);
  const _case= evCase(pack, cfg);

  els.evPack.textContent = fmt(pack);
  els.evBox.textContent  = fmt(box);
  els.evCase.textContent = fmt(_case);

  // Breakdown text
  els.packBreakdown.textContent = `${cfg.slots.rare_or_higher_slots}× rare+ slots, 1× foil slot`;
  els.boxOdds.textContent = `24 packs – scenario: ${els.scenario.value}`;
  els.caseOdds.textContent = `96 packs (4 boxes) – scenario: ${els.scenario.value}`;

  // Hit odds
  const odds = summarizeHitOdds(cfg);
  els.hitList.innerHTML = `
    <li>Top Chase per pack: ${(100*odds.topChase.perPack).toFixed(2)}%</li>
    <li>≥1 Top Chase per box: ${(100*odds.topChase.perBox).toFixed(1)}%</li>
    <li>≥1 Top Chase per case: ${(100*odds.topChase.perCase).toFixed(1)}%</li>
  `;

  // Rarity table
  const rows = [];
  for (const [key, s] of Object.entries(state.summaries)) {
    rows.push(`<tr><td>${s.rarity}</td><td>${s.finish}</td><td>${s.count}</td><td>${fmt(s.mean)}</td><td>${fmt(s.median)}</td></tr>`);
  }
  els.rarityTableBody.innerHTML = rows.join('');

  // (Optional) Monte Carlo on-demand: uncomment if you want to show distribution
  // const sim = simulateEV(state.summaries, cfg, 1000);
  // console.log('Simulated box EV:', sim);
}
```

---

# 10) How to deploy on GitHub Pages

1. Create a new repo (e.g., `lorcana-ev`) and push this folder.
2. Commit your four JSON files into `data/` exactly as shown.
3. In GitHub → **Settings → Pages**:

   * Source: **Deploy from a branch**
   * Branch: `main` (or `master`) / root folder
4. Your site will be available at `https://<username>.github.io/lorcana-ev/`.

> If you serve from a subpath and later add a router, keep using **relative paths** (`./data/cards.json`) as in the code to avoid base-URL headaches.

---

# 11) Quick customization ideas

* **Toggle mean vs. median** for EV (dropdown).
* **User-editable odds**: when “Custom” is selected, show sliders to edit `rare_slot_odds` and `foil_odds.TOP_CHASE`, then re-render.
* **Bulk floors**: let users set a per-common/per-uncommon value (default 0).
* **Card browser**: add a table filtered by rarity & finish with prices; helpful to audit which cards dominate EV.

---

If you want, I can also include a simple “Custom Odds” panel (sliders + live update) or a downloadable **CSV export** of the rarity price summaries—just say the word and I’ll drop those snippets in.

