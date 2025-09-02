#!/usr/bin/env node
// Optimized JustTCG fetching for core sets only (001-009)
// Track fetch dates and avoid refetching recent data

import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const API_KEY = 'tcg_0ecc60ebe3854a369313b16a95737637';
const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000; // 1 second between requests
const CARDS_PER_BATCH = 20;
const REFETCH_THRESHOLD_DAYS = 7; // Don't refetch if updated within 7 days

// Core sets only - no promos, special sets, etc.
const CORE_SETS = {
  'The First Chapter': '001',
  'Rise of the Floodborn': '002',
  'Into the Inklands': '003',
  'Ursula\'s Return': '004',
  'Shimmering Skies': '005',
  'Azurite Sea': '006',
  'Archazia\'s Island': '007',
  'Reign of Jafar': '008',
  'Fabled': '009'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: 30000
    };

    const req = https.request(url, options, (res) => {
      let responseStream = res;
      
      // Handle compression
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        responseStream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        responseStream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        responseStream = res.pipe(zlib.createBrotliDecompress());
      }
      
      let data = '';
      responseStream.on('data', chunk => {
        data += chunk.toString();
      });
      
      responseStream.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
      
      responseStream.on('error', reject);
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function loadExistingData() {
  try {
    const existingData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
    
    // Initialize sets metadata if it doesn't exist
    if (!existingData.set_metadata) {
      existingData.set_metadata = {};
    }
    
    // Initialize set metadata for existing data without fetch dates
    Object.keys(existingData.cards || {}).forEach(cardId => {
      const setCode = cardId.substring(0, 3);
      if (CORE_SETS && Object.values(CORE_SETS).includes(setCode)) {
        if (!existingData.set_metadata[setCode]) {
          existingData.set_metadata[setCode] = {
            set_code: setCode,
            last_fetched: new Date().toISOString(), // Set current timestamp for existing data
            card_count: 0,
            status: 'partial'
          };
        }
      }
    });
    
    // Count cards by set for existing metadata
    Object.keys(existingData.cards || {}).forEach(cardId => {
      const setCode = cardId.substring(0, 3);
      if (existingData.set_metadata[setCode]) {
        existingData.set_metadata[setCode].card_count++;
      }
    });
    
    return existingData;
    
  } catch (error) {
    console.log('ℹ️  No existing JustTCG data found, starting fresh');
    return {
      metadata: {
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        total_cards: 0,
        api_key_used: API_KEY.substring(0, 10) + '...',
        fetch_method: 'core_sets_optimized'
      },
      set_metadata: {},
      sets: {},
      cards: {}
    };
  }
}

async function getCoreSetsFromAPI() {
  console.log('🔍 Getting core sets from JustTCG API...');
  
  const response = await makeApiRequest(`${BASE_URL}/sets?game=disney-lorcana`);
  const allSets = response.data.data || response.data || [];
  
  console.log('📋 Raw sets response:', JSON.stringify(allSets, null, 2).substring(0, 500));
  
  // Filter to core sets only
  const coreSets = allSets.filter(set => {
    return Object.keys(CORE_SETS).some(coreSetName => 
      set.name.includes(coreSetName) || coreSetName.includes(set.name)
    );
  }).map(set => {
    // Map to our standard codes
    let setCode = null;
    for (const [standardName, code] of Object.entries(CORE_SETS)) {
      if (set.name.includes(standardName) || standardName.includes(set.name)) {
        setCode = code;
        break;
      }
    }
    
    return {
      id: set.id,
      name: set.name,
      code: setCode,
      cards_count: set.cards_count || 0
    };
  });
  
  console.log(`✅ Found ${coreSets.length} core sets:`);
  coreSets.forEach(set => {
    console.log(`   ${set.code}: ${set.name} (${set.cards_count} cards)`);
  });
  
  return coreSets;
}

function shouldFetchSet(setCode, existingData, expectedCardCount) {
  const setMeta = existingData.set_metadata[setCode];
  
  if (!setMeta) {
    console.log(`   📌 ${setCode}: No previous fetch data - will fetch`);
    return { shouldFetch: true, reason: 'never_fetched' };
  }
  
  // Check if last fetched within threshold
  const lastFetched = new Date(setMeta.last_fetched);
  const daysSinceLastFetch = (new Date() - lastFetched) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastFetch < REFETCH_THRESHOLD_DAYS) {
    console.log(`   ✅ ${setCode}: Fetched ${daysSinceLastFetch.toFixed(1)} days ago - skipping`);
    return { shouldFetch: false, reason: 'recently_fetched' };
  }
  
  // Check if we have significantly fewer cards than expected
  const completionRatio = setMeta.card_count / expectedCardCount;
  if (completionRatio < 0.9) {
    console.log(`   📌 ${setCode}: Only ${completionRatio.toFixed(1)}% complete (${setMeta.card_count}/${expectedCardCount}) - will fetch`);
    return { shouldFetch: true, reason: 'incomplete' };
  }
  
  console.log(`   ⏳ ${setCode}: Last fetched ${daysSinceLastFetch.toFixed(1)} days ago but complete - will refetch`);
  return { shouldFetch: true, reason: 'stale_data' };
}

