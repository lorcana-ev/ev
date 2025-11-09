#!/usr/bin/env node
// Manual price entry specifically for Set 10 (Whispers in the Well)
// Shows ALL Set 10 cards for manual verification, even if automated pricing exists

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

async function promptForPrice(rl, label, currentPrice) {
  const priceDisplay = currentPrice ? `$${currentPrice}` : 'N/A';

  while (true) {
    const input = await promptUser(rl, `   ${label} price [current: ${priceDisplay}] (Enter to keep, or new price): $`);

    if (input === '') {
      return currentPrice; // Keep current price
    }

    const price = parseFloat(input);
    if (!isNaN(price) && price >= 0) {
      return price;
    }

    console.log('   ⚠️  Invalid price. Please enter a number (e.g., 199.99) or press Enter to keep current.');
  }
}

async function manualPriceEntrySet10() {
  console.log('🔧 Manual Price Entry for Set 10 (Whispers in the Well)\n');
  console.log('📝 This tool allows you to manually verify and update pricing for Enchanted and Legendary cards.\n');

  const manualData = loadManualPricing();
  const justTcgData = loadJustTcgData();
  const lorcastData = loadLorcastData();
  const dreambornData = loadDreambornData();

  if (!lorcastData) {
    console.error('❌ Cannot proceed without Lorcast data');
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

  // Get all Set 10 cards
  const set10Cards = [];

  for (const [cardId, cardData] of Object.entries(lorcastData.cards)) {
    if (!cardId.startsWith('010-')) continue;

    // Only show Enchanted and Legendary cards
    const rarity = cardData.rarity?.toLowerCase();
    if (rarity !== 'enchanted' && rarity !== 'legendary' && rarity !== 'iconic') {
      continue;
    }

    const tcgPlayerId = cardData.raw_data?.tcgplayer_id;
    if (!tcgPlayerId) continue;

    // Get current prices from various sources
    let justTcgBasePrice = null;
    let justTcgFoilPrice = null;
    let dreambornBasePrice = null;
    let dreambornFoilPrice = null;
    let manualBasePrice = null;
    let manualFoilPrice = null;

    // JustTCG prices
    if (justTcgData?.cards[cardId]?.variants) {
      const variants = justTcgData.cards[cardId].variants;
      const nearMintNormal = variants['Near_Mint_Normal'];
      const nearMintFoil = variants['Near_Mint_Holofoil'];

      if (nearMintNormal?.price > 0) justTcgBasePrice = nearMintNormal.price;
      if (nearMintFoil?.price > 0) justTcgFoilPrice = nearMintFoil.price;
    }

    // Dreamborn prices
    if (dreambornData) {
      const dreambornPrice = dreambornData[cardId];
      if (dreambornPrice) {
        if (dreambornPrice.base?.TP?.price > 0) dreambornBasePrice = dreambornPrice.base.TP.price;
        if (dreambornPrice.foil?.TP?.price > 0) dreambornFoilPrice = dreambornPrice.foil.TP.price;
      }
    }

    // Manual prices
    if (manualData.cards[cardId]) {
      manualBasePrice = manualData.cards[cardId].base_price;
      manualFoilPrice = manualData.cards[cardId].foil_price;
    }

    // Get or construct TCGPlayer link
    let tcgPlayerLink = null;

    if (dreambornData) {
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
    }

    if (!tcgPlayerLink) {
      tcgPlayerLink = `https://www.tcgplayer.com/product/${tcgPlayerId}`;
    }

    set10Cards.push({
      cardId,
      name: cardData.name,
      title: cardData.title,
      number: cardData.number,
      rarity: cardData.rarity,
      tcgPlayerId,
      tcgPlayerLink,
      justTcgBasePrice,
      justTcgFoilPrice,
      dreambornBasePrice,
      dreambornFoilPrice,
      manualBasePrice,
      manualFoilPrice
    });
  }

  // Sort by card number
  set10Cards.sort((a, b) => {
    const aNum = parseInt(a.cardId.split('-')[1]);
    const bNum = parseInt(b.cardId.split('-')[1]);
    return aNum - bNum;
  });

  console.log(`📊 Found ${set10Cards.length} Set 10 cards with TCGPlayer IDs`);

  const withManualPricing = set10Cards.filter(c => c.manualBasePrice || c.manualFoilPrice).length;
  const withJustTcg = set10Cards.filter(c => c.justTcgBasePrice || c.justTcgFoilPrice).length;
  const withDreamborn = set10Cards.filter(c => c.dreambornBasePrice || c.dreambornFoilPrice).length;

  console.log(`   Manual pricing: ${withManualPricing} cards`);
  console.log(`   JustTCG pricing: ${withJustTcg} cards`);
  console.log(`   Dreamborn pricing: ${withDreamborn} cards\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let pricesAdded = 0;
  let pricesUpdated = 0;
  let pricesSkipped = 0;

  console.log('📝 Instructions:');
  console.log('   - Browser will open to TCGPlayer page');
  console.log('   - Current automated prices are shown');
  console.log('   - Enter new price to update, or press Enter to keep current');
  console.log('   - Type "quit" to exit\n');

  for (let i = 0; i < set10Cards.length; i++) {
    const card = set10Cards[i];

    console.log(`\n[${i + 1}/${set10Cards.length}] ${card.cardId}: ${card.name}${card.title ? ' - ' + card.title : ''}`);
    console.log(`   Number: ${card.number}`);
    console.log(`   Rarity: ${card.rarity}`);
    console.log(`   TCGPlayer ID: ${card.tcgPlayerId}`);

    // Show current prices from all sources
    console.log('\n   Current Pricing:');
    const showPrice = (label, base, foil) => {
      if (base || foil) {
        console.log(`   ${label}:`);
        if (base) console.log(`      Base: $${base}`);
        if (foil) console.log(`      Foil: $${foil}`);
      }
    };

    showPrice('Manual (YOU)', card.manualBasePrice, card.manualFoilPrice);
    showPrice('JustTCG', card.justTcgBasePrice, card.justTcgFoilPrice);
    showPrice('Dreamborn', card.dreambornBasePrice, card.dreambornFoilPrice);

    const action = await promptUser(rl, '\n   Press Enter to open TCGPlayer, "skip" to skip, or "quit": ');

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

    // Use manual price if exists, otherwise use best automated price
    const currentBase = card.manualBasePrice ?? card.justTcgBasePrice ?? card.dreambornBasePrice;
    const currentFoil = card.manualFoilPrice ?? card.justTcgFoilPrice ?? card.dreambornFoilPrice;

    // Prompt for prices
    const newBasePrice = await promptForPrice(rl, 'Base (Normal)', currentBase);
    const newFoilPrice = await promptForPrice(rl, 'Foil (Holofoil)', currentFoil);

    // Check if anything changed
    const baseChanged = newBasePrice !== card.manualBasePrice;
    const foilChanged = newFoilPrice !== card.manualFoilPrice;

    if (!baseChanged && !foilChanged) {
      console.log('   ⏭️  No changes');
      pricesSkipped++;
      continue;
    }

    // Save the pricing
    const wasNew = !manualData.cards[card.cardId];

    manualData.cards[card.cardId] = {
      base_price: newBasePrice,
      foil_price: newFoilPrice,
      source: 'manual_tcgplayer',
      reliability: 'high',
      last_updated: new Date().toISOString(),
      tcgplayer_id: card.tcgPlayerId,
      card_name: `${card.name}${card.title ? ' - ' + card.title : ''}`,
      set_name: card.rarity,
      rarity: card.rarity
    };

    console.log(`   ✅ ${wasNew ? 'Added' : 'Updated'}: Base $${newBasePrice || 'N/A'}, Foil $${newFoilPrice || 'N/A'}`);

    if (wasNew) {
      pricesAdded++;
    } else {
      pricesUpdated++;
    }

    // Auto-save every 5 entries
    if ((pricesAdded + pricesUpdated) % 5 === 0) {
      saveManualPricing(manualData);
    }
  }

  rl.close();

  // Final save
  if (pricesAdded > 0 || pricesUpdated > 0) {
    saveManualPricing(manualData);
  }

  console.log('\n📊 Summary:');
  console.log(`   New prices added: ${pricesAdded}`);
  console.log(`   Prices updated: ${pricesUpdated}`);
  console.log(`   Skipped: ${pricesSkipped}`);
  console.log(`   Total manual prices: ${Object.keys(manualData.cards).length}`);
}

// Run the script
manualPriceEntrySet10().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
