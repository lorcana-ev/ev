#!/usr/bin/env node
// JustTCG Batch Pricing System
// Efficiently fetches 20 cards at a time from JustTCG API with batch timestamps

import https from 'https';
import fs from 'fs';
import path from 'path';

const JUSTTCG_API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 2000; // 2 seconds between batch requests
const CARDS_PER_BATCH = 20; // JustTCG API limit

// Data file paths
const JUSTTCG_PRICING_FILE = path.join(process.cwd(), 'data', 'JUSTTCG.json');
const CARDS_FILE = path.join(process.cwd(), 'data', 'cards-formatted.json');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // Longer timeout for batch requests
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function loadJustTcgPricing() {
  try {
    const data = fs.readFileSync(JUSTTCG_PRICING_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('📄 Creating new JUSTTCG.json batch pricing file...');
    return {
      metadata: {
        created_at: new Date().toISOString(),
        last_updated: null,
        total_batches_fetched: 0,
        total_api_requests: 0,
        batch_size: CARDS_PER_BATCH
      },
      batches: {}, // Keyed by batch identifier (e.g., "page_1", "page_2")
      cards: {}    // Mapped individual cards for easy lookup
    };
  }
}

function saveJustTcgPricing(pricingData) {
  pricingData.metadata.last_updated = new Date().toISOString();
  pricingData.metadata.total_cards = Object.keys(pricingData.cards).length;
  
  fs.writeFileSync(JUSTTCG_PRICING_FILE, JSON.stringify(pricingData, null, 2));
  console.log(`💾 Saved ${pricingData.metadata.total_batches_fetched} batches with ${pricingData.metadata.total_cards || 0} mapped cards`);
}

function loadCards() {
  try {
    const data = fs.readFileSync(CARDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading cards-formatted.json:', error.message);
    return [];
  }
}

function findMatchingCardId(justTcgCard, allCards) {
  const set9Cards = allCards.filter(card => card.setId === '009');
  
  // Parse JustTCG card name to extract character and title
  let character, title;
  
  // Remove suffixes like (Enchanted), (Iconic), etc.
  const cleanName = justTcgCard.name.replace(/\s*\([^)]*\)\s*$/, '');
  
  if (cleanName.includes(' - ')) {
    [character, title] = cleanName.split(' - ').map(s => s.trim());
  } else {
    character = cleanName.trim();
    title = null;
  }
  
  // Find matches
  const matches = set9Cards.filter(ourCard => {
    const nameMatch = ourCard.name.toLowerCase() === character.toLowerCase();
    const titleMatch = !title || (ourCard.title && ourCard.title.toLowerCase() === title.toLowerCase());
    return nameMatch && titleMatch;
  });
  
  if (matches.length === 1) {
    return matches[0];
  } else if (matches.length > 1) {
    // If multiple matches, prefer by rarity hierarchy
    const rarityOrder = { 'enchanted': 0, 'legendary': 1, 'super rare': 2, 'rare': 3, 'uncommon': 4, 'common': 5 };
    const sortedMatches = matches.sort((a, b) => {
      const aRarity = rarityOrder[a.rarity?.toLowerCase()] || 999;
      const bRarity = rarityOrder[b.rarity?.toLowerCase()] || 999;
      return aRarity - bRarity;
    });
    return sortedMatches[0];
  }
  
  return null;
}

function convertJustTcgCardToStandardFormat(justTcgCard, batchTimestamp) {
  if (!justTcgCard || !justTcgCard.variants || justTcgCard.variants.length === 0) {
    return null;
  }
  
  const result = {
    name: justTcgCard.name,
    set: justTcgCard.set,
    number: justTcgCard.number,
    rarity: justTcgCard.rarity,
    tcgplayerId: justTcgCard.tcgplayerId,
    fetched_at: batchTimestamp,
    variants: {}
  };
  
  // Process all variants
  for (const variant of justTcgCard.variants) {
    const key = `${variant.condition || 'Near Mint'}_${variant.printing || 'Normal'}`.replace(/\s+/g, '_');
    
    result.variants[key] = {
      condition: variant.condition || 'Near Mint',
      printing: variant.printing || 'Normal',
      price: variant.price || 0,
      priceChange7d: variant.priceChange7d || 0,
      priceChange30d: variant.priceChange30d || 0,
      lastUpdated: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null
    };
  }
  
  return result;
}

async function fetchBatchFromJustTcg(offset = 0) {
  console.log(`📦 Fetching batch at offset ${offset} (cards ${offset + 1}-${offset + CARDS_PER_BATCH})...`);
  
  try {
    const url = `${JUSTTCG_BASE_URL}/cards?game=disney-lorcana&set=Fabled&limit=${CARDS_PER_BATCH}&offset=${offset}`;
    console.log(`🔗 URL: ${url}`);
    
    const response = await makeApiRequest(url);
    
    if (response.statusCode === 200 && response.data.data) {
      const cards = response.data.data;
      const meta = response.data.meta || {};
      console.log(`✅ Successfully fetched ${cards.length} cards from JustTCG`);
      console.log(`📊 Meta info: total=${meta.total}, offset=${meta.offset}, hasMore=${meta.hasMore}`);
      
      return {
        success: true,
        cards: cards,
        meta: meta,
        hasMore: meta.hasMore === true
      };
    } else {
      console.log(`❌ API returned status ${response.statusCode}`);
      console.log(`Response data:`, response.data);
      return { success: false, cards: [], meta: {}, hasMore: false };
    }
    
  } catch (error) {
    console.log(`❌ Error fetching batch at offset ${offset}: ${error.message}`);
    return { success: false, cards: [], meta: {}, hasMore: false };
  }
}

function calculateBatchPriorities(pricingData) {
  const priorities = [];
  
  // Check what batches we already have and their age
  const existingBatches = Object.keys(pricingData.batches);
  const maxBatchesEstimated = Math.ceil(242 / CARDS_PER_BATCH); // ~13 batches for Set 9
  
  for (let batchIndex = 0; batchIndex < maxBatchesEstimated; batchIndex++) {
    const offset = batchIndex * CARDS_PER_BATCH;
    const batchKey = `offset_${offset}`;
    const existingBatch = pricingData.batches[batchKey];
    
    if (!existingBatch) {
      // Missing batch - highest priority
      priorities.push({
        offset: offset,
        batchKey: batchKey,
        priority: 1,
        reason: 'missing_batch',
        lastFetched: null
      });
    } else {
      // Existing batch - check age
      const fetchedAt = new Date(existingBatch.fetched_at);
      const ageInDays = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 1) { // Refresh batches older than 1 day
        priorities.push({
          offset: offset,
          batchKey: batchKey,
          priority: 2,
          reason: 'outdated_batch',
          lastFetched: existingBatch.fetched_at,
          ageInDays: Math.round(ageInDays * 10) / 10
        });
      }
    }
  }
  
  // Sort by priority (1 = highest), then by offset
  priorities.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.offset - b.offset;
  });
  
  return priorities;
}

