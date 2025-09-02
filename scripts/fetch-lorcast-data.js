#!/usr/bin/env node
// Fetch comprehensive card and set data from Lorcast API
// Create authoritative mapping between different sources

import https from 'https';
import fs from 'fs';
import path from 'path';

const DELAY_MS = 1000; // 1 second between API calls
const BASE_URL = 'https://api.lorcast.com/v0';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function fetchLorcastSets() {
  console.log('🔍 Fetching sets from Lorcast API...');
  
  try {
    const response = await makeApiRequest(`${BASE_URL}/sets`);
    
    if (response.statusCode !== 200) {
      throw new Error(`Lorcast sets API returned ${response.statusCode}`);
    }
    
    const sets = response.data.results || response.data;
    console.log(`✅ Found ${sets.length} sets`);
    
    return sets;
  } catch (error) {
    console.error('❌ Error fetching sets:', error.message);
    return null;
  }
}

async function fetchLorcastCardsForSet(setId, setCode) {
  console.log(`📋 Fetching cards for set ${setCode} (${setId})...`);
  
  try {
    const response = await makeApiRequest(`${BASE_URL}/sets/${setId}/cards`);
    
    if (response.statusCode !== 200) {
      throw new Error(`Lorcast cards API returned ${response.statusCode} for set ${setId}`);
    }
    
    const cards = response.data.results || response.data;
    console.log(`   ✅ Found ${cards.length} cards`);
    
    return cards;
  } catch (error) {
    console.error(`   ❌ Error fetching cards for set ${setCode}:`, error.message);
    return [];
  }
}

function normalizeCardId(card) {
  // Create standardized card ID in format: XXX-YYY
  const setCode = card.set?.code || 'UNK';
  const cardNum = String(card.collector_number || card.number || '000').padStart(3, '0');
  
  // Convert set codes to 3-digit format
  let setNum;
  if (setCode.match(/^\d+$/)) {
    setNum = String(setCode).padStart(3, '0');
  } else {
    // Handle special sets like P1, P2, D23, etc.
    setNum = setCode;
  }
  
  return `${setNum}-${cardNum}`;
}

function categorizeCard(card) {
  // Analyze card properties to understand variants and rarities
  const analysis = {
    id: card.id,
    name: card.name,
    title: card.version || null,
    set_id: card.set?.id,
    set_code: card.set?.code,
    set_name: card.set?.name,
    number: card.collector_number,
    rarity: card.rarity?.toLowerCase(),
    type: Array.isArray(card.type) ? card.type.join(', ') : card.type,
    cost: card.cost,
    ink: card.ink,
    strength: card.strength,
    willpower: card.willpower,
    lore: card.lore,
    variants: [],
    foil_available: false,
    is_variant: false
  };
  
  // Check for variant indicators
  if (card.rarity === 'Enchanted' || card.rarity === 'enchanted') {
    analysis.is_variant = true;
    analysis.variants.push('enchanted');
  }
  
  // Check for Epic/Iconic rarities (new in Fabled)
  if (card.rarity === 'Epic' || card.rarity === 'epic') {
    analysis.is_variant = true;
    analysis.variants.push('epic');
  }
  
  if (card.rarity === 'Iconic' || card.rarity === 'iconic') {
    analysis.is_variant = true;
    analysis.variants.push('iconic');
  }
  
  // Determine foil availability based on rarity and set patterns
  const rarity = analysis.rarity;
  if (['rare', 'super rare', 'legendary', 'enchanted', 'epic', 'iconic'].includes(rarity)) {
    analysis.foil_available = true;
  }
  
  // Some commons/uncommons have foil variants in certain sets
  if (['common', 'uncommon'].includes(rarity)) {
    // This would need set-specific logic based on actual foil patterns
    analysis.foil_available = true; // Default assumption, can be refined
  }
  
  return analysis;
}

