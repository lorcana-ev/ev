#!/usr/bin/env node
// Pricing Source Restructuring Script
// Separates different pricing sources and creates unified pricing system

import fs from 'fs';
import path from 'path';

// File paths for different pricing sources
const ORIGINAL_USD_FILE = path.join(process.cwd(), 'data', 'USD.json');
const DREAMBORN_PRICING_FILE = path.join(process.cwd(), 'data', 'DREAMBORN.json');
const TCGPLAYER_PRICING_FILE = path.join(process.cwd(), 'data', 'TCGPLAYER.json');
const JUSTTCG_PRICING_FILE = path.join(process.cwd(), 'data', 'JUSTTCG.json');
const UNIFIED_PRICING_FILE = path.join(process.cwd(), 'data', 'UNIFIED_PRICING.json');

function loadExistingData() {
  let originalUsd = {};
  let justTcgData = {};
  
  try {
    originalUsd = JSON.parse(fs.readFileSync(ORIGINAL_USD_FILE, 'utf8'));
    console.log(`📊 Loaded ${Object.keys(originalUsd).length} cards from original USD.json`);
  } catch (error) {
    console.log('⚠️  No original USD.json found');
  }
  
  try {
    const justTcgFile = JSON.parse(fs.readFileSync(JUSTTCG_PRICING_FILE, 'utf8'));
    justTcgData = justTcgFile;
    console.log(`📊 Loaded ${Object.keys(justTcgData.cards || {}).length} cards from JUSTTCG.json`);
  } catch (error) {
    console.log('⚠️  No JUSTTCG.json found');
  }
  
  return { originalUsd, justTcgData };
}

function identifyPricingSources(originalUsd) {
  // Analyze the original USD.json to separate Dreamborn vs manual TCGPlayer data
  const dreamborn = {};
  const tcgplayer = {};
  
  // Cards we manually added for Set 9 (these are TCGPlayer)
  const manualTcgPlayerCards = [
    '009-001', '009-004', '009-224', '009-228', '009-233', '009-238'
  ];
  
  for (const [cardId, pricingData] of Object.entries(originalUsd)) {
    if (manualTcgPlayerCards.includes(cardId)) {
      // This is manual TCGPlayer data
      tcgplayer[cardId] = {
        ...pricingData,
        source: 'manual_tcgplayer',
        added_at: '2025-09-01T00:00:00.000Z' // Approximate timestamp
      };
    } else {
      // This is likely Dreamborn data
      dreamborn[cardId] = {
        ...pricingData,
        source: 'dreamborn',
        source_file: 'original_usd_json'
      };
    }
  }
  
  return { dreamborn, tcgplayer };
}

function createTcgPlayerPricingStructure(justTcgData) {
  // Extract TCGPlayer product IDs from JustTCG data for future TCGPlayer API calls
  const tcgplayerProductIds = {};
  
  if (justTcgData.cards) {
    for (const [cardId, cardData] of Object.entries(justTcgData.cards)) {
      if (cardData.tcgplayerId) {
        tcgplayerProductIds[cardId] = {
          cardId: cardId,
          tcgplayerId: cardData.tcgplayerId,
          cardName: cardData.name,
          discovered_via: 'justtcg_api',
          discovered_at: cardData.fetched_at,
          pricing: null, // To be populated by TCGPlayer API calls
          last_updated: null
        };
      }
    }
  }
  
  return tcgplayerProductIds;
}

