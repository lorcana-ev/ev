#!/usr/bin/env node
// Refetch Set 4 and investigate the numbering/variant system more thoroughly

import https from 'https';
import fs from 'fs';
import zlib from 'zlib';

const API_KEY = 'tcg_0ecc60ebe3854a369313b16a95737637';
const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000;
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

function normalizeJustTcgCard(justTcgCard, setCode) {
  // Enhanced card ID normalization to handle different numbering schemes
  let cardNumber = '000';
  
  if (justTcgCard.number) {
    // Handle formats like "4/204", "207/204", "223/204"
    const numberMatch = justTcgCard.number.match(/^(\d+)/);
    if (numberMatch) {
      cardNumber = String(numberMatch[1]).padStart(3, '0');
    }
  }
  
  const cardId = `${setCode}-${cardNumber}`;
  
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
    fetched_at: new Date().toISOString(),
    raw_number: justTcgCard.number // Keep original for debugging
  };
}

async function refetchSet4() {
  console.log('🔄 Refetching Set 4 (Ursula\'s Return) with enhanced approach\n');
  
  // Load existing data
  let existingData;
  try {
    existingData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  } catch (error) {
    console.log('❌ Could not load existing JustTCG data');
    return;
  }
  
  console.log(`📊 Current Set 4 coverage: ${Object.keys(existingData.cards).filter(id => id.startsWith('004-')).length} cards`);
  
  // Try different set name variations for Set 4
  const set4Variations = [
    "Ursula's Return",
    "Ursulas Return", 
    "Disney Lorcana: Ursula's Return"
  ];
  
  for (const setName of set4Variations) {
    console.log(`\n📦 Trying set name: "${setName}"`);
    
    let offset = 0;
    let hasMore = true;
    let totalFetched = 0;
    const setCards = {};
    
    while (hasMore && totalFetched < 500) { // Safety limit
      try {
        const url = `${BASE_URL}/cards?game=disney-lorcana&set=${encodeURIComponent(setName)}&limit=${CARDS_PER_BATCH}&offset=${offset}`;
        const response = await makeApiRequest(url);
        
        if (response.statusCode !== 200) {
          console.log(`   ❌ API returned status ${response.statusCode}`);
          break;
        }
        
        const batch = response.data;
        const cards = batch.data || [];
        
        if (cards.length === 0) {
          console.log(`   ℹ️  No cards found for "${setName}"`);
          break;
        }
        
        console.log(`   📋 Batch at offset ${offset}: ${cards.length} cards`);
        
        // Process cards
        cards.forEach(rawCard => {
          const normalizedCard = normalizeJustTcgCard(rawCard, '004');
          setCards[normalizedCard.card_id] = normalizedCard;
          
          // Show some examples
          if (totalFetched < 5) {
            console.log(`     ${normalizedCard.card_id}: ${normalizedCard.name} (${normalizedCard.rarity}) [${normalizedCard.raw_number}]`);
          }
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
    
    if (totalFetched > 0) {
      console.log(`   ✅ Found ${totalFetched} cards with "${setName}"`);
      
      // Remove old Set 4 cards and add new ones
      Object.keys(existingData.cards).forEach(cardId => {
        if (cardId.startsWith('004-')) {
          delete existingData.cards[cardId];
        }
      });
      
      // Add new cards
      Object.assign(existingData.cards, setCards);
      
      // Update metadata
      existingData.set_metadata = existingData.set_metadata || {};
      existingData.set_metadata['004'] = {
        set_code: '004',
        set_name: setName,
        last_fetched: new Date().toISOString(),
        card_count: totalFetched,
        expected_count: 225,
        status: totalFetched >= 200 ? 'complete' : 'partial'
      };
      
      // Update sets info
      existingData.sets = existingData.sets || {};
      existingData.sets['004'] = {
        name: setName,
        code: '004',
        cards_count: totalFetched,
        fetched_at: new Date().toISOString()
      };
      
      // Save immediately
      existingData.metadata.last_updated = new Date().toISOString();
      existingData.metadata.total_cards = Object.keys(existingData.cards).length;
      
      fs.writeFileSync('./data/JUSTTCG.json', JSON.stringify(existingData, null, 2));
      console.log(`   💾 Saved Set 4: ${totalFetched} cards, total: ${existingData.metadata.total_cards} cards`);
      
      break; // Success, no need to try other variations
    }
  }
}

// Now check if we can find the missing high-value cards with correct numbering
async function searchHighValueCards() {
  console.log('\n🎯 Searching for high-value cards with enhanced numbering\n');
  
  const searches = [
    { name: 'Bolt', set: 'Archazia\'s Island', expectedNumbers: ['223', '224'] },
    { name: 'Elsa', set: 'Archazia\'s Island', expectedNumbers: ['223', '224'] },
    { name: 'Genie', set: 'Fabled', expectedNumbers: ['229'] },
    { name: 'Mulan', set: 'Fabled', expectedNumbers: ['235'] }
  ];
  
  for (const search of searches) {
    console.log(`🔍 Searching for ${search.name} in ${search.set}:`);
    
    try {
      const url = `${BASE_URL}/cards?game=disney-lorcana&q=${encodeURIComponent(search.name)}&limit=20`;
      const response = await makeApiRequest(url);
      
      if (response.statusCode === 200) {
        const cards = response.data.data || [];
        const setCards = cards.filter(card => card.set.includes(search.set.replace("'", "")));
        
        setCards.forEach(card => {
          const numberMatch = card.number?.match(/^(\d+)/);
          const cardNum = numberMatch ? numberMatch[1] : 'N/A';
          
          if (search.expectedNumbers.includes(cardNum)) {
            console.log(`   ✅ FOUND: ${card.number}: ${card.name} (${card.rarity}) - MATCHES EXPECTED!`);
          } else {
            console.log(`   📋 ${card.number}: ${card.name} (${card.rarity})`);
          }
        });
        
        if (setCards.length === 0) {
          console.log(`   ❌ No ${search.name} cards found in ${search.set}`);
        }
      }
      
      await delay(DELAY_MS);
    } catch (error) {
      console.log(`   ❌ Error searching for ${search.name}: ${error.message}`);
    }
  }
}

async function runEnhancedFetch() {
  await refetchSet4();
  await searchHighValueCards();
  
  console.log('\n✅ Enhanced fetch complete');
}

// Run the enhanced fetch
runEnhancedFetch().catch(console.error);