async function updateBatches(maxBatches = 3) {
  console.log('🚀 Starting JustTCG batch pricing update...\n');
  
  // Load data
  const pricingData = loadJustTcgPricing();
  const allCards = loadCards();
  
  if (allCards.length === 0) {
    console.error('❌ No cards data available');
    return;
  }
  
  // Calculate batch priorities
  const priorities = calculateBatchPriorities(pricingData);
  console.log(`📊 Batch Update Status:`);
  console.log(`   Missing batches: ${priorities.filter(p => p.priority === 1).length}`);
  console.log(`   Outdated batches: ${priorities.filter(p => p.priority === 2).length}`);
  console.log(`   Max batches this run: ${maxBatches}`);
  console.log(`   Existing batches: ${Object.keys(pricingData.batches).length}\n`);
  
  if (priorities.length === 0) {
    console.log('✅ All Set 9 batches are up to date!');
    return pricingData;
  }
  
  // Process priority batches
  const batchesToUpdate = priorities.slice(0, maxBatches);
  let batchesFetched = 0;
  let totalCardsProcessed = 0;
  let successfulMappings = 0;
  
  for (const batchInfo of batchesToUpdate) {
    if (batchesFetched >= maxBatches) {
      console.log(`⏰ Reached maximum batch limit (${maxBatches})`);
      break;
    }
    
    console.log(`\n🎯 Processing ${batchInfo.batchKey} (${batchInfo.reason})`);
    if (batchInfo.lastFetched) {
      console.log(`   Last fetched: ${batchInfo.lastFetched} (${batchInfo.ageInDays} days ago)`);
    }
    
    // Fetch batch from JustTCG
    const batchResult = await fetchBatchFromJustTcg(batchInfo.offset);
    batchesFetched++;
    pricingData.metadata.total_api_requests++;
    
    if (batchResult.success && batchResult.cards.length > 0) {
      const batchTimestamp = new Date().toISOString();
      
      // Store raw batch data
      pricingData.batches[batchInfo.batchKey] = {
        offset: batchInfo.offset,
        fetched_at: batchTimestamp,
        card_count: batchResult.cards.length,
        meta: batchResult.meta,
        raw_cards: batchResult.cards
      };
      
      // Map individual cards
      let batchMappings = 0;
      for (const justTcgCard of batchResult.cards) {
        console.log(`   🔍 Mapping: ${justTcgCard.name}`);
        
        const matchedCard = findMatchingCardId(justTcgCard, allCards);
        if (matchedCard) {
          const pricingInfo = convertJustTcgCardToStandardFormat(justTcgCard, batchTimestamp);
          if (pricingInfo) {
            pricingData.cards[matchedCard.id] = pricingInfo;
            batchMappings++;
            successfulMappings++;
            
            // Show sample pricing
            const variants = Object.values(pricingInfo.variants);
            const bestPrice = variants.find(v => v.condition === 'Near Mint') || variants[0];
            if (bestPrice) {
              console.log(`     ✅ ${matchedCard.id}: $${bestPrice.price} (${variants.length} variants)`);
            }
          }
        } else {
          console.log(`     ❌ No match found for: ${justTcgCard.name}`);
        }
      }
      
      console.log(`   📊 Offset ${batchInfo.offset}: ${batchMappings}/${batchResult.cards.length} cards mapped`);
      totalCardsProcessed += batchResult.cards.length;
      pricingData.metadata.total_batches_fetched++;
      
      // Check if we've reached the end
      if (!batchResult.hasMore) {
        console.log(`   ✅ Reached end of results at offset ${batchInfo.offset}`);
        break;
      }
      
    } else {
      console.log(`   ❌ Failed to fetch batch at offset ${batchInfo.offset}`);
      
      // If we get 0 cards, we might have reached the end
      if (batchResult.success && batchResult.cards.length === 0) {
        console.log(`   ✅ No more cards available - reached end of set`);
        break;
      }
    }
    
    // Rate limiting between batches
    if (batchesFetched < maxBatches) {
      console.log(`   ⏳ Waiting ${DELAY_MS}ms before next batch...`);
      await delay(DELAY_MS);
    }
  }
  
  // Save updated data
  saveJustTcgPricing(pricingData);
  
  // Summary
  console.log('\n📊 Batch Update Summary:');
  console.log(`   Batches fetched: ${batchesFetched}/${maxBatches}`);
  console.log(`   Cards processed: ${totalCardsProcessed}`);
  console.log(`   Successful mappings: ${successfulMappings}`);
  console.log(`   Total cards with pricing: ${Object.keys(pricingData.cards).length}/242`);
  console.log(`   Total batches stored: ${Object.keys(pricingData.batches).length}`);
  console.log(`   Total API requests made: ${pricingData.metadata.total_api_requests}`);
  
  const coverage = (Object.keys(pricingData.cards).length / 242 * 100).toFixed(1);
  console.log(`   Set 9 coverage: ${coverage}%`);
  
  return pricingData;
}

