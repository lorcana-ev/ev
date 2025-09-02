#!/usr/bin/env node
// Fetch pricing data from JustTCG API for ALL Lorcana sets
// Create comprehensive pricing database across all sets

import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 500; // 0.5 seconds between requests for rate limiting
const CARDS_PER_BATCH = 20;

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
          console.error('Raw response data:', data.substring(0, 200));
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

// Map JustTCG set names to our standard format
const SET_NAME_MAPPING = {
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

async function fetchAllAvailableSets() {
  console.log('🔍 Fetching available sets from JustTCG sets endpoint...');
  
  try {
    const url = `${BASE_URL}/sets?game=disney-lorcana`;
    const response = await makeApiRequest(url);
    
    if (response.statusCode !== 200) {
      throw new Error(`Sets API returned status ${response.statusCode}`);
    }
    
    const sets = response.data.data || response.data || [];
    console.log(`✅ Found ${sets.length} sets from JustTCG API`);
    
    const availableSets = [];
    
    for (const set of sets) {
      console.log(`   📦 ${set.name}: ${set.cards_count || 'unknown count'} cards`);
      
      // Map to our standard set codes
      let setCode = null;
      for (const [standardName, code] of Object.entries(SET_NAME_MAPPING)) {
        if (set.name.includes(standardName) || standardName.includes(set.name)) {
          setCode = code;
          break;
        }
      }
      
      // If no mapping found, create one based on the name
      if (!setCode) {
        if (set.name.includes('First Chapter') || set.name.includes('Chapter 1')) {
          setCode = '001';
        } else if (set.name.includes('Floodborn') || set.name.includes('Chapter 2')) {
          setCode = '002';
        } else if (set.name.includes('Inklands') || set.name.includes('Chapter 3')) {
          setCode = '003';
        } else if (set.name.includes('Ursula') || set.name.includes('Chapter 4')) {
          setCode = '004';
        } else if (set.name.includes('Shimmering') || set.name.includes('Chapter 5')) {
          setCode = '005';
        } else if (set.name.includes('Azurite') || set.name.includes('Chapter 6')) {
          setCode = '006';
        } else if (set.name.includes('Archazia') || set.name.includes('Chapter 7')) {
          setCode = '007';
        } else if (set.name.includes('Jafar') || set.name.includes('Chapter 8')) {
          setCode = '008';
        } else if (set.name.includes('Fabled') || set.name.includes('Chapter 9')) {
          setCode = '009';
        } else {
          // Create a generic code for unknown sets
          setCode = `UNK-${set.id}`;
        }
      }
      
      availableSets.push({
        id: set.id,
        name: set.name,
        code: setCode,
        total_cards: set.cards_count || 0,
        game_id: set.game_id
      });
    }
    
    return availableSets;
    
  } catch (error) {
    console.error(`❌ Error fetching sets: ${error.message}`);
    return [];
  }
}

async function fetchCompleteSetData(setName, setCode) {
  console.log(`\n📦 Fetching complete data for ${setName} (${setCode})...`);
  
  const setData = {
    set_name: setName,
    set_code: setCode,
    fetched_at: new Date().toISOString(),
    total_cards: 0,
    batches: {},
    raw_cards: []
  };
  
  let offset = 0;
  let hasMore = true;
  let batchCount = 0;
  
  while (hasMore) {
    try {
      console.log(`   Batch ${batchCount + 1}: fetching cards ${offset + 1}-${offset + CARDS_PER_BATCH}...`);
      
      const url = `${BASE_URL}/cards?game=disney-lorcana&set=${encodeURIComponent(setName)}&limit=${CARDS_PER_BATCH}&offset=${offset}`;
      const response = await makeApiRequest(url);
      
      if (response.statusCode !== 200) {
        console.log(`   ❌ API returned status ${response.statusCode}`);
        break;
      }
      
      const batch = response.data;
      const cards = batch.data || [];
      
      console.log(`   ✅ Retrieved ${cards.length} cards`);
      
      // Store batch info
      const batchKey = `batch_${batchCount}`;
      setData.batches[batchKey] = {
        offset: offset,
        fetched_at: new Date().toISOString(),
        card_count: cards.length,
        meta: batch.meta
      };
      
      // Add cards to the collection
      cards.forEach(card => setData.raw_cards.push(card));
      
      // Check if there are more cards
      hasMore = batch.meta?.hasMore === true && cards.length > 0;
      offset += CARDS_PER_BATCH;
      batchCount++;
      
      if (hasMore) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.log(`   ❌ Error fetching batch: ${error.message}`);
      break;
    }
  }
  
  setData.total_cards = setData.raw_cards.length;
  console.log(`   📊 Complete: ${setData.total_cards} cards from ${batchCount} batches`);
  
  return setData;
}

function normalizeJustTcgCard(justTcgCard, setCode) {
  // Create standardized card ID
  const cardNumber = justTcgCard.number?.split('/')[0] || '000';
  const cardId = `${setCode}-${String(cardNumber).padStart(3, '0')}`;
  
  // Extract pricing variants
  const variants = {};
  if (justTcgCard.variants && Array.isArray(justTcgCard.variants)) {
    justTcgCard.variants.forEach(variant => {
      const key = `${variant.condition || 'Near Mint'}_${variant.printing || 'Normal'}`.replace(/\s+/g, '_');
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
  
  return {
    card_id: cardId,
    justtcg_id: justTcgCard.id,
    name: justTcgCard.name,
    set: justTcgCard.set,
    number: justTcgCard.number,
    rarity: justTcgCard.rarity,
    tcgplayer_id: justTcgCard.tcgplayerId,
    variants: variants,
    fetched_at: new Date().toISOString()
  };
}

async function fetchAllJustTcgData() {
  console.log('🚀 Fetching comprehensive JustTCG data for all sets...\n');
  
  // Discover available sets
  const availableSets = await fetchAllAvailableSets();
  
  if (availableSets.length === 0) {
    console.log('❌ No sets found or accessible');
    return null;
  }
  
  console.log(`\n✅ Found ${availableSets.length} available sets`);
  
  const comprehensiveData = {
    metadata: {
      source: 'justtcg_api_comprehensive',
      fetched_at: new Date().toISOString(),
      total_sets: availableSets.length,
      total_cards: 0,
      api_key_used: API_KEY.substring(0, 10) + '...',
      batch_size: CARDS_PER_BATCH
    },
    sets: {},
    all_cards: {},
    pricing_by_set: {}
  };
  
  // Fetch each set completely
  for (let i = 0; i < availableSets.length; i++) {
    const set = availableSets[i];
    console.log(`\n[${i + 1}/${availableSets.length}] Processing ${set.name}...`);
    
    const setData = await fetchCompleteSetData(set.name, set.code);
    
    // Store set data
    comprehensiveData.sets[set.code] = {
      name: set.name,
      code: set.code,
      total_cards: setData.total_cards,
      fetched_at: setData.fetched_at,
      batches: Object.keys(setData.batches).length
    };
    
    comprehensiveData.pricing_by_set[set.code] = {};
    
    // Process and normalize cards
    setData.raw_cards.forEach(rawCard => {
      const normalizedCard = normalizeJustTcgCard(rawCard, set.code);
      
      // Store in comprehensive collection
      comprehensiveData.all_cards[normalizedCard.card_id] = normalizedCard;
      
      // Store in set-specific collection
      comprehensiveData.pricing_by_set[set.code][normalizedCard.card_id] = normalizedCard;
      
      comprehensiveData.metadata.total_cards++;
    });
    
    console.log(`   📊 Set ${set.code} complete: ${setData.total_cards} cards processed`);
  }
  
  // Save comprehensive data
  const outputPath = path.join(process.cwd(), 'data', 'JUSTTCG_ALL_SETS.json');
  fs.writeFileSync(outputPath, JSON.stringify(comprehensiveData, null, 2));
  
  console.log(`\n💾 Comprehensive JustTCG data saved to ${outputPath}`);
  console.log(`📊 Final Summary:`);
  console.log(`   Total sets: ${comprehensiveData.metadata.total_sets}`);
  console.log(`   Total cards: ${comprehensiveData.metadata.total_cards}`);
  
  // Show set breakdown
  console.log('\n📈 Set breakdown:');
  Object.entries(comprehensiveData.sets).forEach(([code, setData]) => {
    console.log(`   ${code} (${setData.name}): ${setData.total_cards} cards`);
  });
  
  return comprehensiveData;
}

// Export for use by other scripts
export { fetchAllJustTcgData };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAllJustTcgData().catch(console.error);
}