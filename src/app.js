// src/app.js
import { loadAll } from './lib/data.js';
import { indexPrices, buildRaritySummaries, MultiSourcePricing, buildPriceComparisons } from './lib/prices.js';
import { applyScenario, evPack, evBox, evCase, summarizeHitOdds, simulateEV, fmt } from './lib/model.js';
import { getAllSets, getSetName } from './lib/sets.js';
import { setViewer } from './lib/setviewer.js';

const els = {
  setSelection: document.getElementById('setSelection'),
  scenario: document.getElementById('scenario'),
  pricingSource1: document.getElementById('pricingSource1'),
  pricingSource2: document.getElementById('pricingSource2'),
  pricingSource3: document.getElementById('pricingSource3'),
  reset: document.getElementById('reset'),
  evPack: document.getElementById('evPack'),
  evBox: document.getElementById('evBox'),
  evCase: document.getElementById('evCase'),
  packBreakdown: document.getElementById('packBreakdown'),
  boxOdds: document.getElementById('boxOdds'),
  caseOdds: document.getElementById('caseOdds'),
  rarityTableBody: document.querySelector('#rarityTable tbody'),
  hitList: document.getElementById('hitList'),
  currentScenario: document.getElementById('currentScenario'),
  currentScenarioOdds: document.getElementById('currentScenarioOdds'),
  loadingStatus: document.getElementById('loadingStatus'),
  mainContent: document.getElementById('mainContent'),
  boxMarketPrice: document.getElementById('boxMarketPrice'),
  caseMarketPrice: document.getElementById('caseMarketPrice'),
  comparisonsTableBody: document.querySelector('#comparisonsTable tbody'),
  showOnlyHighVariance: document.getElementById('showOnlyHighVariance'),
  minVariance: document.getElementById('minVariance'),
};

let state = {
  printings: [],
  priceIndex: null,
  multiSourcePricing: null,
  summaries: null,
  baseConfig: null,
  workingConfig: null,
  availableSets: [],
  selectedSet: '001', // Default to first set
  allBoxPricing: null,
  pricingPriority: ['justtcg', 'dreamborn', 'lorcast'], // Default priority order
  priceComparisons: null
};

init();

async function init() {
  try {
    showLoading('Loading card and price data...');
    
    const { printings, prices, packModel, cards, allPricingSources } = await loadAll();
    state.printings = printings;
    state.baseConfig = packModel;

    showLoading('Processing price data...');
    state.priceIndex = indexPrices(prices);
    state.multiSourcePricing = new MultiSourcePricing(allPricingSources);
    
    showLoading('Loading box pricing data...');
    await loadAllBoxPricing();
    
    showLoading('Analyzing available sets...');
    state.availableSets = getAllSets(cards);
    setupSetSelection();
    
    showLoading('Computing price summaries...');
    recomputeSummaries();

    showLoading('Setting up interface...');
    wireUI();
    updatePricingSourceSelectors();
    
    showLoading('Initializing set viewer...');
    setViewer.initialize(cards, state.priceIndex);
    setViewer.setCurrentSet(state.selectedSet);
    
    // Initialize current scenario display
    const initialScenario = els.scenario?.value || 'base';
    if (els.currentScenario) {
      els.currentScenario.textContent = initialScenario;
    }
    
    // Initialize scenario odds display
    updateScenarioOdds(initialScenario);
    
    renderAll();
    
    hideLoading();
    
    console.log(`Loaded ${printings.length} printings across ${state.availableSets.length} sets`);
    console.log(`Price coverage: ${state.priceIndex.size} entries`);
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showError('Failed to load data. Please check console for details.');
  }
}

function showLoading(message) {
  if (els.loadingStatus) els.loadingStatus.textContent = message;
  if (els.mainContent) els.mainContent.style.display = 'none';
}

function hideLoading() {
  if (els.loadingStatus) els.loadingStatus.style.display = 'none';
  if (els.mainContent) els.mainContent.style.display = 'block';
}

function showError(message) {
  if (els.loadingStatus) {
    els.loadingStatus.innerHTML = `<div style="color: #ff6b6b;">❌ ${message}</div>`;
  }
}

function setupSetSelection() {
  if (!els.setSelection) return;
  
  // Clear existing options
  els.setSelection.innerHTML = '';
  
  // Add options for each available set
  for (const set of state.availableSets) {
    const option = document.createElement('option');
    option.value = set.code;
    
    // Format: "Set Name (count cards, Set #)"
    const setNumber = parseInt(set.code) || set.code;
    option.textContent = `${set.name} (${set.count} cards, Set ${setNumber})`;
    
    els.setSelection.appendChild(option);
  }
  
  // Set default selection
  els.setSelection.value = state.selectedSet;
}

