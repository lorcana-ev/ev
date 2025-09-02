#!/usr/bin/env node
// Analyze pricing differences between data sources

import fs from 'fs';

function loadSources() {
  // Load Dreamborn
  const dreambornCards = JSON.parse(fs.readFileSync('./data/cards-formatted.json', 'utf8'))
    .reduce((acc, card) => { acc[card.id] = card; return acc; }, {});
  
  // Load Lorcast
  const lorcastData = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
  const lorcastCards = lorcastData.cards;
  
  // Load JustTCG
  const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  const justTcgCards = justTcgData.cards;
  
  return { dreambornCards, lorcastCards, justTcgCards };
}

function getPrice(card, variant = 'base', source = 'unknown') {
  if (!card) return null;
  
  if (source === 'dreamborn') {
    // Dreamborn doesn't have pricing data in the formatted cards
    return null;
  }
  
  if (source === 'lorcast') {
    // Lorcast has pricing in raw_data.prices.usd
    if (card.raw_data && card.raw_data.prices && card.raw_data.prices.usd) {
      const price = parseFloat(card.raw_data.prices.usd);
      return price < 999 ? price : null; // Filter out placeholder prices
    }
    return null;
  }
  
  if (source === 'justtcg') {
    // JustTCG has variants with different conditions/printings
    if (!card.variants) return null;
    
    if (variant === 'base') {
      // Look for Near Mint regular (non-foil) variants
      const baseVariants = Object.values(card.variants).filter(v => 
        v.condition === 'Near Mint' && 
        (!v.printing || v.printing === 'Regular' || v.printing === 'Normal')
      );
      if (baseVariants.length > 0) {
        return parseFloat(baseVariants[0].price);
      }
    } else if (variant === 'foil') {
      // Look for Near Mint foil variants (Holofoil or Cold Foil)
      const foilVariants = Object.values(card.variants).filter(v => 
        v.condition === 'Near Mint' && 
        (v.printing === 'Holofoil' || v.printing === 'Cold Foil')
      );
      if (foilVariants.length > 0) {
        return parseFloat(foilVariants[0].price);
      }
    }
    return null;
  }
  
  return null;
}

