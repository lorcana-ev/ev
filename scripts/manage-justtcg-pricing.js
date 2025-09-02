#!/usr/bin/env node
// JustTCG Pricing Management System
// Efficiently manages API requests with timestamps and priority updates

import https from 'https';
import fs from 'fs';
import path from 'path';

const JUSTTCG_API_KEY = 'tcg_d9656d9c265142939d9cd9edcceb5915';
const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';
const DELAY_MS = 1500; // 1.5 seconds between requests to be conservative
const MAX_REQUESTS_PER_RUN = 10; // Limit requests per execution

// Data file paths
const JUSTTCG_PRICING_FILE = path.join(process.cwd(), 'data', 'JUSTTCG.json');
const CARDS_FILE = path.join(process.cwd(), 'data', 'cards-formatted.json');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeApiRequest(url) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function loadJustTcgPricing() {
  try {
    const data = fs.readFileSync(JUSTTCG_PRICING_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('📄 Creating new JUSTTCG.json file...');
    return {
      metadata: {
        created_at: new Date().toISOString(),
        last_updated: null,
        total_cards: 0,
        api_requests_made: 0
      },
      cards: {}
    };
  }
}

function saveJustTcgPricing(pricingData) {
  pricingData.metadata.last_updated = new Date().toISOString();
  pricingData.metadata.total_cards = Object.keys(pricingData.cards).length;
  
  fs.writeFileSync(JUSTTCG_PRICING_FILE, JSON.stringify(pricingData, null, 2));
  console.log(`💾 Saved pricing data for ${pricingData.metadata.total_cards} cards`);
}

function loadCards() {
  try {
    const data = fs.readFileSync(CARDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading cards-formatted.json:', error.message);
    return [];
  }
}

function convertJustTcgToStandardFormat(justTcgCard) {
  if (!justTcgCard || !justTcgCard.variants || justTcgCard.variants.length === 0) {
    return null;
  }
  
  const result = {
    name: justTcgCard.name,
    set: justTcgCard.set,
    tcgplayerId: justTcgCard.tcgplayerId,
    fetched_at: new Date().toISOString(),
    variants: {}
  };
  
  // Process all variants
  for (const variant of justTcgCard.variants) {
    const key = `${variant.condition || 'Near Mint'}_${variant.printing || 'Normal'}`.replace(/\s+/g, '_');
    
    result.variants[key] = {
      condition: variant.condition || 'Near Mint',
      printing: variant.printing || 'Normal',
      price: variant.price || 0,
      priceChange7d: variant.priceChange7d || 0,
      priceChange30d: variant.priceChange30d || 0,
      lastUpdated: variant.lastUpdated ? new Date(variant.lastUpdated * 1000).toISOString() : null
    };
  }
  
  return result;
}

function findMatchingCardId(justTcgCard, allCards) {
  const set9Cards = allCards.filter(card => card.setId === '009');
  
  // Parse JustTCG card name to extract character and title
  let character, title;
  
  // Remove suffixes like (Enchanted), (Iconic), etc.
  const cleanName = justTcgCard.name.replace(/\s*\([^)]*\)\s*$/, '');
  
  if (cleanName.includes(' - ')) {
    [character, title] = cleanName.split(' - ').map(s => s.trim());
  } else {
    character = cleanName.trim();
    title = null;
  }
  
  // Find matches
  const matches = set9Cards.filter(ourCard => {
    const nameMatch = ourCard.name.toLowerCase() === character.toLowerCase();
    const titleMatch = !title || (ourCard.title && ourCard.title.toLowerCase() === title.toLowerCase());
    return nameMatch && titleMatch;
  });
  
  if (matches.length === 1) {
    return matches[0].id;
  } else if (matches.length > 1) {
    // If multiple matches, prefer by rarity hierarchy or take the first
    const rarityOrder = { 'enchanted': 0, 'legendary': 1, 'super rare': 2, 'rare': 3, 'uncommon': 4, 'common': 5 };
    const sortedMatches = matches.sort((a, b) => {
      const aRarity = rarityOrder[a.rarity?.toLowerCase()] || 999;
      const bRarity = rarityOrder[b.rarity?.toLowerCase()] || 999;
      return aRarity - bRarity;
    });
    return sortedMatches[0].id;
  }
  
  return null;
}

function prioritizeCardsForUpdate(pricingData, allCards) {
  const set9Cards = allCards.filter(card => card.setId === '009');
  const priorities = [];
  
  for (const card of set9Cards) {
    const existingData = pricingData.cards[card.id];
    
    if (!existingData) {
      // Missing data - highest priority
      priorities.push({
        cardId: card.id,
        cardName: `${card.name} - ${card.title}`,
        priority: 1,
        reason: 'missing_data',
        lastFetched: null
      });
    } else {
      // Existing data - prioritize by age
      const fetchedAt = new Date(existingData.fetched_at);
      const ageInDays = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 7) {
        priorities.push({
          cardId: card.id,
          cardName: `${card.name} - ${card.title}`,
          priority: 2,
          reason: 'outdated_data',
          lastFetched: existingData.fetched_at,
          ageInDays: Math.round(ageInDays)
        });
      }
    }
  }
  
  // Sort by priority (1 = highest), then by age for outdated data
  priorities.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.ageInDays && b.ageInDays) return b.ageInDays - a.ageInDays;
    return 0;
  });
  
  return priorities;
}