async function fetchAllLorcastData() {
  console.log('🚀 Fetching comprehensive Lorcast data...\n');
  
  const sets = await fetchLorcastSets();
  if (!sets) {
    console.error('❌ Cannot proceed without sets data');
    return null;
  }
  
  const lorcastData = {
    metadata: {
      source: 'lorcast_api',
      fetched_at: new Date().toISOString(),
      total_sets: sets.length,
      total_cards: 0,
      api_version: 'v0'
    },
    sets: {},
    cards: {},
    rarity_analysis: {},
    set_analysis: {}
  };
  
  // Process each set
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    console.log(`\n📦 [${i+1}/${sets.length}] Processing: ${set.name} (${set.code})`);
    
    // Store set information
    lorcastData.sets[set.code] = {
      id: set.id,
      name: set.name,
      code: set.code,
      released_at: set.released_at,
      prereleased_at: set.prereleased_at
    };
    
    // Fetch cards for this set
    const cards = await fetchLorcastCardsForSet(set.id, set.code);
    
    if (cards.length === 0) {
      console.log(`   ⚠️  No cards found for ${set.name}`);
      continue;
    }
    
    // Analyze card distribution
    const setAnalysis = {
      total_cards: cards.length,
      rarities: {},
      types: {},
      variants: {},
      foil_patterns: {}
    };
    
    // Process each card
    for (const card of cards) {
      const normalizedId = normalizeCardId(card);
      const cardAnalysis = categorizeCard(card);
      
      // Store card with normalized ID
      lorcastData.cards[normalizedId] = {
        ...cardAnalysis,
        source: 'lorcast',
        raw_data: card
      };
      
      // Update set analysis
      const rarity = cardAnalysis.rarity || 'unknown';
      setAnalysis.rarities[rarity] = (setAnalysis.rarities[rarity] || 0) + 1;
      
      const type = cardAnalysis.type || 'unknown';
      setAnalysis.types[type] = (setAnalysis.types[type] || 0) + 1;
      
      if (cardAnalysis.is_variant) {
        cardAnalysis.variants.forEach(variant => {
          setAnalysis.variants[variant] = (setAnalysis.variants[variant] || 0) + 1;
        });
      }
      
      if (cardAnalysis.foil_available) {
        setAnalysis.foil_patterns[rarity] = (setAnalysis.foil_patterns[rarity] || 0) + 1;
      }
      
      lorcastData.metadata.total_cards++;
    }
    
    lorcastData.set_analysis[set.code] = setAnalysis;
    
    // Show analysis
    console.log(`   📊 Analysis:`)
    console.log(`      Total cards: ${setAnalysis.total_cards}`);
    console.log(`      Rarities: ${Object.entries(setAnalysis.rarities).map(([r, c]) => `${r}(${c})`).join(', ')}`);
    if (Object.keys(setAnalysis.variants).length > 0) {
      console.log(`      Variants: ${Object.entries(setAnalysis.variants).map(([v, c]) => `${v}(${c})`).join(', ')}`);
    }
    
    // Rate limiting
    if (i < sets.length - 1) {
      await delay(DELAY_MS);
    }
  }
  
  // Overall rarity analysis
  for (const [cardId, card] of Object.entries(lorcastData.cards)) {
    const rarity = card.rarity || 'unknown';
    if (!lorcastData.rarity_analysis[rarity]) {
      lorcastData.rarity_analysis[rarity] = {
        count: 0,
        foil_available: 0,
        sets: new Set()
      };
    }
    
    lorcastData.rarity_analysis[rarity].count++;
    if (card.foil_available) {
      lorcastData.rarity_analysis[rarity].foil_available++;
    }
    lorcastData.rarity_analysis[rarity].sets.add(card.set_code);
  }
  
  // Convert sets to arrays for JSON serialization
  for (const rarity of Object.keys(lorcastData.rarity_analysis)) {
    lorcastData.rarity_analysis[rarity].sets = Array.from(lorcastData.rarity_analysis[rarity].sets);
  }
  
  // Save data
  const outputPath = path.join(process.cwd(), 'data', 'LORCAST.json');
  fs.writeFileSync(outputPath, JSON.stringify(lorcastData, null, 2));
  
  console.log(`\n📊 Lorcast Data Summary:`);
  console.log(`   Total sets: ${lorcastData.metadata.total_sets}`);
  console.log(`   Total cards: ${lorcastData.metadata.total_cards}`);
  console.log(`   Rarities found: ${Object.keys(lorcastData.rarity_analysis).join(', ')}`);
  
  // Show rarity breakdown
  console.log(`\n📈 Rarity Analysis:`);
  for (const [rarity, analysis] of Object.entries(lorcastData.rarity_analysis)) {
    const foilPercent = (analysis.foil_available / analysis.count * 100).toFixed(1);
    console.log(`   ${rarity}: ${analysis.count} cards, ${analysis.foil_available} foil (${foilPercent}%), sets: ${analysis.sets.join(', ')}`);
  }
  
  console.log(`\n💾 Saved to ${outputPath}`);
  return lorcastData;
}

// Export for use by other scripts
export { fetchAllLorcastData };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllLorcastData().catch(console.error);
}