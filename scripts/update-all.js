#!/usr/bin/env node
// Update all pricing data from JustTCG, Lorcast, and Dreamborn

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

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 ALL UPDATES COMPLETE!');
    console.log(`⏱️  Total time: ${elapsed}s`);
    console.log('═'.repeat(60));
    console.log('\n📊 Updated data sources:');
    console.log('   ✓ JustTCG pricing (data/JUSTTCG_ALL_SETS.json)');
    console.log('   ✓ Lorcast card data (data/LORCAST.json)');
    console.log('   ✓ Dreamborn pricing (data/USD.json)');
    console.log('\n💡 Next steps:');
    console.log('   • Rebuild unified pricing if needed');
    console.log('   • Verify data integrity');
    console.log('   • Start the website\n');

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