function analyzePricingDifferences() {
  console.log('💰 Analyzing Pricing Differences Between Sources\n');
  
  const sources = loadSources();
  const { dreambornCards, lorcastCards, justTcgCards } = sources;
  const coreSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  
  // Get all core cards that exist in at least 2 sources
  const coreCardIds = new Set();
  [dreambornCards, lorcastCards, justTcgCards].forEach(source => {
    Object.keys(source).forEach(cardId => {
      const setCode = cardId.split('-')[0];
      if (coreSets.includes(setCode)) {
        coreCardIds.add(cardId);
      }
    });
  });
  
  const pricingAnalysis = {
    base: [],
    foil: []
  };
  
  let cardsWithPricing = 0;
  let cardsAnalyzed = 0;
  
  Array.from(coreCardIds).forEach(cardId => {
    const dreamborn = dreambornCards[cardId];
    const lorcast = lorcastCards[cardId];
    const justtcg = justTcgCards[cardId];
    
    // Check if card exists in at least 2 sources
    const sourcesPresent = [dreamborn, lorcast, justtcg].filter(Boolean).length;
    if (sourcesPresent < 2) return;
    
    cardsAnalyzed++;
    
    // Analyze base variant pricing
    const basePrices = {
      dreamborn: getPrice(dreamborn, 'base', 'dreamborn'),
      lorcast: getPrice(lorcast, 'base', 'lorcast'),
      justtcg: getPrice(justtcg, 'base', 'justtcg')
    };
    
    const validBasePrices = Object.entries(basePrices).filter(([source, price]) => price !== null);
    
    if (validBasePrices.length >= 2) {
      cardsWithPricing++;
      const prices = validBasePrices.map(([source, price]) => price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = maxPrice - minPrice;
      const percentDiff = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
      
      pricingAnalysis.base.push({
        cardId,
        name: lorcast?.name || dreamborn?.name || justtcg?.name,
        rarity: lorcast?.rarity || dreamborn?.rarity || justtcg?.rarity,
        setCode: cardId.split('-')[0],
        prices: basePrices,
        validPrices: validBasePrices.length,
        minPrice,
        maxPrice,
        avgPrice,
        variance,
        percentDiff
      });
    }
    
    // Analyze foil variant pricing
    const foilPrices = {
      dreamborn: getPrice(dreamborn, 'foil', 'dreamborn'),
      lorcast: getPrice(lorcast, 'foil', 'lorcast'),
      justtcg: getPrice(justtcg, 'foil', 'justtcg')
    };
    
    const validFoilPrices = Object.entries(foilPrices).filter(([source, price]) => price !== null);
    
    if (validFoilPrices.length >= 2) {
      const prices = validFoilPrices.map(([source, price]) => price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = maxPrice - minPrice;
      const percentDiff = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
      
      pricingAnalysis.foil.push({
        cardId,
        name: lorcast?.name || dreamborn?.name || justtcg?.name,
        rarity: lorcast?.rarity || dreamborn?.rarity || justtcg?.rarity,
        setCode: cardId.split('-')[0],
        prices: foilPrices,
        validPrices: validFoilPrices.length,
        minPrice,
        maxPrice,
        avgPrice,
        variance,
        percentDiff
      });
    }
  });
  
  console.log('📊 Pricing Analysis Summary:');
  console.log(`   Cards analyzed: ${cardsAnalyzed}`);
  console.log(`   Cards with base pricing: ${pricingAnalysis.base.length}`);
  console.log(`   Cards with foil pricing: ${pricingAnalysis.foil.length}`);
  console.log(`   Overall pricing coverage: ${((cardsWithPricing / cardsAnalyzed) * 100).toFixed(1)}%\n`);
  
  // Analyze variance patterns
  function analyzeVariance(variantData, variantName) {
    if (variantData.length === 0) {
      console.log(`   No ${variantName} pricing data available\n`);
      return;
    }
    
    const sorted = [...variantData].sort((a, b) => b.variance - a.variance);
    const avgVariance = variantData.reduce((sum, card) => sum + card.variance, 0) / variantData.length;
    const avgPercentDiff = variantData.reduce((sum, card) => sum + card.percentDiff, 0) / variantData.length;
    
    console.log(`📈 ${variantName.charAt(0).toUpperCase() + variantName.slice(1)} Pricing Analysis:`);
    console.log(`   Average price variance: $${avgVariance.toFixed(2)}`);
    console.log(`   Average percent difference: ${avgPercentDiff.toFixed(1)}%`);
    console.log(`   Cards with >50% price difference: ${variantData.filter(c => c.percentDiff > 50).length}`);
    console.log(`   Cards with >$5 variance: ${variantData.filter(c => c.variance > 5).length}`);
    
    // Show highest variance cards
    console.log(`\n   Top 10 Highest Variance Cards (${variantName}):`);
    sorted.slice(0, 10).forEach((card, index) => {
      const priceString = Object.entries(card.prices)
        .filter(([source, price]) => price !== null)
        .map(([source, price]) => `${source}: $${price.toFixed(2)}`)
        .join(', ');
      
      console.log(`     ${index + 1}. ${card.cardId} - ${card.name} (${card.rarity})`);
      console.log(`        Variance: $${card.variance.toFixed(2)} (${card.percentDiff.toFixed(1)}%)`);
      console.log(`        Prices: ${priceString}`);
    });
    
    // Analyze by rarity
    const byRarity = {};
    variantData.forEach(card => {
      if (!byRarity[card.rarity]) byRarity[card.rarity] = [];
      byRarity[card.rarity].push(card);
    });
    
    console.log(`\n   Variance by Rarity (${variantName}):`);
    Object.entries(byRarity).forEach(([rarity, cards]) => {
      const avgVar = cards.reduce((sum, c) => sum + c.variance, 0) / cards.length;
      const avgPercent = cards.reduce((sum, c) => sum + c.percentDiff, 0) / cards.length;
      console.log(`     ${rarity}: ${cards.length} cards, avg $${avgVar.toFixed(2)} (${avgPercent.toFixed(1)}%)`);
    });
    
    // Analyze by set
    const bySet = {};
    variantData.forEach(card => {
      if (!bySet[card.setCode]) bySet[card.setCode] = [];
      bySet[card.setCode].push(card);
    });
    
    console.log(`\n   Variance by Set (${variantName}):`);
    coreSets.forEach(setCode => {
      const setCards = bySet[setCode] || [];
      if (setCards.length > 0) {
        const avgVar = setCards.reduce((sum, c) => sum + c.variance, 0) / setCards.length;
        const avgPercent = setCards.reduce((sum, c) => sum + c.percentDiff, 0) / setCards.length;
        console.log(`     Set ${setCode}: ${setCards.length} cards, avg $${avgVar.toFixed(2)} (${avgPercent.toFixed(1)}%)`);
      }
    });
    
    console.log('');
  }
  
  analyzeVariance(pricingAnalysis.base, 'base');
  analyzeVariance(pricingAnalysis.foil, 'foil');
  
  // Identify cards with significant pricing disagreements
  const significantDiscrepancies = {
    base: pricingAnalysis.base.filter(card => card.percentDiff > 100 || card.variance > 10),
    foil: pricingAnalysis.foil.filter(card => card.percentDiff > 100 || card.variance > 10)
  };
  
  console.log('🚨 Significant Pricing Discrepancies (>100% diff or >$10 variance):');
  ['base', 'foil'].forEach(variant => {
    const discrepancies = significantDiscrepancies[variant];
    console.log(`\n   ${variant.charAt(0).toUpperCase() + variant.slice(1)} variant: ${discrepancies.length} cards`);
    
    discrepancies.slice(0, 5).forEach(card => {
      const priceString = Object.entries(card.prices)
        .filter(([source, price]) => price !== null)
        .map(([source, price]) => `${source}: $${price.toFixed(2)}`)
        .join(', ');
      
      console.log(`     ${card.cardId} - ${card.name} (${card.rarity})`);
      console.log(`       $${card.variance.toFixed(2)} variance (${card.percentDiff.toFixed(1)}%): ${priceString}`);
    });
    
    if (discrepancies.length > 5) {
      console.log(`     ... and ${discrepancies.length - 5} more`);
    }
  });
  
  return {
    summary: {
      cardsAnalyzed,
      baseCardsPriced: pricingAnalysis.base.length,
      foilCardsPriced: pricingAnalysis.foil.length,
      avgBaseVariance: pricingAnalysis.base.length > 0 ? 
        pricingAnalysis.base.reduce((sum, c) => sum + c.variance, 0) / pricingAnalysis.base.length : 0,
      avgFoilVariance: pricingAnalysis.foil.length > 0 ? 
        pricingAnalysis.foil.reduce((sum, c) => sum + c.variance, 0) / pricingAnalysis.foil.length : 0
    },
    basePricing: pricingAnalysis.base,
    foilPricing: pricingAnalysis.foil,
    significantDiscrepancies
  };
}

// Run the analysis
const results = analyzePricingDifferences();

// Save detailed results
fs.writeFileSync('./data/PRICING_ANALYSIS.json', JSON.stringify(results, null, 2));
console.log('\n💾 Pricing analysis saved to PRICING_ANALYSIS.json');