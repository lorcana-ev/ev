#!/usr/bin/env node
// Search for missing JustTCG cards using their card search API

import https from 'https';
import zlib from 'zlib';
import fs from 'fs';

const API_KEY = 'tcg_0ecc60ebe3854a369313b16a95737637';
const BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1000; // 1 second between requests

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

function generateSearchQueries(card) {
  const queries = [];
  
  // Try exact name match
  queries.push(card.name);
  
  // Try with subtitle variations for character cards
  if (card.name.includes(' - ')) {
    const [mainName] = card.name.split(' - ');
    queries.push(mainName);
  }
  
  // Try name + set for disambiguation
  const setNames = {
    '001': 'First Chapter',
    '002': 'Rise of the Floodborn',
    '003': 'Into the Inklands', 
    '004': 'Ursula\'s Return',
    '005': 'Shimmering Skies',
    '006': 'Azurite Sea',
    '007': 'Archazia\'s Island',
    '008': 'Reign of Jafar',
    '009': 'Fabled'
  };
  
  if (setNames[card.setCode]) {
    queries.push(`${card.name} ${setNames[card.setCode]}`);
  }
  
  return [...new Set(queries)]; // Remove duplicates
}

async function searchMissingCards() {
  console.log('🔍 Searching for Missing JustTCG Cards\n');
  
  // Load missing cards data
  const missingData = JSON.parse(fs.readFileSync('./data/FILTERED_MISSING_CARDS.json', 'utf8'));
  const allMissingCards = missingData.filteredMissing.justtcg;
  
  // Filter out dalmatian puppies (we don't need to search for these)
  const missingJustTcgCards = allMissingCards.filter(card => 
    !card.id.match(/003-004[a-e]/) // Exclude dalmatian puppy variants
  );
  
  console.log(`Found ${missingJustTcgCards.length} cards missing from JustTCG\n`);
  
  const searchResults = [];
  let foundCards = 0;
  let totalSearches = 0;
  
  for (const [index, card] of missingJustTcgCards.entries()) {
    console.log(`\n[${index + 1}/${missingJustTcgCards.length}] Searching for: ${card.id} - ${card.name} (${card.rarity})`);
    
    const queries = generateSearchQueries(card);
    let cardFound = false;
    const cardResults = [];
    
    for (const query of queries) {
      if (cardFound) break; // Skip additional queries if already found
      
      try {
        console.log(`   Query: "${query}"`);
        
        // Search with game filter and exact query
        const searchUrl = `${BASE_URL}/cards?game=disney-lorcana&q=${encodeURIComponent(query)}&limit=20`;
        const response = await makeApiRequest(searchUrl);
        totalSearches++;
        
        if (response.statusCode === 200) {
          const cards = response.data.data || [];
          console.log(`     Found ${cards.length} results`);
          
          // Look for exact matches
          const exactMatches = cards.filter(apiCard => {
            // Check for name match (case insensitive)
            const nameMatch = apiCard.name.toLowerCase() === card.name.toLowerCase();
            
            // Check for set match if we can determine it
            let setMatch = true;
            if (apiCard.set_id) {
              // Try to match set based on our card's set code
              const expectedSetPatterns = {
                '001': ['first', 'chapter', 'TFC'],
                '002': ['rise', 'floodborn', 'ROTF'],
                '003': ['inklands', 'ITI'],
                '004': ['ursula', 'return', 'UR'],
                '005': ['shimmering', 'skies', 'SS'],
                '006': ['azurite', 'sea', 'AS'],
                '007': ['archazia', 'island', 'AI'],
                '008': ['reign', 'jafar', 'ROJ'],
                '009': ['fabled', 'FAB']
              };
              
              const patterns = expectedSetPatterns[card.setCode] || [];
              const apiSetName = apiCard.set_id.toLowerCase();
              setMatch = patterns.some(pattern => apiSetName.includes(pattern.toLowerCase()));
            }
            
            // Check card number if available
            let numberMatch = true;
            if (apiCard.number) {
              const expectedNumber = card.cardNumber.replace('f', ''); // Remove foil indicator
              numberMatch = apiCard.number === expectedNumber || apiCard.number === card.cardNumber;
            }
            
            return nameMatch && setMatch && numberMatch;
          });
          
          if (exactMatches.length > 0) {
            console.log(`     ✅ Found exact match!`);
            exactMatches.forEach(match => {
              console.log(`        ${match.set_id} - ${match.number}: ${match.name} (${match.rarity})`);
              if (match.variants && Object.keys(match.variants).length > 0) {
                const variantInfo = Object.entries(match.variants).slice(0, 3).map(([variant, data]) => 
                  `${variant}: $${data.price || 'N/A'}`
                ).join(', ');
                console.log(`        Variants: ${variantInfo}`);
              }
            });
            
            cardResults.push({
              card: card,
              query: query,
              matches: exactMatches,
              searchResults: cards
            });
            
            foundCards++;
            cardFound = true;
          } else if (cards.length > 0) {
            // Show partial matches for reference
            console.log(`     Partial matches found:`);
            cards.slice(0, 3).forEach(match => {
              console.log(`        ${match.set_id || 'Unknown'} - ${match.number || 'N/A'}: ${match.name}`);
            });
          } else {
            console.log(`     No results`);
          }
        } else {
          console.log(`     API error: ${response.statusCode}`);
        }
        
        await delay(DELAY_MS);
        
      } catch (error) {
        console.log(`     Error: ${error.message}`);
      }
    }
    
    if (cardResults.length > 0) {
      searchResults.push(...cardResults);
    }
  }
  
  // Summary
  console.log(`\n📊 Search Summary:`);
  console.log(`   Cards searched: ${missingJustTcgCards.length}`);
  console.log(`   API queries made: ${totalSearches}`);
  console.log(`   Cards found: ${foundCards}`);
  console.log(`   Success rate: ${((foundCards / missingJustTcgCards.length) * 100).toFixed(1)}%`);
  
  // High-value cards found
  const highValueFound = searchResults.filter(result => 
    ['legendary', 'enchanted', 'super_rare', 'super rare'].includes(result.card.rarity.toLowerCase())
  );
  
  if (highValueFound.length > 0) {
    console.log(`\n⭐ High-Value Cards Found (${highValueFound.length}):`);
    highValueFound.forEach(result => {
      console.log(`   ${result.card.id}: ${result.card.name} (${result.card.rarity})`);
      result.matches.forEach(match => {
        console.log(`     Found as: ${match.set_id} - ${match.number}: ${match.name}`);
      });
    });
  }
  
  // Save detailed results
  const resultsData = {
    searchDate: new Date().toISOString(),
    totalSearched: missingJustTcgCards.length,
    totalFound: foundCards,
    successRate: ((foundCards / missingJustTcgCards.length) * 100).toFixed(1) + '%',
    searchResults: searchResults,
    missingCards: missingJustTcgCards.filter(card => 
      !searchResults.some(result => result.card.id === card.id)
    )
  };
  
  fs.writeFileSync('./data/JUSTTCG_MISSING_CARDS_SEARCH.json', JSON.stringify(resultsData, null, 2));
  console.log(`\n💾 Detailed search results saved to JUSTTCG_MISSING_CARDS_SEARCH.json`);
  
  return resultsData;
}

// Run the search
searchMissingCards().catch(console.error);