async function fetchSetData(set, existingData) {
  console.log(`\\n📦 Fetching ${set.name} (${set.code})...`);
  
  const setCards = {};
  let offset = 0;
  let hasMore = true;
  let totalFetched = 0;
  
  while (hasMore) {
    try {
      const url = `${BASE_URL}/cards?game=disney-lorcana&set=${encodeURIComponent(set.name)}&limit=${CARDS_PER_BATCH}&offset=${offset}`;
      const response = await makeApiRequest(url);
      
      if (response.statusCode === 429) {
        console.log(`   ⚠️  Rate limited at offset ${offset} - stopping for now`);
        break;
      }
      
      if (response.statusCode !== 200) {
        console.log(`   ❌ API returned status ${response.statusCode}`);
        break;
      }
      
      const batch = response.data;
      const cards = batch.data || [];
      
      console.log(`   📋 Batch at offset ${offset}: ${cards.length} cards`);
      
      // Process cards
      cards.forEach(rawCard => {
        const cardNumber = rawCard.number?.split('/')[0] || '000';
        const cardId = `${set.code}-${String(cardNumber).padStart(3, '0')}`;
        
        // Extract pricing variants
        const variants = {};
        if (rawCard.variants && Array.isArray(rawCard.variants)) {
          rawCard.variants.forEach(variant => {
            const key = `${variant.condition || 'Near Mint'}_${variant.printing || 'Normal'}`.replace(/\\s+/g, '_');
            variants[key] = {
              condition: variant.condition || 'Near Mint',
              printing: variant.printing || 'Normal',
              price: variant.price || 0,
              priceChange7d: variant.priceChange7d || 0,
              priceChange30d: variant.priceChange30d || 0,
              lastUpdated: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null
            };
          });
        }
        
        setCards[cardId] = {
          card_id: cardId,
          justtcg_id: rawCard.id,
          name: rawCard.name,
          set: rawCard.set,
          number: rawCard.number,
          rarity: rawCard.rarity,
          tcgplayer_id: rawCard.tcgplayerId,
          variants: variants,
          fetched_at: new Date().toISOString()
        };
      });
      
      totalFetched += cards.length;
      hasMore = batch.meta?.hasMore === true && cards.length > 0;
      offset += CARDS_PER_BATCH;
      
      if (hasMore) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.log(`   ❌ Error fetching batch: ${error.message}`);
      break;
    }
  }
  
  console.log(`   ✅ Complete: ${totalFetched} cards fetched`);
  
  // Remove old cards for this set
  Object.keys(existingData.cards).forEach(cardId => {
    if (cardId.startsWith(`${set.code}-`)) {
      delete existingData.cards[cardId];
    }
  });
  
  // Add new cards
  Object.assign(existingData.cards, setCards);
  
  // Update set metadata
  existingData.set_metadata[set.code] = {
    set_code: set.code,
    set_name: set.name,
    last_fetched: new Date().toISOString(),
    card_count: totalFetched,
    expected_count: set.cards_count,
    status: totalFetched >= set.cards_count * 0.9 ? 'complete' : 'partial'
  };
  
  // Update sets info
  if (!existingData.sets) existingData.sets = {};
  existingData.sets[set.code] = {
    name: set.name,
    code: set.code,
    cards_count: totalFetched,
    fetched_at: new Date().toISOString()
  };
  
  // Save immediately after each set
  existingData.metadata.last_updated = new Date().toISOString();
  existingData.metadata.total_cards = Object.keys(existingData.cards).length;
  
  fs.writeFileSync('./data/JUSTTCG.json', JSON.stringify(existingData, null, 2));
  console.log(`   💾 Saved progress: ${Object.keys(existingData.cards).length} total cards`);
  
  return totalFetched;
}