async function fetchCardFromJustTcg(cardName, cardTitle) {
  const searchTerms = [
    cardTitle ? `${cardName} ${cardTitle}` : cardName,
    cardName
  ].filter(Boolean);
  
  for (const searchTerm of searchTerms) {
    try {
      const encodedTerm = encodeURIComponent(searchTerm);
      const url = `${JUSTTCG_BASE_URL}/cards?game=disney-lorcana&q=${encodedTerm}&limit=10`;
      
      console.log(`   🔍 Searching: "${searchTerm}"`);
      const response = await makeApiRequest(url);
      
      if (response.statusCode === 200 && response.data.data && response.data.data.length > 0) {
        // Find Fabled set card
        const fabledCard = response.data.data.find(card => card.set === 'Fabled');
        if (fabledCard) {
          console.log(`   ✅ Found Set 9 card: ${fabledCard.name}`);
          return fabledCard;
        } else {
          console.log(`   ⚠️  Found ${response.data.data.length} result(s), but none from Fabled set`);
        }
      } else {
        console.log(`   ❌ No results for "${searchTerm}"`);
      }
    } catch (error) {
      console.log(`   ❌ Error searching "${searchTerm}": ${error.message}`);
    }
    
    // Small delay between search variations
    await delay(200);
  }
  
  return null;
}