function createUnifiedPricingStructure(dreamborn, tcgplayer, justTcg) {
  const unified = {
    metadata: {
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      sources: {
        dreamborn: Object.keys(dreamborn).length,
        tcgplayer_manual: Object.keys(tcgplayer).length,
        justtcg_api: Object.keys(justTcg.cards || {}).length,
        tcgplayer_api: 0 // To be populated later
      },
      version: '1.0.0'
    },
    cards: {}
  };
  
  // Collect all unique card IDs
  const allCardIds = new Set([
    ...Object.keys(dreamborn),
    ...Object.keys(tcgplayer),
    ...Object.keys(justTcg.cards || {})
  ]);
  
  for (const cardId of allCardIds) {
    unified.cards[cardId] = {
      cardId: cardId,
      sources: {},
      unified_pricing: {
        base: null,
        foil: null,
        confidence: 'low', // low/medium/high based on source agreement
        last_calculated: new Date().toISOString()
      }
    };
    
    // Add Dreamborn data
    if (dreamborn[cardId]) {
      unified.cards[cardId].sources.dreamborn = {
        base_price: dreamborn[cardId].base?.TP?.price || null,
        foil_price: dreamborn[cardId].foil?.TP?.price || null,
        source: 'dreamborn_original',
        reliability: 'medium'
      };
    }
    
    // Add manual TCGPlayer data
    if (tcgplayer[cardId]) {
      unified.cards[cardId].sources.tcgplayer_manual = {
        base_price: tcgplayer[cardId].base?.TP?.price || null,
        foil_price: tcgplayer[cardId].foil?.TP?.price || null,
        source: 'manual_tcgplayer',
        productId: tcgplayer[cardId].base?.TP?.productId || tcgplayer[cardId].foil?.TP?.productId,
        reliability: 'high'
      };
    }
    
    // Add JustTCG data
    if (justTcg.cards && justTcg.cards[cardId]) {
      const jtCard = justTcg.cards[cardId];
      
      // Extract best base and foil prices from variants
      let basePrice = null, foilPrice = null;
      
      if (jtCard.variants) {
        // Look for Near Mint Normal for base price
        const baseVariant = Object.values(jtCard.variants).find(v => 
          v.condition === 'Near Mint' && (v.printing === 'Normal' || !v.printing.toLowerCase().includes('foil'))
        ) || Object.values(jtCard.variants)[0];
        
        if (baseVariant) basePrice = baseVariant.price;
        
        // Look for Near Mint Foil for foil price
        const foilVariant = Object.values(jtCard.variants).find(v => 
          v.condition === 'Near Mint' && v.printing && v.printing.toLowerCase().includes('foil')
        );
        
        if (foilVariant) foilPrice = foilVariant.price;
      }
      
      unified.cards[cardId].sources.justtcg = {
        base_price: basePrice,
        foil_price: foilPrice,
        source: 'justtcg_api',
        tcgplayerId: jtCard.tcgplayerId,
        variant_count: Object.keys(jtCard.variants || {}).length,
        fetched_at: jtCard.fetched_at,
        reliability: 'high'
      };
    }
  }
  
  return unified;
}

function calculateUnifiedPricing(unifiedData) {
  for (const [cardId, cardData] of Object.entries(unifiedData.cards)) {
    const sources = cardData.sources;
    const basePrices = [];
    const foilPrices = [];
    const sourceReliability = [];
    
    // Collect prices from all sources
    Object.entries(sources).forEach(([sourceName, sourceData]) => {
      if (sourceData.base_price && sourceData.base_price > 0) {
        basePrices.push({
          price: sourceData.base_price,
          source: sourceName,
          reliability: sourceData.reliability || 'medium'
        });
      }
      
      if (sourceData.foil_price && sourceData.foil_price > 0) {
        foilPrices.push({
          price: sourceData.foil_price,
          source: sourceName,
          reliability: sourceData.reliability || 'medium'
        });
      }
      
      sourceReliability.push(sourceData.reliability || 'medium');
    });
    
    // Calculate unified base price
    if (basePrices.length > 0) {
      if (basePrices.length === 1) {
        cardData.unified_pricing.base = basePrices[0].price;
        cardData.unified_pricing.base_method = 'single_source';
        cardData.unified_pricing.base_sources = [basePrices[0].source];
      } else {
        // Multiple sources - use weighted average favoring high reliability
        let weightedSum = 0;
        let totalWeight = 0;
        
        basePrices.forEach(priceData => {
          const weight = priceData.reliability === 'high' ? 2.0 : 
                        priceData.reliability === 'medium' ? 1.0 : 0.5;
          weightedSum += priceData.price * weight;
          totalWeight += weight;
        });
        
        cardData.unified_pricing.base = Math.round((weightedSum / totalWeight) * 100) / 100;
        cardData.unified_pricing.base_method = 'weighted_average';
        cardData.unified_pricing.base_sources = basePrices.map(p => p.source);
      }
    }
    
    // Calculate unified foil price
    if (foilPrices.length > 0) {
      if (foilPrices.length === 1) {
        cardData.unified_pricing.foil = foilPrices[0].price;
        cardData.unified_pricing.foil_method = 'single_source';
        cardData.unified_pricing.foil_sources = [foilPrices[0].source];
      } else {
        // Multiple sources - use weighted average
        let weightedSum = 0;
        let totalWeight = 0;
        
        foilPrices.forEach(priceData => {
          const weight = priceData.reliability === 'high' ? 2.0 : 
                        priceData.reliability === 'medium' ? 1.0 : 0.5;
          weightedSum += priceData.price * weight;
          totalWeight += weight;
        });
        
        cardData.unified_pricing.foil = Math.round((weightedSum / totalWeight) * 100) / 100;
        cardData.unified_pricing.foil_method = 'weighted_average';
        cardData.unified_pricing.foil_sources = foilPrices.map(p => p.source);
      }
    }
    
    // Set confidence level
    const sourceCount = Object.keys(sources).length;
    const hasHighReliability = sourceReliability.includes('high');
    
    if (sourceCount >= 2 && hasHighReliability) {
      cardData.unified_pricing.confidence = 'high';
    } else if (sourceCount >= 2 || hasHighReliability) {
      cardData.unified_pricing.confidence = 'medium';
    } else {
      cardData.unified_pricing.confidence = 'low';
    }
  }
  
  return unifiedData;
}

