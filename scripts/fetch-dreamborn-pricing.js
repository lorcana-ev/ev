#!/usr/bin/env node
// Fetch latest USD.json pricing and cards.json from Dreamborn API

import https from 'https';
import fs from 'fs';
import path from 'path';

const DREAMBORN_PRICING_URL = 'https://dreamborn.ink/cache/prices/USD.json';
const DREAMBORN_CARDS_URL = 'https://dreamborn.ink/cache/en/cards.json';
const PRICING_OUTPUT_FILE = path.join(process.cwd(), 'data', 'USD.json');
const CARDS_OUTPUT_FILE = path.join(process.cwd(), 'data', 'cards.json');
const PRICING_BACKUP_FILE = path.join(process.cwd(), 'data', 'USD.json.backup');
const CARDS_BACKUP_FILE = path.join(process.cwd(), 'data', 'cards.json.backup');

function fetchFromUrl(url, description) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Fetching ${description} from Dreamborn...`);
    console.log(`   URL: ${url}`);

    https.get(url, (res) => {
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
  console.log('🚀 Fetching Dreamborn data...\n');

  try {
    // Fetch pricing data
    const pricingData = await fetchFromUrl(DREAMBORN_PRICING_URL, 'pricing data');

    // Analyze pricing data
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

    // Backup and save pricing data
    if (fs.existsSync(PRICING_OUTPUT_FILE)) {
      console.log(`\n💾 Backing up existing USD.json...`);
      fs.copyFileSync(PRICING_OUTPUT_FILE, PRICING_BACKUP_FILE);
    }

    console.log(`💾 Saving pricing to ${PRICING_OUTPUT_FILE}...`);
    fs.writeFileSync(PRICING_OUTPUT_FILE, JSON.stringify(pricingData, null, 2));

    const pricingSize = (fs.statSync(PRICING_OUTPUT_FILE).size / 1024).toFixed(1);
    console.log(`✅ Saved ${pricingSize} KB`);

    // Fetch cards data
    console.log('\n');
    const cardsData = await fetchFromUrl(DREAMBORN_CARDS_URL, 'cards data');

    // Analyze cards data
    const totalCards = Array.isArray(cardsData) ? cardsData.length : 0;
    const sets = Array.isArray(cardsData) ? [...new Set(cardsData.map(c => c.setId))].sort() : [];

    console.log('\n📊 Cards Data Summary:');
    console.log(`   Total cards: ${totalCards}`);
    console.log(`   Sets: ${sets.join(', ')}`);

    // Backup and save cards data
    if (fs.existsSync(CARDS_OUTPUT_FILE)) {
      console.log(`\n💾 Backing up existing cards.json...`);
      fs.copyFileSync(CARDS_OUTPUT_FILE, CARDS_BACKUP_FILE);
    }

    console.log(`💾 Saving cards to ${CARDS_OUTPUT_FILE}...`);
    fs.writeFileSync(CARDS_OUTPUT_FILE, JSON.stringify(cardsData, null, 2));

    const cardsSize = (fs.statSync(CARDS_OUTPUT_FILE).size / 1024).toFixed(1);
    console.log(`✅ Saved ${cardsSize} KB`);

    // Also create cards-formatted.json (alias for compatibility)
    const cardsFormattedFile = path.join(process.cwd(), 'data', 'cards-formatted.json');
    fs.writeFileSync(cardsFormattedFile, JSON.stringify(cardsData, null, 2));
    console.log(`✅ Also saved to cards-formatted.json for compatibility`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fetchFromUrl as fetchDreambornData };