function wireUI() {
  if (els.setSelection) {
    els.setSelection.addEventListener('change', () => {
      state.selectedSet = els.setSelection.value;
      recomputeSummaries(); 
      renderAll();
      updateBoxPricing();
      setViewer.setCurrentSet(state.selectedSet);
    });
  }
  
  if (els.scenario) {
    els.scenario.addEventListener('change', () => { 
      applyScenarioAndRender(); 
    });
  }
  
  // Wire pricing source priority selectors
  [els.pricingSource1, els.pricingSource2, els.pricingSource3].forEach((el, index) => {
    if (el) {
      el.addEventListener('change', () => {
        updatePricingPriority();
      });
    }
  });
  
  // Wire comparison filter controls
  if (els.showOnlyHighVariance) {
    els.showOnlyHighVariance.addEventListener('change', renderComparisonsTable);
  }
  if (els.minVariance) {
    els.minVariance.addEventListener('input', renderComparisonsTable);
  }
  
  // Setup tab switching
  setupTabs();
  
  if (els.reset) {
    els.reset.addEventListener('click', () => { 
      if (els.scenario) els.scenario.value = 'base';
      if (els.setSelection) {
        els.setSelection.value = '001';
        state.selectedSet = '001';
      }
      // Reset pricing priority to default
      state.pricingPriority = ['justtcg', 'dreamborn', 'lorcast'];
      updatePricingSourceSelectors();
      applyScenarioAndRender();
      setViewer.setCurrentSet(state.selectedSet); 
    });
  }
}

function updatePricingPriority() {
  const newPriority = [
    els.pricingSource1?.value,
    els.pricingSource2?.value, 
    els.pricingSource3?.value
  ].filter(Boolean);
  
  // Only update if we have valid selections and they're different
  if (newPriority.length === 3 && 
      JSON.stringify(newPriority) !== JSON.stringify(state.pricingPriority)) {
    state.pricingPriority = newPriority;
    state.multiSourcePricing.setPriority(newPriority);
    
    // Recompute with new priority
    recomputeSummaries();
    renderAll();
  }
}

function updatePricingSourceSelectors() {
  const sources = ['dreamborn', 'lorcast', 'justtcg'];
  const labels = {
    dreamborn: 'Dreamborn',
    lorcast: 'Lorcast',
    justtcg: 'JustTCG'
  };
  
  [els.pricingSource1, els.pricingSource2, els.pricingSource3].forEach((el, index) => {
    if (!el) return;
    
    // Clear existing options
    el.innerHTML = '';
    
    // Add options
    sources.forEach(source => {
      const option = document.createElement('option');
      option.value = source;
      option.textContent = labels[source];
      el.appendChild(option);
    });
    
    // Set current selection
    if (state.pricingPriority[index]) {
      el.value = state.pricingPriority[index];
    }
  });
}

function recomputeSummaries() {
  const priceType = 'market';
  
  // Use multi-source pricing with current priority
  state.summaries = buildRaritySummaries(
    state.printings, 
    state.multiSourcePricing, 
    priceType, 
    state.selectedSet, 
    state.pricingPriority
  );
  
  // Build price comparisons for display
  state.priceComparisons = buildPriceComparisons(
    state.printings, 
    state.multiSourcePricing, 
    state.selectedSet
  );
}

function applyScenarioAndRender() {
  const s = els.scenario?.value || 'base';
  state.workingConfig = applyScenario(state.baseConfig, s);
  
  // Update current scenario display
  if (els.currentScenario) {
    els.currentScenario.textContent = s;
  }
  
  // Update scenario odds display
  updateScenarioOdds(s);
  
  renderAll();
}

function updateScenarioOdds(scenarioName) {
  if (!els.currentScenarioOdds || !state.baseConfig) return;
  
  const cfg = applyScenario(state.baseConfig, scenarioName);
  const rareSlotOdds = cfg.rare_slot_odds || state.baseConfig.rare_slot_odds;
  const foilOdds = cfg.foil_odds || state.baseConfig.foil_odds;
  const enchantedPerPack = cfg.foil_enchanted_per_pack || state.baseConfig.scenarios?.[scenarioName]?.foil_enchanted_per_pack || 0.0125;
  
  const rareSlotHtml = Object.entries(rareSlotOdds)
    .map(([rarity, odds]) => {
      const percent = (odds * 100);
      // Show more precision for Epic and Iconic due to low percentages
      if (rarity === 'epic') {
        return `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${percent.toFixed(2)}%`;
      } else if (rarity === 'iconic') {
        return `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${percent.toFixed(3)}%`;
      }
      return `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${percent.toFixed(0)}%`;
    })
    .join(' | ');
  
  const foilSlotHtml = Object.entries(foilOdds)
    .map(([rarity, odds]) => `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${(odds * 100).toFixed(1)}%`)
    .join(' | ');
  
  els.currentScenarioOdds.innerHTML = `
    <strong>Rare+ Slot Odds:</strong><br>
    ${rareSlotHtml}<br><br>
    
    <strong>Foil Slot Odds:</strong><br>
    ${foilSlotHtml}<br><br>
    
    <strong>Enchanted Rate:</strong> ${(enchantedPerPack * 100).toFixed(2)}% per pack
  `;
}

