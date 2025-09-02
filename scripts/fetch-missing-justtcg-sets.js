#!/usr/bin/env node
// Incrementally fetch missing JustTCG data - only fetch sets we don't already have

import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000; // 1 second between requests
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
    
    // Analyze what we already have
    const existingCoverage = {};
    Object.keys(existingData.cards).forEach(cardId => {
      const setCode = cardId.substring(0, 3);
      existingCoverage[setCode] = (existingCoverage[setCode] || 0) + 1;
    });
    
    console.log('📊 Existing JustTCG coverage:');
    Object.entries(existingCoverage).forEach(([setCode, count]) => {
      console.log(`   ${setCode}: ${count} cards`);
    });
    
    return { data: existingData, coverage: existingCoverage };
    
  } catch (error) {
    console.log('ℹ️  No existing JustTCG data found, will fetch all sets');
    return {
      data: {
        metadata: {
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          total_cards: 0,
          api_key_used: API_KEY.substring(0, 10) + '...',
          fetch_method: 'incremental'
        },
        sets: {},
        cards: {}
      },
      coverage: {}
    };
  }
}

async function getAvailableSets() {
  console.log('🔍 Getting available sets from JustTCG...');
  
  const response = await makeApiRequest(`${BASE_URL}/sets?game=disney-lorcana`);
  const sets = response.data.data || response.data || [];
  
  // Map sets to our standard codes
  const mappedSets = sets.map(set => {
    let setCode = 'UNK';
    
    // Map main sets
    if (set.name.includes('First Chapter')) setCode = '001';
    else if (set.name.includes('Floodborn')) setCode = '002';
    else if (set.name.includes('Inklands')) setCode = '003';
    else if (set.name.includes('Ursula')) setCode = '004';
    else if (set.name.includes('Shimmering')) setCode = '005';
    else if (set.name.includes('Azurite')) setCode = '006';
    else if (set.name.includes('Archazia')) setCode = '007';
    else if (set.name.includes('Jafar')) setCode = '008';
    else if (set.name.includes('Fabled')) setCode = '009';
    // Promo sets get special codes
    else if (set.name.includes('D23')) setCode = 'D23';
    else if (set.name.includes('Disney100')) setCode = 'D100';
    else if (set.name.includes('Promo')) setCode = 'P1';
    else if (set.name.includes('Illumineer')) setCode = `IQ${set.name.includes('Deep') ? '1' : '2'}`;
    
    return {
      id: set.id,
      name: set.name,
      code: setCode,
      cards_count: set.cards_count || 0
    };
  });
  
  console.log(`✅ Found ${mappedSets.length} sets:`);
  mappedSets.forEach(set => {
    console.log(`   ${set.code}: ${set.name} (${set.cards_count} cards)`);
  });
  
  return mappedSets;
}

async function fetchSetData(set, existingData) {
  console.log(`\n📦 Fetching ${set.name} (${set.code})...`);
  
  const setCards = {};
  let offset = 0;
  let hasMore = true;
  let totalFetched = 0;
  
  while (hasMore) {
    try {
      const url = `${BASE_URL}/cards?game=disney-lorcana&set=${encodeURIComponent(set.name)}&limit=${CARDS_PER_BATCH}&offset=${offset}`;
      const response = await makeApiRequest(url);
      
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
  
  // Add to existing data
  Object.assign(existingData.cards, setCards);
  
  // Ensure sets object exists
  if (!existingData.sets) existingData.sets = {};
  
  existingData.sets[set.code] = {
    name: set.name,
    code: set.code,
    cards_count: totalFetched,
    fetched_at: new Date().toISOString()
  };
  
  // Save immediately after each set to avoid data loss
  existingData.metadata.last_updated = new Date().toISOString();
  existingData.metadata.total_cards = Object.keys(existingData.cards).length;
  existingData.metadata.sets_fetched = Object.keys(existingData.sets).length;
  
  fs.writeFileSync('./data/JUSTTCG.json', JSON.stringify(existingData, null, 2));
  console.log(`   💾 Saved progress: ${Object.keys(existingData.cards).length} total cards`);
  
  return totalFetched;
}

async function fetchMissingJustTcgSets() {
  console.log('🚀 Fetching missing JustTCG sets...\n');
  
  // Load existing data
  const { data: existingData, coverage: existingCoverage } = loadExistingData();
  
  // Get available sets
  const availableSets = await getAvailableSets();
  
  // Determine which sets need to be fetched
  const setsToFetch = [];
  
  for (const set of availableSets) {
    const existingCount = existingCoverage[set.code] || 0;
    const expectedCount = set.cards_count;
    
    // Fetch if we have significantly fewer cards than expected
    // (allowing for some variance due to sealed products, variants, etc.)
    const threshold = Math.max(1, expectedCount * 0.9); // 90% threshold
    
    if (existingCount < threshold) {
      setsToFetch.push({
        ...set,
        reason: existingCount === 0 ? 'missing' : `incomplete (${existingCount}/${expectedCount})`
      });
      console.log(`📌 Will fetch ${set.code} (${set.name}): ${set.reason}`);
    } else {
      console.log(`✅ Skipping ${set.code} (${set.name}): ${existingCount} cards (sufficient)`);
    }
  }
  
  if (setsToFetch.length === 0) {
    console.log('\n🎉 All sets are already up to date!');
    return existingData;
  }
  
  console.log(`\n🔄 Fetching ${setsToFetch.length} sets...`);
  
  // Fetch missing sets
  let totalNewCards = 0;
  for (let i = 0; i < setsToFetch.length; i++) {
    const set = setsToFetch[i];
    console.log(`\n[${i + 1}/${setsToFetch.length}] Processing ${set.name}...`);
    
    const cardsFetched = await fetchSetData(set, existingData);
    totalNewCards += cardsFetched;
    
    // Small delay between sets
    if (i < setsToFetch.length - 1) {
      await delay(DELAY_MS);
    }
  }
  
  // Update metadata
  existingData.metadata.last_updated = new Date().toISOString();
  existingData.metadata.total_cards = Object.keys(existingData.cards).length;
  existingData.metadata.sets_fetched = Object.keys(existingData.sets).length;
  
  // Save updated data
  fs.writeFileSync('./data/JUSTTCG.json', JSON.stringify(existingData, null, 2));
  
  console.log(`\n💾 Updated JUSTTCG.json`);
  console.log(`📊 Final Summary:`);
  console.log(`   Total cards: ${existingData.metadata.total_cards}`);
  console.log(`   New cards added: ${totalNewCards}`);
  console.log(`   Sets covered: ${Object.keys(existingData.sets).length}`);
  
  // Show final coverage
  const finalCoverage = {};
  Object.keys(existingData.cards).forEach(cardId => {
    const setCode = cardId.substring(0, 3);
    finalCoverage[setCode] = (finalCoverage[setCode] || 0) + 1;
  });
  
  console.log('\n📈 Final set coverage:');
  Object.entries(finalCoverage).forEach(([setCode, count]) => {
    console.log(`   ${setCode}: ${count} cards`);
  });
  
  return existingData;
}

// Export for use by other scripts
export { fetchMissingJustTcgSets };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchMissingJustTcgSets().catch(console.error);
}