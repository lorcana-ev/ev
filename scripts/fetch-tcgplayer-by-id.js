#!/usr/bin/env node
// TCGPlayer Direct API Integration
// Uses product IDs discovered from JustTCG to fetch pricing from TCGPlayer

import https from 'https';
import fs from 'fs';
import path from 'path';

// Note: TCGPlayer requires API authentication that we don't have set up yet
// This script shows how to structure the calls and extract the product IDs

const TCGPLAYER_PRICING_FILE = path.join(process.cwd(), 'data', 'TCGPLAYER.json');
const DELAY_MS = 1000; // 1 second between requests

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadTcgPlayerData() {
  try {
    const data = fs.readFileSync(TCGPLAYER_PRICING_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('❌ Error loading TCGPLAYER.json:', error.message);
    return null;
  }
}

function extractProductIds() {
  console.log('🔍 Extracting TCGPlayer product IDs from discovered data...\n');
  
  const tcgPlayerData = loadTcgPlayerData();
  if (!tcgPlayerData) {
    return [];
  }
  
  const productIds = [];
  
  // Get product IDs from JustTCG discoveries
  if (tcgPlayerData.product_ids) {
    for (const [cardId, productInfo] of Object.entries(tcgPlayerData.product_ids)) {
      if (productInfo.tcgplayerId) {
        productIds.push({
          cardId: cardId,
          productId: productInfo.tcgplayerId,
          cardName: productInfo.cardName,
          discoveredVia: productInfo.discovered_via,
          discoveredAt: productInfo.discovered_at
        });
      }
    }
  }
  
  // Get product IDs from manual entries
  if (tcgPlayerData.manual_data) {
    for (const [cardId, cardData] of Object.entries(tcgPlayerData.manual_data)) {
      const productId = cardData.base?.TP?.productId || cardData.foil?.TP?.productId;
      if (productId) {
        productIds.push({
          cardId: cardId,
          productId: productId,
          cardName: `Manual entry for ${cardId}`,
          discoveredVia: 'manual_entry',
          discoveredAt: cardData.added_at
        });
      }
    }
  }
  
  // Remove duplicates by product ID
  const uniqueProductIds = productIds.filter((item, index, arr) => 
    arr.findIndex(other => other.productId === item.productId) === index
  );
  
  console.log(`📊 Found ${uniqueProductIds.length} unique TCGPlayer product IDs:`);
  uniqueProductIds.forEach((item, i) => {
    console.log(`   ${i+1}. ${item.cardId}: ${item.cardName} (Product ID: ${item.productId})`);
  });
  
  return uniqueProductIds;
}

// Mock TCGPlayer API structure (would need real authentication)
function mockTcgPlayerApiCall(productId) {
  // This is what a real TCGPlayer API call would look like:
  /*
  const url = `https://api.tcgplayer.com/v1.39.0/pricing/product/${productId}`;
  const headers = {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json'
  };
  */
  
  console.log(`🔗 Would call TCGPlayer API: https://api.tcgplayer.com/pricing/product/${productId}`);
  
  // Return mock structure showing what we'd expect
  return {
    success: false,
    reason: 'No TCGPlayer API credentials configured',
    expectedResponse: {
      results: [{
        productId: productId,
        lowPrice: 5.00,
        midPrice: 8.50,
        highPrice: 12.00,
        marketPrice: 7.75,
        directLowPrice: 6.00,
        subTypeName: "Normal" // or "Foil"
      }]
    }
  };
}

function createTcgPlayerApiScript() {
  const productIds = extractProductIds();
  
  if (productIds.length === 0) {
    console.log('\n⚠️  No TCGPlayer product IDs found to process');
    return;
  }
  
  console.log('\n📝 TCGPlayer API Integration Setup:\n');
  
  console.log('1️⃣ **Get TCGPlayer API Access:**');
  console.log('   - Sign up at: https://docs.tcgplayer.com/docs');
  console.log('   - Get API credentials (Client ID, Client Secret)');
  console.log('   - Generate access token via OAuth2\n');
  
  console.log('2️⃣ **API Endpoints we can use:**');
  console.log('   - Product pricing: GET /v1.39.0/pricing/product/{productId}');
  console.log('   - Bulk pricing: POST /v1.39.0/pricing/product (up to 250 IDs)');
  console.log('   - Product details: GET /v1.39.0/catalog/products/{productId}\n');
  
  console.log('3️⃣ **Available Product IDs ready for API calls:**');
  productIds.slice(0, 10).forEach((item, i) => {
    console.log(`   ${i+1}. Product ${item.productId}: ${item.cardName}`);
  });
  if (productIds.length > 10) {
    console.log(`   ... and ${productIds.length - 10} more product IDs\n`);
  }
  
  console.log('4️⃣ **Bulk API Call Example:**');
  console.log('```javascript');
  console.log('const productIds = [' + productIds.slice(0, 5).map(p => p.productId).join(', ') + '];');
  console.log('const response = await fetch("https://api.tcgplayer.com/v1.39.0/pricing/product", {');
  console.log('  method: "POST",');
  console.log('  headers: {');
  console.log('    "Authorization": "Bearer YOUR_ACCESS_TOKEN",');
  console.log('    "Content-Type": "application/json"');
  console.log('  },');
  console.log('  body: JSON.stringify(productIds)');
  console.log('});');
  console.log('```\n');
  
  console.log('5️⃣ **Expected Benefits:**');
  console.log('   - Real-time TCGPlayer pricing (not scraped)');
  console.log('   - Bulk fetching (up to 250 products per call)');
  console.log('   - Multiple price points (low/mid/high/market)');
  console.log('   - Foil vs Normal variant pricing');
  console.log('   - Rate limits: 300 requests/minute\n');
  
  // Save product IDs for easy access
  const outputFile = path.join(process.cwd(), 'tcgplayer-product-ids.json');
  const output = {
    metadata: {
      extracted_at: new Date().toISOString(),
      total_product_ids: productIds.length,
      ready_for_api: true
    },
    product_ids: productIds,
    api_setup_instructions: {
      documentation: 'https://docs.tcgplayer.com/docs',
      authentication: 'OAuth2 with Client ID/Secret',
      bulk_endpoint: 'POST /v1.39.0/pricing/product',
      rate_limit: '300 requests/minute',
      max_ids_per_request: 250
    }
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`💾 Saved ${productIds.length} product IDs to tcgplayer-product-ids.json`);
  
  return productIds;
}

// Alternative: Web scraping approach using the TCGPlayer URLs we already have
function createScrapingApproach() {
  console.log('\n🕷️  **Alternative: Web Scraping Approach**\n');
  
  const productIds = extractProductIds();
  
  console.log('Since we already have TCGPlayer product IDs, we can scrape the product pages:');
  console.log('```javascript');
  console.log('// Example URLs we can scrape:');
  productIds.slice(0, 3).forEach(item => {
    const url = `https://www.tcgplayer.com/product/${item.productId}`;
    console.log(`// ${item.cardName}: ${url}`);
  });
  console.log('```\n');
  
  console.log('✅ **Advantages:**');
  console.log('   - No API authentication needed');
  console.log('   - Uses product IDs we already discovered');
  console.log('   - Can extract current market prices\n');
  
  console.log('⚠️  **Disadvantages:**');
  console.log('   - Slower than API calls');
  console.log('   - Need to handle anti-bot measures');
  console.log('   - More fragile (HTML structure changes)\n');
}

// Export for use by other scripts
export { extractProductIds, createTcgPlayerApiScript };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTcgPlayerApiScript();
  createScrapingApproach();
}