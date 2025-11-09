#!/usr/bin/env node
/**
 * Lorcana EV - Data Update Pipeline
 *
 * This script fetches all pricing and card data from external sources:
 * 1. JustTCG API - Real-time pricing with variants
 * 2. Lorcast API - Card metadata and TCGPlayer IDs
 * 3. Dreamborn CDN - TCGPlayer pricing + card database
 * 4. Authoritative Mapping - Card ID and finish mappings
 *
 * Duration: ~1-2 minutes
 *
 * Output Files:
 * - data/JUSTTCG.json (JustTCG pricing)
 * - data/LORCAST.json (Lorcast metadata with TCGPlayer IDs)
 * - data/USD.json (Dreamborn pricing)
 * - data/cards.json (Dreamborn cards)
 * - data/cards-formatted.json (alias)
 * - data/AUTHORITATIVE_CARD_ID_MAPPING.json (comprehensive mapping)
 * - data/CARD_ID_LOOKUP.json (simplified hash→canonical lookup)
 *
 * The web application uses these sources with priority:
 * Manual TCGPlayer → JustTCG → Dreamborn → Lorcast
 *
 * Note: Manual pricing (data/MANUAL_TCGPLAYER.json) is updated separately
 * using scripts/manual-price-entry.js or scripts/manual-price-entry-set10.js
 *
 * See docs/DATA_UPDATE_PIPELINE.md and docs/CARD_ID_MAPPING.md for details
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runScript(scriptPath, name) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Starting: ${name}`);
    console.log(`${'='.repeat(60)}\n`);

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${name} completed successfully\n`);
        resolve();
      } else {
        reject(new Error(`${name} failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`${name} failed to start: ${error.message}`));
    });
  });
}

async function updateAll() {
  const startTime = Date.now();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Lorcana EV - Update All Pricing Data              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // 1. Fetch JustTCG data
    await runScript(
      path.join(__dirname, 'fetch-core-sets-justtcg.js'),
      'JustTCG Pricing Update'
    );

    // 2. Fetch Lorcast data
    await runScript(
      path.join(__dirname, 'fetch-lorcast-data.js'),
      'Lorcast Card Data Update'
    );

    // 3. Fetch Dreamborn pricing + cards
    await runScript(
      path.join(__dirname, 'fetch-dreamborn-pricing.js'),
      'Dreamborn Data Update'
    );

    // 4. Rebuild authoritative card ID mapping
    await runScript(
      path.join(__dirname, 'create-authoritative-id-mapping.js'),
      'Rebuild Authoritative Card ID Mapping'
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 ALL UPDATES COMPLETE!');
    console.log(`⏱️  Total time: ${elapsed}s`);
    console.log('═'.repeat(60));
    console.log('\n📊 Updated data files:');
    console.log('   ✓ JustTCG pricing (data/JUSTTCG.json)');
    console.log('   ✓ Lorcast card data (data/LORCAST.json)');
    console.log('   ✓ Dreamborn pricing (data/USD.json)');
    console.log('   ✓ Dreamborn cards (data/cards.json, data/cards-formatted.json)');
    console.log('   ✓ Card ID mappings (data/AUTHORITATIVE_CARD_ID_MAPPING.json, data/CARD_ID_LOOKUP.json)');
    console.log('\n💡 Next steps:');
    console.log('   • Start the website to view updated prices');
    console.log('   • Update manual pricing: node scripts/manual-price-entry-set10.js');
    console.log('   • Run scripts/compare-pricing-sources.js to spot check prices');
    console.log('\n📖 Documentation:');
    console.log('   • See docs/MANUAL_PRICE_ENTRY.md for manual pricing workflow');
    console.log('   • See docs/CARD_ID_MAPPING.md for card ID mapping details\n');

  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateAll();
}

export { updateAll };
