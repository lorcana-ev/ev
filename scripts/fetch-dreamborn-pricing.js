#!/usr/bin/env node
// Fetch latest USD.json pricing from Dreamborn API

import https from 'https';
import fs from 'fs';
import path from 'path';

const DREAMBORN_URL = 'https://dreamborn.ink/cache/prices/USD.json';
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'USD.json');
const BACKUP_FILE = path.join(process.cwd(), 'data', 'USD.json.backup');

function fetchDreambornPricing() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Fetching latest pricing from Dreamborn...');
    console.log(`   URL: ${DREAMBORN_URL}`);
    
    https.get(DREAMBORN_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      let data = '';
      let totalBytes = 0;
      const contentLength = parseInt(res.headers['content-length'] || '0');
      
      res.on('data', (chunk) => {
        data += chunk;
        totalBytes += chunk.length;
        if (contentLength > 0) {
          const percent = ((totalBytes / contentLength) * 100).toFixed(1);
          process.stdout.write(`\r   Downloaded: ${totalBytes.toLocaleString()} bytes (${percent}%)`);
        }
      });
      
      res.on('end', () => {
        console.log('\n✅ Download complete');
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🚀 Fetching Dreamborn pricing data...\n');
  
  try {
    // Fetch the data
    const pricingData = await fetchDreambornPricing();
    
    // Analyze the data
    const cardCount = Object.keys(pricingData).length;
    let baseCount = 0;
    let foilCount = 0;
    
    for (const [cardId, variants] of Object.entries(pricingData)) {
      if (variants.base?.TP?.price) baseCount++;
      if (variants.foil?.TP?.price) foilCount++;
    }
    
    console.log('\n📊 Pricing Data Summary:');
    console.log(`   Total cards: ${cardCount}`);
    console.log(`   Cards with base pricing: ${baseCount}`);
    console.log(`   Cards with foil pricing: ${foilCount}`);
    console.log(`   Coverage: ${((baseCount / cardCount) * 100).toFixed(1)}% base, ${((foilCount / cardCount) * 100).toFixed(1)}% foil`);
    
    // Backup existing file if it exists
    if (fs.existsSync(OUTPUT_FILE)) {
      console.log(`\n💾 Backing up existing USD.json to USD.json.backup...`);
      fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    }
    
    // Save the new data
    console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pricingData, null, 2));
    
    const fileSize = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1);
    console.log(`✅ Saved ${fileSize} KB`);
    
    // Suggest next steps
    console.log('\n🔄 Next steps:');
    console.log('   1. Rebuild unified pricing: node scripts/rebuild-unified-pricing.js');
    console.log('   2. Verify data: npm run verify');
    console.log('   3. Start website: npm run dev');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fetchDreambornPricing };