async function completeSetPull() {
  console.log('🚀 Starting complete JustTCG Set 9 (Fabled) pull...\n');
  
  // Load data
  const pricingData = loadJustTcgPricing();
  const allCards = loadCards();
  
  if (allCards.length === 0) {
    console.error('❌ No cards data available');
    return;
  }
  
  // Reset existing data for fresh pull
  pricingData.batches = {};
  pricingData.cards = {};
  pricingData.metadata.total_batches_fetched = 0;
  pricingData.metadata.total_api_requests = 0;
  
  let allFetchedCards = [];
  let offset = 0;
  let hasMoreResults = true;
  let totalBatches = 0;
  let successfulMappings = 0;
  
  console.log('📊 Starting complete pagination through JustTCG API...\n');
  
  while (hasMoreResults) {
    console.log(`\n🎯 Fetching batch at offset ${offset}...`);
    
    const batchResult = await fetchBatchFromJustTcg(offset);
    pricingData.metadata.total_api_requests++;
    totalBatches++;
    
    if (batchResult.success && batchResult.cards.length > 0) {
      const batchTimestamp = new Date().toISOString();
      const batchKey = `offset_${offset}`;
      
      // Store raw batch data
      pricingData.batches[batchKey] = {
        offset: offset,
        fetched_at: batchTimestamp,
        card_count: batchResult.cards.length,
        meta: batchResult.meta,
        raw_cards: batchResult.cards
      };
      
      allFetchedCards.push(...batchResult.cards);
      
      console.log(`✅ Batch ${totalBatches}: fetched ${batchResult.cards.length} cards (total: ${allFetchedCards.length})`);
      
      // Check hasMore from meta data
      hasMoreResults = batchResult.hasMore;
      
      if (!hasMoreResults) {
        console.log(`🏁 API indicates no more results available`);
        break;
      }
      
      // Move to next batch
      offset += CARDS_PER_BATCH;
      pricingData.metadata.total_batches_fetched++;
      
      // Rate limiting between batches
      if (hasMoreResults) {
        console.log(`   ⏳ Waiting ${DELAY_MS}ms before next batch...`);
        await delay(DELAY_MS);
      }
      
    } else if (batchResult.success && batchResult.cards.length === 0) {
      console.log(`🏁 Empty result set - reached end of data`);
      hasMoreResults = false;
      
    } else {
      console.log(`❌ Failed to fetch batch at offset ${offset}`);
      hasMoreResults = false;
    }
  }
  
  console.log(`\n📊 Complete Fetch Summary:`);
  console.log(`   Total batches: ${totalBatches}`);
  console.log(`   Total cards fetched: ${allFetchedCards.length}`);
  console.log(`   API requests made: ${pricingData.metadata.total_api_requests}`);
  
  // Now map all cards to our internal format
  console.log(`\n🔄 Mapping ${allFetchedCards.length} cards to internal format...`);
  
  for (let i = 0; i < allFetchedCards.length; i++) {
    const justTcgCard = allFetchedCards[i];
    console.log(`   🔍 [${i+1}/${allFetchedCards.length}] Mapping: ${justTcgCard.name}`);
    
    const matchedCard = findMatchingCardId(justTcgCard, allCards);
    if (matchedCard) {
      const pricingInfo = convertJustTcgCardToStandardFormat(justTcgCard, new Date().toISOString());
      if (pricingInfo) {
        pricingData.cards[matchedCard.id] = pricingInfo;
        successfulMappings++;
        
        // Show sample pricing
        const variants = Object.values(pricingInfo.variants);
        const bestPrice = variants.find(v => v.condition === 'Near Mint') || variants[0];
        if (bestPrice) {
          console.log(`     ✅ ${matchedCard.id}: $${bestPrice.price} (${variants.length} variants)`);
        }
      }
    } else {
      console.log(`     ❌ No match found for: ${justTcgCard.name}`);
    }
  }
  
  // Save complete data
  saveJustTcgPricing(pricingData);
  
  // Final summary
  console.log('\n🎉 Complete Set Pull Summary:');
  console.log(`   Total cards from JustTCG: ${allFetchedCards.length}`);
  console.log(`   Successfully mapped: ${successfulMappings}`);
  console.log(`   Mapping success rate: ${(successfulMappings/allFetchedCards.length*100).toFixed(1)}%`);
  console.log(`   Set 9 coverage: ${successfulMappings}/242 cards (${(successfulMappings/242*100).toFixed(1)}%)`);
  console.log(`   Total batches stored: ${Object.keys(pricingData.batches).length}`);
  console.log(`   Total API requests: ${pricingData.metadata.total_api_requests}`);
  
  return pricingData;
}