async function restructurePricingSources() {
  console.log('🔄 Restructuring pricing sources...\n');
  
  // Load existing data
  const { originalUsd, justTcgData } = loadExistingData();
  
  // Separate Dreamborn vs manual TCGPlayer data
  console.log('📊 Analyzing original USD.json sources...');
  const { dreamborn, tcgplayer } = identifyPricingSources(originalUsd);
  console.log(`   Dreamborn data: ${Object.keys(dreamborn).length} cards`);
  console.log(`   Manual TCGPlayer: ${Object.keys(tcgplayer).length} cards`);
  
  // Create TCGPlayer structure with product IDs from JustTCG
  console.log('\n📊 Creating TCGPlayer product ID mapping...');
  const tcgplayerProductIds = createTcgPlayerPricingStructure(justTcgData);
  console.log(`   TCGPlayer product IDs discovered: ${Object.keys(tcgplayerProductIds).length}`);
  
  // Create unified pricing structure
  console.log('\n📊 Creating unified pricing structure...');
  let unifiedData = createUnifiedPricingStructure(dreamborn, tcgplayer, justTcgData);
  
  // Calculate unified pricing
  console.log('📊 Calculating unified pricing...');
  unifiedData = calculateUnifiedPricing(unifiedData);
  
  // Save separated files
  console.log('\n💾 Saving restructured pricing files...');
  
  const dreamborPricingFile = {
    metadata: {
      source: 'dreamborn.ink',
      extracted_from: 'original_USD.json',
      created_at: new Date().toISOString(),
      card_count: Object.keys(dreamborn).length
    },
    cards: dreamborn
  };
  fs.writeFileSync(DREAMBORN_PRICING_FILE, JSON.stringify(dreamborPricingFile, null, 2));
  console.log(`✅ Saved DREAMBORN.json (${Object.keys(dreamborn).length} cards)`);
  
  const tcgplayerPricingFile = {
    metadata: {
      created_at: new Date().toISOString(),
      manual_entries: Object.keys(tcgplayer).length,
      product_ids_available: Object.keys(tcgplayerProductIds).length,
      next_update_strategy: 'use_product_ids_for_api_calls'
    },
    manual_data: tcgplayer,
    product_ids: tcgplayerProductIds,
    api_data: {} // To be populated by future TCGPlayer API calls
  };
  fs.writeFileSync(TCGPLAYER_PRICING_FILE, JSON.stringify(tcgplayerPricingFile, null, 2));
  console.log(`✅ Saved TCGPLAYER.json (${Object.keys(tcgplayer).length} manual + ${Object.keys(tcgplayerProductIds).length} product IDs)`);
  
  fs.writeFileSync(UNIFIED_PRICING_FILE, JSON.stringify(unifiedData, null, 2));
  console.log(`✅ Saved UNIFIED_PRICING.json (${Object.keys(unifiedData.cards).length} cards)`);
  
  // Summary
  console.log('\n📊 Restructuring Summary:');
  console.log(`   Total unique cards: ${Object.keys(unifiedData.cards).length}`);
  console.log(`   Dreamborn source: ${unifiedData.metadata.sources.dreamborn} cards`);
  console.log(`   Manual TCGPlayer: ${unifiedData.metadata.sources.tcgplayer_manual} cards`);
  console.log(`   JustTCG source: ${unifiedData.metadata.sources.justtcg_api} cards`);
  
  // Confidence breakdown
  const confidenceLevels = { high: 0, medium: 0, low: 0 };
  Object.values(unifiedData.cards).forEach(card => {
    confidenceLevels[card.unified_pricing.confidence]++;
  });
  console.log(`   Confidence: ${confidenceLevels.high} high, ${confidenceLevels.medium} medium, ${confidenceLevels.low} low`);
  
  // Multi-source cards
  const multiSourceCards = Object.values(unifiedData.cards).filter(card => 
    Object.keys(card.sources).length > 1
  ).length;
  console.log(`   Multi-source validation: ${multiSourceCards} cards`);
  
  return unifiedData;
}

// Export for use by other scripts
export { restructurePricingSources };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  restructurePricingSources().catch(console.error);
}