function renderAll() {
  if (!state.workingConfig) {
    state.workingConfig = applyScenario(state.baseConfig, 'base');
  }
  
  const cfg = state.workingConfig;
  const priceType = 'market';

  // Check if we have any pricing data for this set
  const hasPricingData = Object.keys(state.summaries).length > 0;
  
  if (!hasPricingData) {
    // No pricing data available for selected set
    if (els.evPack) els.evPack.textContent = '—';
    if (els.evBox) els.evBox.textContent = '—';
    if (els.evCase) els.evCase.textContent = '—';
  } else {
    // EVs
    const pack = evPack(state.summaries, cfg, priceType, cfg.bulk_floor || { common: 0, uncommon: 0 });
    const box = evBox(pack, cfg);
    const _case = evCase(pack, cfg);

    if (els.evPack) els.evPack.textContent = fmt(pack);
    if (els.evBox) els.evBox.textContent = fmt(box);
    if (els.evCase) els.evCase.textContent = fmt(_case);
  }

  // Breakdown text
  const scenarioName = els.scenario?.value || 'base';
  const selectedSetInfo = state.availableSets.find(s => s.code === state.selectedSet);
  const setName = selectedSetInfo?.name || `Set ${state.selectedSet}`;
  
  if (els.packBreakdown) {
    if (!hasPricingData) {
      els.packBreakdown.textContent = `No pricing data available`;
    } else {
      els.packBreakdown.textContent = `${cfg.slots.rare_or_higher_slots}× rare+ slots, 1× foil slot`;
    }
  }
  if (els.boxOdds) {
    if (!hasPricingData) {
      els.boxOdds.textContent = `${setName} – No pricing data`;
    } else {
      els.boxOdds.textContent = `${setName} – 24 packs – ${scenarioName}`;
    }
  }
  if (els.caseOdds) {
    if (!hasPricingData) {
      els.caseOdds.textContent = `${setName} – No pricing data`;
    } else {
      els.caseOdds.textContent = `${setName} – 96 packs (4 boxes) – ${scenarioName}`;
    }
  }

  // Hit odds
  if (els.hitList) {
    if (!hasPricingData) {
      els.hitList.innerHTML = `
        <li>No pricing data available for this set</li>
        <li>Hit odds cannot be calculated</li>
      `;
    } else {
      const odds = summarizeHitOdds(cfg);
      const rareSlotOdds = cfg.rare_slot_odds || state.baseConfig.rare_slot_odds;
      
      // Calculate Epic and Iconic hit odds
      const epicPerPack = rareSlotOdds.epic || 0;
      const iconicPerPack = rareSlotOdds.iconic || 0;
      
      // Calculate "at least 1" probabilities for box and case
      const epicPerBox = 1 - Math.pow(1 - epicPerPack, 24);
      const iconicPerBox = 1 - Math.pow(1 - iconicPerPack, 24);
      const iconicPerCase = 1 - Math.pow(1 - iconicPerPack, 96);
      
      els.hitList.innerHTML = `
        <li><strong>Epic</strong>: ${(epicPerPack * 24).toFixed(1)} expected per box (${(100 * epicPerPack).toFixed(2)}% per pack)</li>
        <li><strong>Iconic</strong>: 1 per ${Math.round(1/iconicPerPack)} packs (${(100 * iconicPerPack).toFixed(3)}% per pack)</li>
        <li>≥1 <strong>Iconic per box</strong>: ${(100 * iconicPerBox).toFixed(1)}% chance</li>
        <li>≥1 <strong>Iconic per case</strong>: ${(100 * iconicPerCase).toFixed(1)}% chance</li>
        <li>≥1 <strong>Enchanted per box</strong>: ${(100 * odds.enchanted.perBox).toFixed(1)}% chance</li>
        <li>≥1 <strong>Enchanted per case</strong>: ${(100 * odds.enchanted.perCase).toFixed(1)}% chance</li>
      `;
    }
  }

  // Rarity table
  if (els.rarityTableBody) {
    if (!hasPricingData) {
      els.rarityTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 20px;">
            No pricing data available for the selected set
          </td>
        </tr>
      `;
    } else {
      const rows = [];
      const sortedSummaries = Object.entries(state.summaries)
        .sort(([a], [b]) => a.localeCompare(b));
      
      for (const [key, s] of sortedSummaries) {
        rows.push(`
          <tr>
            <td>${s.rarity}</td>
            <td>${s.finish}</td>
            <td>${s.count}</td>
            <td>${fmt(s.mean)}</td>
            <td>${fmt(s.median)}</td>
            <td class="sources-cell">${formatSources(s.sources)}</td>
          </tr>
        `);
      }
      els.rarityTableBody.innerHTML = rows.join('');
    }
  }

  // Optional Monte Carlo display (commented out for performance)
  // const sim = simulateEV(state.summaries, cfg, 1000);
  // console.log('Simulated box EV:', sim);
  
  // Render comparisons table
  renderComparisonsTable();
  
  // Render box pricing
  updateBoxPricing();
}

function renderComparisonsTable() {
  if (!els.comparisonsTableBody || !state.priceComparisons) return;
  
  const showOnlyHighVariance = els.showOnlyHighVariance?.checked ?? true;
  const minVariance = parseFloat(els.minVariance?.value ?? 1);
  
  let filteredComparisons = state.priceComparisons;
  
  // Apply filters
  if (showOnlyHighVariance) {
    filteredComparisons = filteredComparisons.filter(c => c.percentDiff > 50);
  }
  
  if (minVariance > 0) {
    filteredComparisons = filteredComparisons.filter(c => c.variance >= minVariance);
  }
  
  // Limit to top 50 for performance
  const displayComparisons = filteredComparisons.slice(0, 50);
  
  if (displayComparisons.length === 0) {
    els.comparisonsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 20px;">
          No pricing comparisons match the current filters
        </td>
      </tr>
    `;
    return;
  }
  
  const rows = displayComparisons.map(comp => {
    const dreambornPrice = comp.prices.dreamborn ?? null;
    const lorcastPrice = comp.prices.lorcast ?? null;
    const justTcgPrice = comp.prices.justtcg ?? null;
    
    return `
      <tr>
        <td class="card-name">${comp.card_name}</td>
        <td>${comp.rarity}</td>
        <td>${comp.finish}</td>
        <td class="price-cell">${dreambornPrice ? fmt(dreambornPrice) : '—'}</td>
        <td class="price-cell">${lorcastPrice ? fmt(lorcastPrice) : '—'}</td>
        <td class="price-cell">${justTcgPrice ? fmt(justTcgPrice) : '—'}</td>
        <td class="variance-cell">${fmt(comp.variance)}</td>
        <td class="percent-cell">${comp.percentDiff.toFixed(1)}%</td>
      </tr>
    `;
  });
  
  els.comparisonsTableBody.innerHTML = rows.join('');
}

function formatSources(sources) {
  if (!sources || Object.keys(sources).length === 0) return '—';
  
  const sourceLabels = {
    dreamborn: 'D',
    lorcast: 'L', 
    justtcg: 'J'
  };
  
  return Object.entries(sources)
    .map(([source, count]) => `${sourceLabels[source]}:${count}`)
    .join(' ');
}

async function loadAllBoxPricing() {
  try {
    // For now, we only have Set 9 (Fabled) box pricing data
    // In the future, this could load multiple sets' pricing data
    const response = await fetch('./data/BOX_PRICING.json');
    state.allBoxPricing = await response.json();
  } catch (error) {
    console.warn('Box pricing data not available:', error.message);
    state.allBoxPricing = null;
  }
}

function updateBoxPricing() {
  // Clear existing pricing displays
  if (els.boxMarketPrice) els.boxMarketPrice.innerHTML = '';
  if (els.caseMarketPrice) els.caseMarketPrice.innerHTML = '';
  
  if (!state.allBoxPricing || !state.allBoxPricing.products) {
    return;
  }
  
  // Find box and case products for the current set
  let boxProduct = null;
  let caseProduct = null;
  
  for (const [productKey, product] of Object.entries(state.allBoxPricing.products)) {
    if (product.product_type === 'booster_box' && product.set === getSetName(state.selectedSet)) {
      boxProduct = product;
    } else if (product.product_type === 'case' && product.set === getSetName(state.selectedSet)) {
      caseProduct = product;
    }
  }
  
  // Update box pricing display
  if (boxProduct && els.boxMarketPrice) {
    const marketPrice = boxProduct.best_price ? boxProduct.best_price.price : null;
    els.boxMarketPrice.innerHTML = marketPrice ? 
      `<div class="market-info">Market: ${fmt(marketPrice)}</div>` : 
      '';
  }
  
  // Update case pricing display  
  if (caseProduct && els.caseMarketPrice) {
    const marketPrice = caseProduct.best_price ? caseProduct.best_price.price : null;
    els.caseMarketPrice.innerHTML = marketPrice ? 
      `<div class="market-info">Market: ${fmt(marketPrice)}</div>` : 
      '';
  }
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}