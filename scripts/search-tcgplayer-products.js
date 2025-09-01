#!/usr/bin/env node
// Automated TCGPlayer Product ID Discovery Script
// Searches TCGPlayer for Set 9 cards and extracts product IDs

import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Rate limiting configuration
const DELAY_MS = 2000; // 2 seconds between requests to be respectful
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000; // 10 second timeout

// User agent to appear as a regular browser
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeHttpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      },
      timeout: TIMEOUT_MS
    };

    const req = https.request(url, requestOptions, (res) => {
      let responseData = [];
      
      res.on('data', chunk => {
        responseData.push(chunk);
      });
      
      res.on('end', () => {
        let buffer = Buffer.concat(responseData);
        
        // Handle gzip/deflate decompression
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          zlib.gunzip(buffer, (err, decompressed) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: decompressed.toString()
              });
            }
          });
        } else if (encoding === 'deflate') {
          zlib.inflate(buffer, (err, decompressed) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body: decompressed.toString()
              });
            }
          });
        } else {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: buffer.toString()
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function buildSearchUrl(cardName, cardTitle) {
  // Build TCGPlayer search URL for Lorcana cards
  const searchTerm = cardTitle ? `${cardName} ${cardTitle}` : cardName;
  const encodedSearch = encodeURIComponent(`${searchTerm} lorcana`);
  return `https://www.tcgplayer.com/search/lorcana/product?q=${encodedSearch}&view=grid`;
}

function extractProductIds(html, cardName, cardTitle) {
  const productIds = [];
  
  try {
    // Debug: Check if we got actual HTML content
    if (html.length < 1000 || !html.includes('tcgplayer')) {
      console.log(`   🐛 Debug: Received ${html.length} chars, doesn't look like TCGPlayer HTML`);
      if (html.length < 500) {
        console.log(`   🐛 Sample response: ${html.slice(0, 200)}...`);
      }
    }
    
    // Look for product URLs in the HTML - multiple patterns
    const patterns = [
      /\/product\/(\d+)\/[^"'\s]*/g,
      /\/product\/(\d+)/g,
      /product-id[^>]*?(\d{6,})/gi,
      /data-product-id["']?\s*[:=]\s*["']?(\d+)["']?/gi,
      /productId["']?\s*[:=]\s*["']?(\d+)["']?/gi,
      /"productId":(\d+)/gi,
      /product_id[^>]*?(\d{6,})/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const productId = parseInt(match[1]);
        if (!isNaN(productId) && productId > 100000) { // TCGPlayer product IDs are typically 6+ digits
          productIds.push(productId);
        }
      }
    }
    
    // Also search for known patterns in TCGPlayer structure
    if (html.includes('lorcana')) {
      const lorcanaMatches = html.match(/lorcana[^>]*?(\d{6,})/gi);
      if (lorcanaMatches) {
        lorcanaMatches.forEach(match => {
          const numbers = match.match(/(\d{6,})/g);
          if (numbers) {
            numbers.forEach(num => {
              const productId = parseInt(num);
              if (!isNaN(productId)) productIds.push(productId);
            });
          }
        });
      }
    }
    
    // Remove duplicates and sort
    const uniqueIds = [...new Set(productIds)].sort((a, b) => a - b);
    
    if (uniqueIds.length > 0) {
      console.log(`   🐛 Debug: Found potential product IDs: ${uniqueIds.join(', ')}`);
    }
    
    return uniqueIds;
  } catch (error) {
    console.error(`Error extracting product IDs for ${cardName}:`, error.message);
    return [];
  }
}

async function searchCard(card, retryCount = 0) {
  const searchUrl = buildSearchUrl(card.name, card.title);
  console.log(`🔍 Searching for ${card.name} - ${card.title} (${card.id})...`);
  console.log(`   URL: ${searchUrl}`);
  
  try {
    const response = await makeHttpsRequest(searchUrl);
    
    if (response.statusCode !== 200) {
      console.log(`   ⚠️  Got status ${response.statusCode}, retrying...`);
      if (retryCount < MAX_RETRIES) {
        await delay(DELAY_MS * 2); // Double delay on retry
        return searchCard(card, retryCount + 1);
      }
      return { card, productIds: [], error: `HTTP ${response.statusCode}` };
    }
    
    const productIds = extractProductIds(response.body, card.name, card.title);
    
    if (productIds.length > 0) {
      console.log(`   ✅ Found ${productIds.length} product ID(s): ${productIds.join(', ')}`);
      return { card, productIds, html: response.body.slice(0, 1000) }; // Keep first 1KB for debugging
    } else {
      console.log(`   ❌ No product IDs found`);
      
      // Save a sample HTML file for the first failed search to debug
      if (!fs.existsSync('debug_sample.html')) {
        fs.writeFileSync('debug_sample.html', response.body);
        console.log(`   🐛 Debug: Saved sample HTML to debug_sample.html (${response.body.length} chars)`);
      }
      
      return { card, productIds: [], error: 'No product IDs found' };
    }
    
  } catch (error) {
    console.error(`   ❌ Error searching ${card.id}: ${error.message}`);
    if (retryCount < MAX_RETRIES && error.message !== 'Request timeout') {
      await delay(DELAY_MS * 2);
      return searchCard(card, retryCount + 1);
    }
    return { card, productIds: [], error: error.message };
  }
}

async function searchAllSet9Cards() {
  console.log('🚀 Starting automated TCGPlayer search for Set 9 cards...\n');
  
  // Load Set 9 cards
  const cardsPath = path.join(process.cwd(), 'data', 'cards-formatted.json');
  let cardsData;
  
  try {
    cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  } catch (error) {
    console.error('❌ Error loading cards data:', error.message);
    return;
  }
  
  const set9Cards = cardsData.filter(card => card.setId === '009');
  console.log(`📋 Found ${set9Cards.length} Set 9 cards to search\n`);
  
  // Load existing price data to skip cards we already have
  const usdPath = path.join(process.cwd(), 'data', 'USD.json');
  let existingPriceData = {};
  
  try {
    existingPriceData = JSON.parse(fs.readFileSync(usdPath, 'utf8'));
  } catch (error) {
    console.log('📄 No existing price data found');
  }
  
  const cardsNeedingPricing = set9Cards.filter(card => !existingPriceData[card.id]);
  console.log(`🎯 ${cardsNeedingPricing.length} cards need pricing data\n`);
  
  // Start with enchanted and legendary cards (highest value)
  const priorityCards = cardsNeedingPricing
    .filter(card => card.rarity === 'enchanted' || card.rarity === 'legendary')
    .slice(0, 3); // Start with just 3 cards for testing
  
  console.log(`🌟 Starting with ${priorityCards.length} high-priority cards\n`);
  
  const results = [];
  const discoveries = [];
  
  for (let i = 0; i < priorityCards.length; i++) {
    const card = priorityCards[i];
    const result = await searchCard(card);
    results.push(result);
    
    if (result.productIds.length > 0) {
      // Add successful discoveries to our collection
      result.productIds.forEach(productId => {
        discoveries.push({
          cardId: card.id,
          name: card.name,
          title: card.title,
          productId: productId,
          rarity: card.rarity
        });
      });
    }
    
    // Rate limiting - be respectful to TCGPlayer
    if (i < priorityCards.length - 1) {
      console.log(`   ⏳ Waiting ${DELAY_MS}ms before next search...\n`);
      await delay(DELAY_MS);
    }
  }
  
  // Summary
  console.log('\n📊 Search Results Summary:');
  console.log(`   Cards searched: ${results.length}`);
  console.log(`   Product IDs found: ${discoveries.length}`);
  console.log(`   Success rate: ${Math.round((discoveries.length / results.length) * 100)}%\n`);
  
  if (discoveries.length > 0) {
    console.log('🎉 Discovered Product IDs:');
    discoveries.forEach(discovery => {
      console.log(`   ${discovery.cardId}: ${discovery.name} - ${discovery.title} → ${discovery.productId}`);
    });
    
    // Save discoveries to a file for manual review
    const discoveryPath = path.join(process.cwd(), 'discoveries.json');
    fs.writeFileSync(discoveryPath, JSON.stringify(discoveries, null, 2));
    console.log(`\n💾 Discoveries saved to ${discoveryPath}`);
    
    // Generate code for fetch-set9-prices.js
    console.log('\n🔧 Code to add to fetch-set9-prices.js:');
    console.log('```javascript');
    discoveries.forEach(discovery => {
      console.log(`  { id: "${discovery.cardId}", name: "${discovery.name}", title: "${discovery.title}", productId: ${discovery.productId}, rarity: "${discovery.rarity}" },`);
    });
    console.log('```');
  }
  
  console.log('\n✨ Automated search complete!');
  
  return { results, discoveries };
}

// Export for use by other scripts
export { searchCard, searchAllSet9Cards };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  searchAllSet9Cards().catch(console.error);
}