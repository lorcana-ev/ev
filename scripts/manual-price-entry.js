#!/usr/bin/env node
// Manual price entry for cards missing from JustTCG
// Opens TCGPlayer links in browser and prompts for prices

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';

const MANUAL_PRICING_FILE = path.join(process.cwd(), 'data', 'MANUAL_TCGPLAYER.json');

function loadManualPricing() {
  try {
    if (fs.existsSync(MANUAL_PRICING_FILE)) {
      const data = fs.readFileSync(MANUAL_PRICING_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('⚠️  Error loading manual pricing:', error.message);
  }

  return {
    metadata: {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      note: 'Manual price entries for cards not available in JustTCG'
    },
    cards: {}
  };
}

function saveManualPricing(data) {
  data.metadata.last_updated = new Date().toISOString();
  fs.writeFileSync(MANUAL_PRICING_FILE, JSON.stringify(data, null, 2));
  console.log(`\n💾 Saved to ${MANUAL_PRICING_FILE}`);
}

function loadJustTcgData() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'JUSTTCG.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading JUSTTCG.json:', error.message);
    return null;
  }
}

function loadLorcastData() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'LORCAST.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading LORCAST.json:', error.message);
    return null;
  }
}

function loadDreambornData() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), 'data', 'USD.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading USD.json:', error.message);
    return null;
  }
}

function extractTcgPlayerIdFromLink(link) {
  if (!link) return null;
  const match = link.match(/product\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function getTcgPlayerLink(dreambornData, cardId) {
  const priceData = dreambornData[cardId];
  if (!priceData) return null;

  return priceData.foil?.TP?.link || priceData.base?.TP?.link || null;
}

function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = 'open';
  } else if (platform === 'win32') {
    command = 'start';
  } else {
    // Linux
    command = 'xdg-open';
  }

  try {
    spawn(command, [url], { detached: true, stdio: 'ignore' });
  } catch (error) {
    console.error(`⚠️  Could not open browser automatically: ${error.message}`);
    console.log(`   Please open manually: ${url}`);
  }
}