async function fetchCoreSetsJustTcg() {
  console.log('🚀 Fetching JustTCG core sets (001-009) with optimization...\\n');
  
  // Load existing data
  const existingData = loadExistingData();
  
  // Get available core sets from API
  const coreSets = await getCoreSetsFromAPI();
  
  // Determine which sets need fetching
  console.log('\\n🔍 Checking which sets need fetching...');
  const setsToFetch = [];
  
  for (const set of coreSets) {
    const decision = shouldFetchSet(set.code, existingData, set.cards_count);
    if (decision.shouldFetch) {
      setsToFetch.push({ ...set, reason: decision.reason });
    }
  }
  
  if (setsToFetch.length === 0) {
    console.log('\\n🎉 All core sets are up to date!');
    return existingData;
  }
  
  console.log(`\\n🔄 Will fetch ${setsToFetch.length} sets:`);
  setsToFetch.forEach(set => {
    console.log(`   ${set.code} (${set.name}): ${set.reason}`);
  });
  
  // Fetch the sets that need updating
  let totalNewCards = 0;
  for (let i = 0; i < setsToFetch.length; i++) {
    const set = setsToFetch[i];
    
    try {
      const cardsFetched = await fetchSetData(set, existingData);
      totalNewCards += cardsFetched;
      
      // Delay between sets
      if (i < setsToFetch.length - 1) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.log(`   ❌ Failed to fetch ${set.code}: ${error.message}`);
      continue;
    }
  }
  
  // Final save and summary
  existingData.metadata.last_updated = new Date().toISOString();
  existingData.metadata.total_cards = Object.keys(existingData.cards).length;
  
  fs.writeFileSync('./data/JUSTTCG.json', JSON.stringify(existingData, null, 2));
  
  console.log('\\n💾 Final save completed');
  console.log('📊 Final Summary:');
  console.log(`   Total cards: ${existingData.metadata.total_cards}`);
  console.log(`   Cards added this run: ${totalNewCards}`);
  
  console.log('\\n📈 Core set status:');
  Object.values(CORE_SETS).forEach(setCode => {
    const setMeta = existingData.set_metadata[setCode];
    if (setMeta) {
      const status = setMeta.status === 'complete' ? '✅' : '⚠️';
      const daysSince = ((new Date() - new Date(setMeta.last_fetched)) / (1000 * 60 * 60 * 24)).toFixed(1);
      console.log(`   ${setCode}: ${setMeta.card_count} cards ${status} (${daysSince}d ago)`);
    } else {
      console.log(`   ${setCode}: No data ❌`);
    }
  });
  
  return existingData;
}

// Export for use by other scripts
export { fetchCoreSetsJustTcg };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchCoreSetsJustTcg().catch(console.error);
}