async function updatePriorityCards(maxRequests = MAX_REQUESTS_PER_RUN) {
  console.log('🔄 Starting JustTCG pricing update...\n');
  
  // Load data
  const pricingData = loadJustTcgPricing();
  const allCards = loadCards();
  
  if (allCards.length === 0) {
    console.error('❌ No cards data available');
    return;
  }
  
  // Get priority list
  const priorities = prioritizeCardsForUpdate(pricingData, allCards);
  console.log(`📋 Priority Update Queue:`);
  console.log(`   Missing data: ${priorities.filter(p => p.priority === 1).length} cards`);
  console.log(`   Outdated data: ${priorities.filter(p => p.priority === 2).length} cards`);
  console.log(`   Max requests this run: ${maxRequests}\n`);
  
  if (priorities.length === 0) {
    console.log('✅ All Set 9 cards have recent pricing data!');
    return;
  }
  
  // Process top priority cards
  const cardsToUpdate = priorities.slice(0, maxRequests);
  let requestsMade = 0;
  let successfulUpdates = 0;
  
  for (const item of cardsToUpdate) {
    if (requestsMade >= maxRequests) {
      console.log(`⏰ Reached maximum requests limit (${maxRequests})`);
      break;
    }
    
    console.log(`\n🎯 Processing ${item.cardName} (${item.reason})`);
    if (item.lastFetched) {
      console.log(`   Last fetched: ${item.lastFetched} (${item.ageInDays} days ago)`);
    }
    
    // Find card details
    const card = allCards.find(c => c.id === item.cardId);
    if (!card) {
      console.log('   ❌ Card not found in database');
      continue;
    }
    
    // Fetch from JustTCG
    const justTcgCard = await fetchCardFromJustTcg(card.name, card.title);
    requestsMade++;
    
    if (justTcgCard) {
      // Convert to our format and store
      const pricingInfo = convertJustTcgToStandardFormat(justTcgCard);
      if (pricingInfo) {
        pricingData.cards[item.cardId] = pricingInfo;
        successfulUpdates++;
        
        // Show sample pricing
        const variants = Object.values(pricingInfo.variants);
        const bestPrice = variants.find(v => v.condition === 'Near Mint') || variants[0];
        if (bestPrice) {
          console.log(`   💰 Best price: $${bestPrice.price} (${bestPrice.condition} ${bestPrice.printing})`);
        }
        console.log(`   📊 Total variants: ${variants.length}`);
      }
    } else {
      console.log('   ❌ No pricing data found');
    }
    
    // Rate limiting
    if (requestsMade < maxRequests) {
      console.log(`   ⏳ Waiting ${DELAY_MS}ms...`);
      await delay(DELAY_MS);
    }
  }
  
  // Update metadata and save
  pricingData.metadata.api_requests_made += requestsMade;
  saveJustTcgPricing(pricingData);
  
  // Summary
  console.log('\n📊 Update Summary:');
  console.log(`   API requests made: ${requestsMade}/${maxRequests}`);
  console.log(`   Successful updates: ${successfulUpdates}`);
  console.log(`   Total cards with pricing: ${Object.keys(pricingData.cards).length}/242`);
  console.log(`   Remaining in queue: ${Math.max(0, priorities.length - maxRequests)}`);
  
  const coverage = (Object.keys(pricingData.cards).length / 242 * 100).toFixed(1);
  console.log(`   Set 9 coverage: ${coverage}%`);
  
  return pricingData;
}

// Function to show current status
function showStatus() {
  console.log('📊 JustTCG Pricing Status\n');
  
  const pricingData = loadJustTcgPricing();
  const allCards = loadCards();
  const priorities = prioritizeCardsForUpdate(pricingData, allCards);
  
  console.log(`📈 Coverage: ${Object.keys(pricingData.cards).length}/242 Set 9 cards (${(Object.keys(pricingData.cards).length/242*100).toFixed(1)}%)`);
  console.log(`🔄 API requests made: ${pricingData.metadata.api_requests_made || 0}`);
  console.log(`⏰ Last updated: ${pricingData.metadata.last_updated || 'Never'}`);
  
  if (priorities.length > 0) {
    console.log(`\n🎯 Next Update Priorities:`);
    priorities.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i+1}. ${item.cardName} (${item.reason})`);
    });
    
    if (priorities.length > 5) {
      console.log(`   ... and ${priorities.length - 5} more cards`);
    }
  } else {
    console.log('\n✅ All Set 9 cards have recent pricing data!');
  }
}

// Export functions
export { updatePriorityCards, showStatus, loadJustTcgPricing };

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const maxRequests = parseInt(process.argv[3]) || MAX_REQUESTS_PER_RUN;
  
  if (command === 'status') {
    showStatus();
  } else if (command === 'update') {
    updatePriorityCards(maxRequests).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node manage-justtcg-pricing.js status');
    console.log('  node manage-justtcg-pricing.js update [max_requests]');
    console.log('');
    console.log('Examples:');
    console.log('  node manage-justtcg-pricing.js status');
    console.log('  node manage-justtcg-pricing.js update 5');
  }
}