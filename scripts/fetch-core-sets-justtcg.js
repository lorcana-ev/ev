#!/usr/bin/env node
// Optimized JustTCG fetching for core sets only (001-010)
// Track fetch dates and avoid refetching recent data
//
// Usage:
//   node scripts/fetch-core-sets-justtcg.js                    # Normal update
//   node scripts/fetch-core-sets-justtcg.js --force            # Force refetch all sets
//   node scripts/fetch-core-sets-justtcg.js --exclude=010      # Exclude Set 10
//   node scripts/fetch-core-sets-justtcg.js --force --exclude=010,009  # Combine flags

import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 6500; // 6.5 seconds between requests (10 req/min = 6s minimum, add buffer)
const CARDS_PER_BATCH = 20;
const REFETCH_THRESHOLD_DAYS = 7; // Don't refetch if updated within 7 days
const API_KEYS_FILE = path.join(process.cwd(), 'config', 'justtcg-keys.json');

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
  'Fabled': '009',
  'Whispers in the Well': '010'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    force: false,
    exclude: [],
    help: false
  };

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--exclude=')) {
      const sets = arg.split('=')[1].split(',').map(s => s.trim());
      options.exclude.push(...sets);
    } else if (arg.startsWith('--skip=')) {
      const sets = arg.split('=')[1].split(',').map(s => s.trim());
      options.exclude.push(...sets);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔧 JustTCG Core Sets Fetcher

Usage:
  node scripts/fetch-core-sets-justtcg.js [options]

Options:
  --force, -f              Force refetch all sets (ignore age threshold)
  --exclude=001,002,...    Exclude specific sets from update
  --skip=001,002,...       Alias for --exclude
  --help, -h               Show this help message

Examples:
  # Normal update (only stale/incomplete sets)
  node scripts/fetch-core-sets-justtcg.js

  # Force update all sets with fresh prices
  node scripts/fetch-core-sets-justtcg.js --force

  # Update all except Set 10 (already fresh)
  node scripts/fetch-core-sets-justtcg.js --exclude=010

  # Force update all except Sets 9 and 10
  node scripts/fetch-core-sets-justtcg.js --force --exclude=009,010

Notes:
  - Force mode refetches ALL cards to update prices
  - Normal mode only updates sets older than ${REFETCH_THRESHOLD_DAYS} days or incomplete sets
  - Excluded sets are completely skipped
`);
}

function loadApiKeys() {
  try {
    const data = fs.readFileSync(API_KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading API keys:', error.message);
    console.error('   Make sure config/justtcg-keys.json exists');
    process.exit(1);
  }
}

function saveApiKeys(keysData) {
  keysData.metadata.last_updated = new Date().toISOString();
  fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keysData, null, 2));
}

function cleanOldMinuteRequests(key) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  // Keep only requests from the last minute
  key.minute_requests = (key.minute_requests || []).filter(timestamp => timestamp > oneMinuteAgo);
}

function isKeyAvailable(key, metadata) {
  const now = Date.now();

  if (key.status !== 'active') return false;

  // Check daily limit
  if (key.daily_limit_reset) {
    const resetTime = new Date(key.daily_limit_reset).getTime();
    if (now < resetTime) {
      // Still within the daily reset period
      if (key.daily_requests >= metadata.daily_limit) {
        return false; // Hit daily limit
      }
    } else {
      // Reset period has passed, clear the daily counter
      key.daily_requests = 0;
      key.daily_limit_reset = null;
    }
  }

  // Check if recently burst-limited (wait 90 seconds after a burst limit before retrying)
  if (key.last_burst_limited) {
    const burstLimitTime = new Date(key.last_burst_limited).getTime();
    const timeSinceBurstLimit = now - burstLimitTime;
    if (timeSinceBurstLimit < 90 * 1000) {
      return false; // Still in cooldown from burst limit
    }
  }

  // Check burst limit (requests in last minute)
  cleanOldMinuteRequests(key);
  if (key.minute_requests.length >= metadata.burst_limit_per_minute) {
    // Check if we should try again (if oldest request was >1 min ago after cleaning)
    const oldestRequest = Math.min(...key.minute_requests);
    const timeSinceOldest = now - oldestRequest;
    if (timeSinceOldest < 60 * 1000) {
      return false; // Still burst limited
    }
  }

  return true;
}

function getActiveApiKey(keysData) {
  const availableKeys = keysData.keys.filter(k => isKeyAvailable(k, keysData.metadata));

  if (availableKeys.length === 0) {
    return null; // All keys are rate limited
  }

  // Return the key with the fewest daily requests
  availableKeys.sort((a, b) => a.daily_requests - b.daily_requests);
  return availableKeys[0];
}

function getNextMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow;
}

function markKeyRateLimited(keysData, apiKey, limitType = 'daily') {
  const key = keysData.keys.find(k => k.key === apiKey);
  if (!key) return;

  const now = new Date();

  if (limitType === 'daily') {
    // Mark as daily rate limited - resets at midnight UTC
    const resetTime = getNextMidnightUTC();
    key.daily_limit_reset = resetTime.toISOString();
    // Set daily_requests to the limit so isKeyAvailable() knows it's exhausted
    key.daily_requests = keysData.metadata.daily_limit;
    saveApiKeys(keysData);
    const hoursUntilReset = ((resetTime - now) / (1000 * 60 * 60)).toFixed(1);
    console.log(`   🔒 ${key.name} hit daily limit - resets at midnight UTC (${hoursUntilReset}h from now)`);
  } else if (limitType === 'burst') {
    // Mark as burst rate limited - should be available in ~1 minute
    key.last_burst_limited = now.toISOString();
    saveApiKeys(keysData);
    console.log(`   ⏱️  ${key.name} hit burst limit - wait ~60 seconds`);
  }
}

function incrementKeyRequests(keysData, apiKey) {
  const key = keysData.keys.find(k => k.key === apiKey);
  if (!key) return;

  const now = Date.now();

  // Increment daily counter
  key.daily_requests++;

  // Add timestamp to minute_requests for burst tracking
  if (!key.minute_requests) key.minute_requests = [];
  key.minute_requests.push(now);

  // Clean old requests periodically
  cleanOldMinuteRequests(key);
}

function makeApiRequest(url, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'x-api-key': apiKey,
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
    
    // Fix card counts in metadata (recalculate from actual cards, don't increment)
    // This ensures metadata is accurate even if corrupted
    Object.keys(existingData.set_metadata || {}).forEach(setCode => {
      existingData.set_metadata[setCode].card_count = 0;
    });

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
        fetch_method: 'core_sets_optimized'
      },
      set_metadata: {},
      sets: {},
      cards: {}
    };
  }
}

async function getCoreSetsFromAPI(keysData) {
  console.log('🔍 Getting core sets from JustTCG API...');

  let currentApiKey = null;
  let response = null;

  // Try all available keys
  while (!response) {
    const keyObj = getActiveApiKey(keysData);
    if (!keyObj) {
      throw new Error('All API keys are rate limited. Please wait until midnight UTC or until burst limits reset.');
    }

    currentApiKey = keyObj.key;
    console.log(`   🔑 Using ${keyObj.name} (${keyObj.daily_requests} daily requests)`);

    // Wait if this key was used recently
    const key = keysData.keys.find(k => k.key === currentApiKey);
    if (key && key.minute_requests && key.minute_requests.length > 0) {
      const lastRequest = Math.max(...key.minute_requests);
      const timeSinceLastRequest = Date.now() - lastRequest;
      const minDelay = DELAY_MS;

      if (timeSinceLastRequest < minDelay) {
        const waitTime = minDelay - timeSinceLastRequest;
        console.log(`   ⏳ Waiting ${(waitTime / 1000).toFixed(1)}s since last request on this key...`);
        await delay(waitTime);
      }
    }

    response = await makeApiRequest(`${BASE_URL}/sets?game=disney-lorcana`, currentApiKey);
    incrementKeyRequests(keysData, currentApiKey);

    // Handle 429 rate limit
    if (response.statusCode === 429) {
      const limitType = response.data?.code === 'DAILY_LIMIT_EXCEEDED' ? 'daily' : 'burst';
      console.log(`   ⚠️  ${limitType === 'daily' ? '🔒 Daily' : '⏱️  Burst'} limit hit on ${keyObj.name}`);

      markKeyRateLimited(keysData, currentApiKey, limitType);

      if (limitType === 'burst') {
        // Try another key or wait
        const nextKey = getActiveApiKey(keysData);
        if (nextKey && nextKey.key !== currentApiKey) {
          console.log(`   🔄 Switching to another key...`);
          response = null; // Retry with new key
          continue;
        } else {
          console.log(`   ⏳ Waiting 60 seconds for burst limit to reset...`);
          await delay(60000);
          response = null; // Retry after wait
          continue;
        }
      } else {
        // Daily limit - try another key
        const nextKey = getActiveApiKey(keysData);
        if (nextKey && nextKey.key !== currentApiKey) {
          console.log(`   🔄 Switching to ${nextKey.name}...`);
          response = null; // Retry with new key
          continue;
        } else {
          throw new Error('All API keys have hit their daily limit. Please try again after midnight UTC.');
        }
      }
    }

    if (response.statusCode !== 200) {
      throw new Error(`API returned status ${response.statusCode}: ${JSON.stringify(response.data)}`);
    }
  }

  const allSets = response.data.data || response.data || [];

  console.log('📋 Found sets from API:', allSets.length);
  
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

function shouldFetchSet(setCode, existingData, expectedCardCount, forceRefresh = false) {
  const setMeta = existingData.set_metadata[setCode];

  // Force mode: always refetch
  if (forceRefresh) {
    if (setMeta) {
      const daysSinceLastFetch = (new Date() - new Date(setMeta.last_fetched)) / (1000 * 60 * 60 * 24);
      console.log(`   🔄 ${setCode}: Force refresh (last fetched ${daysSinceLastFetch.toFixed(1)} days ago)`);
    } else {
      console.log(`   🔄 ${setCode}: Force refresh (never fetched)`);
    }
    return { shouldFetch: true, reason: 'forced' };
  }

  if (!setMeta) {
    console.log(`   📌 ${setCode}: No previous fetch data - will fetch`);
    return { shouldFetch: true, reason: 'never_fetched' };
  }

  // Always refetch if we have 0 cards (something went wrong)
  if (setMeta.card_count === 0) {
    console.log(`   📌 ${setCode}: Has 0 cards - will refetch`);
    return { shouldFetch: true, reason: 'zero_cards' };
  }

  // Check if last fetch still had more data available (incomplete set)
  // This is more reliable than card count comparison since API count includes sealed products
  if (setMeta.last_had_more === true || setMeta.status === 'partial') {
    const completionRatio = setMeta.card_count / expectedCardCount;
    console.log(`   📌 ${setCode}: Incomplete - API has more data (${setMeta.card_count} cards, ${(completionRatio * 100).toFixed(1)}%) - will fetch`);
    return { shouldFetch: true, reason: 'incomplete' };
  }

  // Set is complete - check age for refresh
  const lastFetched = new Date(setMeta.last_fetched);
  const daysSinceLastFetch = (new Date() - lastFetched) / (1000 * 60 * 60 * 24);

  if (daysSinceLastFetch < REFETCH_THRESHOLD_DAYS) {
    console.log(`   ✅ ${setCode}: ${setMeta.card_count} cards (complete), fetched ${daysSinceLastFetch.toFixed(1)} days ago - skipping`);
    return { shouldFetch: false, reason: 'recently_fetched' };
  }

  console.log(`   ⏳ ${setCode}: ${setMeta.card_count} cards (complete), last fetched ${daysSinceLastFetch.toFixed(1)} days ago - will refetch`);
  return { shouldFetch: true, reason: 'stale_data' };
}

async function fetchSetData(set, existingData, keysData) {
  console.log(`\\n📦 Fetching ${set.name} (${set.code})...`);

  // For stale data or forced refresh, refetch from beginning to update prices
  // For incomplete/never_fetched, resume from where we left off
  let startOffset = 0;

  if (set.reason === 'stale_data' || set.reason === 'forced') {
    if (set.reason === 'forced') {
      console.log(`   🔄 Force refetching all cards to update prices`);
    } else {
      console.log(`   🔄 Refetching all cards to update prices (data is ${Math.round((new Date() - new Date(existingData.set_metadata[set.code]?.last_fetched)) / (1000 * 60 * 60 * 24))} days old)`);
    }
  } else {
    // Calculate where to resume from based on existing cards
    const existingCards = Object.keys(existingData.cards || {}).filter(id => id.startsWith(`${set.code}-`));
    startOffset = Math.floor(existingCards.length / CARDS_PER_BATCH) * CARDS_PER_BATCH;

    if (startOffset > 0) {
      console.log(`   🔄 Resuming from offset ${startOffset} (${existingCards.length} cards already fetched)`);
    }
  }

  const setCards = {};
  let offset = startOffset;
  let hasMore = true;
  let totalFetched = 0;
  let currentApiKey = null;

  while (hasMore) {
    try {
      // Get an active API key
      if (!currentApiKey) {
        const keyObj = getActiveApiKey(keysData);
        if (!keyObj) {
          console.log(`   ❌ All API keys are rate limited. Please wait 24 hours.`);
          break;
        }
        currentApiKey = keyObj.key;
        console.log(`   🔑 Using ${keyObj.name} (${keyObj.daily_requests} daily requests so far)`);

        // Wait if this key was used recently
        const key = keysData.keys.find(k => k.key === currentApiKey);
        if (key && key.minute_requests && key.minute_requests.length > 0) {
          const lastRequest = Math.max(...key.minute_requests);
          const timeSinceLastRequest = Date.now() - lastRequest;
          const minDelay = DELAY_MS;

          if (timeSinceLastRequest < minDelay) {
            const waitTime = minDelay - timeSinceLastRequest;
            console.log(`   ⏳ Waiting ${(waitTime / 1000).toFixed(1)}s since last request on this key...`);
            await delay(waitTime);
          }
        }
      }

      // Use set.id instead of set.name for the API query
      const url = `${BASE_URL}/cards?game=disney-lorcana&set=${encodeURIComponent(set.id)}&limit=${CARDS_PER_BATCH}&offset=${offset}`;
      const response = await makeApiRequest(url, currentApiKey);

      // Increment request counter
      incrementKeyRequests(keysData, currentApiKey);

      if (response.statusCode === 429) {
        const key = keysData.keys.find(k => k.key === currentApiKey);
        const minuteRequestCount = (key?.minute_requests || []).length;
        const dailyRequestCount = key?.daily_requests || 0;

        // Detect limit type from API response code
        let limitType;
        if (response.data?.code === 'DAILY_LIMIT_EXCEEDED') {
          limitType = 'daily';
          console.log(`   🔒 Daily limit exceeded (${dailyRequestCount} requests today)`);
        } else {
          // Assume burst/rate limit
          limitType = 'burst';
          console.log(`   ⏱️  Rate limit hit (${minuteRequestCount} requests in last minute)`);
        }

        // Mark this key as rate limited
        markKeyRateLimited(keysData, currentApiKey, limitType);

        if (limitType === 'burst') {
          // For burst limits, try another key or wait briefly
          const currentKeyName = key?.name || 'Unknown';
          const nextKey = getActiveApiKey(keysData);
          if (nextKey && nextKey.key !== currentApiKey) {
            console.log(`   🔄 Switching from ${currentKeyName} to ${nextKey.name}...`);
            currentApiKey = nextKey.key;
            await delay(2000); // Short delay before retry
            continue; // Retry with new key
          } else {
            // All keys are burst limited, wait for cooldown period
            const availableCount = keysData.keys.filter(k => isKeyAvailable(k, keysData.metadata)).length;
            console.log(`   ⏳ All keys burst limited (${availableCount}/4 available) - waiting 95 seconds for cooldown...`);
            await delay(95000); // Wait 95 seconds (90s cooldown + 5s buffer)
            currentApiKey = null; // Try to get a fresh key after wait
            continue;
          }
        } else {
          // Daily limit hit - try another key
          const currentKeyName = key?.name || 'Unknown';
          const nextKey = getActiveApiKey(keysData);
          if (nextKey && nextKey.key !== currentApiKey) {
            console.log(`   🔄 Switching from ${currentKeyName} to ${nextKey.name}...`);
            currentApiKey = nextKey.key;
            await delay(2000); // Short delay before retry
            continue; // Retry with new key
          } else {
            // All keys hit daily limit
            const availableCount = keysData.keys.filter(k => isKeyAvailable(k, keysData.metadata)).length;
            console.log(`   ❌ All API keys have hit their daily limit (${availableCount}/4 available)`);
            console.log(`   💡 Progress saved: ${totalFetched} cards fetched this run`);
            console.log(`   🔄 Run this script again after midnight UTC when limits reset`);
            break;
          }
        }
      }

      if (response.statusCode !== 200) {
        console.log(`   ❌ API returned status ${response.statusCode}`);
        break;
      }

      // Sync our tracking with API's _metadata if available
      if (response.data?._metadata?.apiDailyRequestsUsed) {
        const key = keysData.keys.find(k => k.key === currentApiKey);
        if (key) {
          const apiCount = response.data._metadata.apiDailyRequestsUsed;
          // Only sync if:
          // 1. API reports more (our tracking might be behind due to crashes/restarts)
          // 2. OR if the key isn't marked as daily-limited (don't overwrite our 100 marker)
          if (apiCount > key.daily_requests || !key.daily_limit_reset) {
            key.daily_requests = apiCount;
          }
        }
      }

      const batch = response.data;
      const cards = batch.data || [];
      
      console.log(`   📋 Batch at offset ${offset}: ${cards.length} cards`);
      
      // Process cards
      let actualCardsCount = 0;
      cards.forEach(rawCard => {
        // Skip sealed products (boxes, cases, etc.)
        if (rawCard.number === 'N/A' || rawCard.rarity === 'None' || !rawCard.number) {
          return; // Skip this card
        }

        actualCardsCount++;
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

      if (actualCardsCount < cards.length) {
        console.log(`   ⚠️  Filtered out ${cards.length - actualCardsCount} sealed products`);
      }

      totalFetched += actualCardsCount;
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
  
  console.log(`   ✅ Complete: ${totalFetched} cards fetched this run`);

  // Merge new cards (don't delete existing ones since we're resuming)
  Object.assign(existingData.cards, setCards);

  // Count actual cards we have for this set
  const actualCardCount = Object.keys(existingData.cards).filter(id => id.startsWith(`${set.code}-`)).length;

  // Set is complete when API says hasMore=false (meaning we've fetched everything available)
  // Don't rely on card count comparison since API count includes sealed products
  const isComplete = !hasMore;

  // Update set metadata
  existingData.set_metadata[set.code] = {
    set_code: set.code,
    set_name: set.name,
    last_fetched: new Date().toISOString(),
    card_count: actualCardCount,
    expected_count: set.cards_count,
    status: isComplete ? 'complete' : 'partial',
    last_fetch_added: totalFetched,
    last_had_more: hasMore,
    completion_percentage: ((actualCardCount / set.cards_count) * 100).toFixed(1)
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

async function fetchCoreSetsJustTcg(options = {}) {
  const { force = false, exclude = [] } = options;

  console.log('🚀 Fetching JustTCG core sets (001-010) with optimization...\\n');

  if (force) {
    console.log('⚡ Force mode enabled - will refetch all sets from beginning\\n');
  }

  if (exclude.length > 0) {
    console.log(`⏭️  Excluding sets: ${exclude.join(', ')}\\n`);
  }

  // Load API keys
  const keysData = loadApiKeys();
  console.log(`🔑 Loaded ${keysData.keys.length} API keys from config`);

  // Load existing data
  const existingData = loadExistingData();

  // Get available core sets from API
  const coreSets = await getCoreSetsFromAPI(keysData);

  // Filter out excluded sets
  const filteredSets = coreSets.filter(set => !exclude.includes(set.code));

  if (filteredSets.length < coreSets.length) {
    console.log(`\\n📋 ${coreSets.length - filteredSets.length} set(s) excluded, checking ${filteredSets.length} sets`);
  }

  // Determine which sets need fetching
  console.log('\\n🔍 Checking which sets need fetching...');
  const setsToFetch = [];

  for (const set of filteredSets) {
    const decision = shouldFetchSet(set.code, existingData, set.cards_count, force);
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
      const cardsFetched = await fetchSetData(set, existingData, keysData);
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

  // Save API keys state (includes updated request counts)
  saveApiKeys(keysData);

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
  const options = parseCliArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  fetchCoreSetsJustTcg(options).catch(console.error);
}