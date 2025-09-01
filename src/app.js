// src/app.js
import { loadAll } from './lib/data.js';
import { indexPrices, buildRaritySummaries } from './lib/prices.js';
import { applyScenario, evPack, evBox, evCase, summarizeHitOdds, simulateEV, fmt } from './lib/model.js';
import { getAllSets, getSetName } from './lib/sets.js';
import { setViewer } from './lib/setviewer.js';

const els = {
  setSelection: document.getElementById('setSelection'),
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
  currentScenario: document.getElementById('currentScenario'),
  currentScenarioOdds: document.getElementById('currentScenarioOdds'),
  loadingStatus: document.getElementById('loadingStatus'),
  mainContent: document.getElementById('mainContent'),
};

let state = {
  printings: [],
  priceIndex: null,
  summaries: null,
  baseConfig: null,
  workingConfig: null,
  availableSets: [],
  selectedSet: '001' // Default to first set
};

init();

async function init() {
  try {
    showLoading('Loading card and price data...');
    
    const { printings, prices, packModel, cards } = await loadAll();
    state.printings = printings;
    state.baseConfig = packModel;

    showLoading('Processing price data...');
    state.priceIndex = indexPrices(prices);
    
    showLoading('Analyzing available sets...');
    state.availableSets = getAllSets(cards);
    setupSetSelection();
    
    showLoading('Computing price summaries...');
    recomputeSummaries();

    showLoading('Setting up interface...');
    wireUI();
    
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
      setViewer.setCurrentSet(state.selectedSet);
    });
  }
  
  
  if (els.scenario) {
    els.scenario.addEventListener('change', () => { 
      applyScenarioAndRender(); 
    });
  }
  
  if (els.reset) {
    els.reset.addEventListener('click', () => { 
      if (els.scenario) els.scenario.value = 'base';
      if (els.setSelection) {
        els.setSelection.value = '001';
        state.selectedSet = '001';
      }
      applyScenarioAndRender();
      setViewer.setCurrentSet(state.selectedSet); 
    });
  }
}

function recomputeSummaries() {
  const priceType = 'market';
  state.summaries = buildRaritySummaries(state.printings, state.priceIndex, priceType, state.selectedSet);
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
    .map(([rarity, odds]) => `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${(odds * 100).toFixed(0)}%`)
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
      els.hitList.innerHTML = `
        <li>Enchanted per pack: ${(100 * odds.enchanted.perPack).toFixed(3)}%</li>
        <li>≥1 Enchanted per box: ${(100 * odds.enchanted.perBox).toFixed(1)}%</li>
        <li>≥1 Enchanted per case: ${(100 * odds.enchanted.perCase).toFixed(1)}%</li>
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
          </tr>
        `);
      }
      els.rarityTableBody.innerHTML = rows.join('');
    }
  }

  // Optional Monte Carlo display (commented out for performance)
  // const sim = simulateEV(state.summaries, cfg, 1000);
  // console.log('Simulated box EV:', sim);
}