function showBatchStatus() {
  console.log('📊 JustTCG Batch Pricing Status\n');
  
  const pricingData = loadJustTcgPricing();
  const priorities = calculateBatchPriorities(pricingData);
  
  console.log(`📈 Set 9 Coverage: ${Object.keys(pricingData.cards).length}/242 cards (${(Object.keys(pricingData.cards).length/242*100).toFixed(1)}%)`);
  console.log(`📦 Batches stored: ${Object.keys(pricingData.batches).length}`);
  console.log(`🔄 Total API requests: ${pricingData.metadata.total_api_requests || 0}`);
  console.log(`⏰ Last updated: ${pricingData.metadata.last_updated || 'Never'}`);
  
  if (Object.keys(pricingData.batches).length > 0) {
    console.log('\n📦 Batch Details:');
    Object.entries(pricingData.batches).forEach(([batchKey, batch]) => {
      const age = ((Date.now() - new Date(batch.fetched_at).getTime()) / (1000 * 60 * 60)).toFixed(1);
      console.log(`   ${batchKey}: ${batch.card_count} cards (${age}h ago)`);
    });
  }
  
  if (priorities.length > 0) {
    console.log(`\n🎯 Next Update Priorities:`);
    priorities.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i+1}. ${item.batchKey} (${item.reason})`);
    });
  } else {
    console.log('\n✅ All Set 9 batches are up to date!');
  }
}

// Export functions
export { updateBatches, showBatchStatus, loadJustTcgPricing, completeSetPull };

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const maxBatches = parseInt(process.argv[3]) || 3;
  
  if (command === 'status') {
    showBatchStatus();
  } else if (command === 'update') {
    updateBatches(maxBatches).catch(console.error);
  } else if (command === 'complete') {
    completeSetPull().catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node batch-justtcg-pricing.js status');
    console.log('  node batch-justtcg-pricing.js update [max_batches]');
    console.log('  node batch-justtcg-pricing.js complete');
    console.log('');
    console.log('Examples:');
    console.log('  node batch-justtcg-pricing.js status');
    console.log('  node batch-justtcg-pricing.js update 2    # Fetch 2 batches (40 cards)');
    console.log('  node batch-justtcg-pricing.js complete   # Full set pull with proper pagination');
  }
}