function promptUser(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function promptForPrice(rl, label) {
  while (true) {
    const input = await promptUser(rl, `   ${label} price (or press Enter to skip): $`);

    if (input === '') {
      return null;
    }

    const price = parseFloat(input);
    if (!isNaN(price) && price >= 0) {
      return price;
    }

    console.log('   ⚠️  Invalid price. Please enter a number (e.g., 199.99) or press Enter to skip.');
  }
}

async function manualPriceEntry() {
  console.log('🔧 Manual Price Entry for Missing Cards\n');

  const manualData = loadManualPricing();
  const justTcgData = loadJustTcgData();
  const lorcastData = loadLorcastData();
  const dreambornData = loadDreambornData();

  if (!justTcgData || !lorcastData || !dreambornData) {
    console.error('❌ Cannot proceed without all data sources');
    return;
  }

  // Build TCGPlayer ID mapping
  const tcgPlayerToCardId = {};
  for (const [cardId, cardData] of Object.entries(lorcastData.cards)) {
    const tcgPlayerId = cardData.raw_data?.tcgplayer_id;
    if (tcgPlayerId) {
      tcgPlayerToCardId[tcgPlayerId] = cardId;
    }
  }

  // Find cards missing from JustTCG
  const missingCards = [];

  // Core sets only (skip promos)
  const CORE_SETS = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'];

  for (const [cardId, cardData] of Object.entries(lorcastData.cards)) {
    // Skip promo sets - only process core sets
    const setCode = cardId.split('-')[0];
    if (!CORE_SETS.includes(setCode)) {
      continue;
    }

    // Skip if JustTCG already has this card with pricing
    if (justTcgData.cards[cardId] &&
        justTcgData.cards[cardId].variants &&
        Object.keys(justTcgData.cards[cardId].variants).length > 0) {
      continue;
    }

    // Check if card has a TCGPlayer ID
    const tcgPlayerId = cardData.raw_data?.tcgplayer_id;

    if (tcgPlayerId) {
      // Check if we already have manual pricing
      const hasManualPricing = manualData.cards[cardId] &&
        (manualData.cards[cardId].base_price || manualData.cards[cardId].foil_price);

      if (!hasManualPricing) {
        // Try to get link from Dreamborn, or construct it from TCGPlayer ID
        let tcgPlayerLink = null;

        // First try to find link in Dreamborn data
        for (const [dreambornId, priceData] of Object.entries(dreambornData)) {
          const linkProductId = extractTcgPlayerIdFromLink(
            priceData.foil?.TP?.link || priceData.base?.TP?.link
          );
          const directProductId = priceData.foil?.TP?.productId || priceData.base?.TP?.productId;

          if (linkProductId === tcgPlayerId || directProductId === tcgPlayerId) {
            tcgPlayerLink = priceData.foil?.TP?.link || priceData.base?.TP?.link;
            break;
          }
        }

        // If no link from Dreamborn, construct direct TCGPlayer URL
        if (!tcgPlayerLink) {
          tcgPlayerLink = `https://www.tcgplayer.com/product/${tcgPlayerId}`;
        }

        missingCards.push({
          cardId,
          name: cardData.name,
          title: cardData.title,
          number: cardData.number,
          rarity: cardData.rarity,
          setName: cardData.set_name,
          tcgPlayerId,
          tcgPlayerLink
        });
      }
    }
  }

  // Sort by set and card number
  missingCards.sort((a, b) => {
    const aNum = a.cardId.split('-')[1];
    const bNum = b.cardId.split('-')[1];
    return a.cardId.localeCompare(b.cardId);
  });

  console.log(`📊 Found ${missingCards.length} cards missing from JustTCG with TCGPlayer links`);

  if (missingCards.length === 0) {
    console.log('\n✅ No cards need manual pricing!');
    return;
  }

  console.log(`   Already have manual pricing for ${Object.keys(manualData.cards).length} cards\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let pricesAdded = 0;
  let pricesSkipped = 0;

  console.log('📝 Instructions:');
  console.log('   - Browser will open to TCGPlayer page');
  console.log('   - Enter prices for Near Mint Base and Foil');
  console.log('   - Press Enter to skip a price');
  console.log('   - Type "quit" to exit\n');

  for (let i = 0; i < missingCards.length; i++) {
    const card = missingCards[i];

    console.log(`\n[${ i + 1}/${missingCards.length}] ${card.cardId}: ${card.name}${card.title ? ' - ' + card.title : ''}`);
    console.log(`   Set: ${card.setName}`);
    console.log(`   Number: ${card.number}`);
    console.log(`   Rarity: ${card.rarity}`);
    console.log(`   TCGPlayer ID: ${card.tcgPlayerId}`);

    const action = await promptUser(rl, '\n   Press Enter to open TCGPlayer, or type "skip"/"quit": ');

    if (action.toLowerCase() === 'quit' || action.toLowerCase() === 'q') {
      console.log('\n👋 Exiting...');
      break;
    }

    if (action.toLowerCase() === 'skip' || action.toLowerCase() === 's') {
      console.log('   ⏭️  Skipped');
      pricesSkipped++;
      continue;
    }

    // Open browser
    openBrowser(card.tcgPlayerLink);
    console.log('   🌐 Opening browser...');

    // Prompt for prices
    const basePrice = await promptForPrice(rl, 'Base (Normal)');
    const foilPrice = await promptForPrice(rl, 'Foil (Holofoil)');

    if (basePrice === null && foilPrice === null) {
      console.log('   ⏭️  No prices entered, skipping');
      pricesSkipped++;
      continue;
    }

    // Save the pricing
    manualData.cards[card.cardId] = {
      base_price: basePrice,
      foil_price: foilPrice,
      source: 'manual_tcgplayer',
      reliability: 'high',
      last_updated: new Date().toISOString(),
      tcgplayer_id: card.tcgPlayerId,
      card_name: `${card.name}${card.title ? ' - ' + card.title : ''}`,
      set_name: card.setName,
      rarity: card.rarity
    };

    console.log(`   ✅ Saved: Base $${basePrice || 'N/A'}, Foil $${foilPrice || 'N/A'}`);
    pricesAdded++;

    // Auto-save every 5 entries
    if (pricesAdded % 5 === 0) {
      saveManualPricing(manualData);
    }
  }

  rl.close();

  // Final save
  if (pricesAdded > 0) {
    saveManualPricing(manualData);
  }

  console.log('\n📊 Summary:');
  console.log(`   Prices added: ${pricesAdded}`);
  console.log(`   Skipped: ${pricesSkipped}`);
  console.log(`   Total manual prices: ${Object.keys(manualData.cards).length}`);
}

// Run the script
manualPriceEntry().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
