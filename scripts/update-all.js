#!/usr/bin/env node
/**
 * Lorcana EV - Complete Data Update Pipeline
 *
 * This script runs the complete data update process:
 * 1. Fetches JustTCG pricing data (API)
 * 2. Fetches Lorcast card metadata (API)
 * 3. Fetches Dreamborn pricing + card database (CDN)
 * 4. Rebuilds unified pricing (weighted average of sources)
 * 5. Extracts box/case pricing from JustTCG
 * 6. Calculates realistic EV using pack model
 *
 * Duration: ~2-3 minutes
 *
 * Output Files:
 * - data/JUSTTCG.json (JustTCG pricing)
 * - data/LORCAST.json (Lorcast metadata)
 * - data/USD.json (Dreamborn pricing)
 * - data/cards.json (Dreamborn cards)
 * - data/cards-formatted.json (alias)
 * - data/UNIFIED_PRICING.json (combined pricing)
 * - data/BOX_PRICING.json (boxes/cases with EV)
 *
 * See docs/DATA_UPDATE_PIPELINE.md for details
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
      path.join(__dirname, 'fetch-all-justtcg-sets.js'),
      'JustTCG Pricing Update'
    );

    // 2. Fetch Lorcast data
    await runScript(
      path.join(__dirname, 'fetch-lorcast-data.js'),
      'Lorcast Card Data Update'
    );

    // 3. Fetch Dreamborn pricing
    await runScript(
      path.join(__dirname, 'fetch-dreamborn-pricing.js'),
      'Dreamborn Pricing Update'
    );

    // 4. Rebuild unified pricing from all sources
    await runScript(
      path.join(__dirname, 'rebuild-unified-pricing.js'),
      'Rebuild Unified Pricing'
    );

    // 5. Extract box/case pricing from JustTCG
    await runScript(
      path.join(__dirname, 'extract-box-pricing.js'),
      'Extract Box Pricing'
    );

    // 6. Calculate realistic EV for sealed products
    await runScript(
      path.join(__dirname, 'calculate-realistic-ev.js'),
      'Calculate Realistic EV'
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
    console.log('   ✓ Unified pricing (data/UNIFIED_PRICING.json)');
    console.log('   ✓ Box pricing with EV (data/BOX_PRICING.json)');
    console.log('\n💡 Optional:');
    console.log('   • Run scripts/compare-pricing-sources.js to check discrepancies');
    console.log('   • Start the website to view results');
    console.log('\n📖 Documentation:');
    console.log('   • See docs/DATA_UPDATE_PIPELINE.md for details\n');

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
