#!/usr/bin/env node
/**
 * Analyze TCGPlayer ID Coverage Across All Sources
 * 
 * This script examines all data sources to find TCGPlayer IDs and identify
 * which cards are missing IDs and where we might find them.
 */

import fs from 'fs';
import path from 'path';

function loadAllSources() {
  console.log('📁 Loading all data sources...\n');
  
  const sources = {};
  
  // Load cards.json
  try {
    sources.cards = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
    console.log(`✅ cards.json: ${sources.cards.length} cards`);
  } catch (error) {
    console.error('❌ Failed to load cards.json:', error.message);
    process.exit(1);
  }
  
  // Load LORCAST.json
  try {
    sources.lorcast = JSON.parse(fs.readFileSync('./data/LORCAST.json', 'utf8'));
    console.log(`✅ LORCAST.json: ${Object.keys(sources.lorcast.cards).length} cards`);
  } catch (error) {
    console.warn('⚠️  LORCAST.json not available');
    sources.lorcast = { cards: {} };
  }
  
  // Load JUSTTCG.json
  try {
    sources.justtcg = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
    console.log(`✅ JUSTTCG.json: ${Object.keys(sources.justtcg.cards).length} cards`);
  } catch (error) {
    console.warn('⚠️  JUSTTCG.json not available');
    sources.justtcg = { cards: {} };
  }
  
  // Load USD.json (Dreamborn pricing)
  try {
    sources.dreamborn_prices = JSON.parse(fs.readFileSync('./data/USD.json', 'utf8'));
    console.log(`✅ USD.json: ${Object.keys(sources.dreamborn_prices).length} price entries`);
  } catch (error) {
    console.warn('⚠️  USD.json not available');
    sources.dreamborn_prices = {};
  }
  
  // Load MANUAL_TCGPLAYER.json
  try {
    sources.manual_tcgplayer = JSON.parse(fs.readFileSync('./data/MANUAL_TCGPLAYER.json', 'utf8'));
    console.log(`✅ MANUAL_TCGPLAYER.json: ${Object.keys(sources.manual_tcgplayer.cards || {}).length} cards`);
  } catch (error) {
    console.warn('⚠️  MANUAL_TCGPLAYER.json not available');
    sources.manual_tcgplayer = { cards: {} };
  }
  
  // Load TCGPLAYER.json if it exists
  try {
    sources.tcgplayer = JSON.parse(fs.readFileSync('./data/TCGPLAYER.json', 'utf8'));
    console.log(`✅ TCGPLAYER.json: ${Object.keys(sources.tcgplayer).length} entries`);
  } catch (error) {
    console.warn('⚠️  TCGPLAYER.json not available');
    sources.tcgplayer = {};
  }
  
  return sources;
}

function extractTcgPlayerIdFromLink(link) {
  if (!link) return null;
  const match = link.match(/product\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function analyzeCard(card, sources) {
  const setId = card.setId || card.set?.code || card.setCode;
  const number = String(card.number || card.nr || '').padStart(3, '0');
  const canonicalId = `${setId}-${number}`;
  const hashId = card.id && card.id.includes('/') ? card.id : null;
  
  const analysis = {
    canonical_id: canonicalId,
    hash_id: hashId,
    name: card.name,
    title: card.title,
    set: setId,
    number: number,
    tcgplayer_ids: {
      lorcast: null,
      justtcg: null,
      dreamborn_pricing: null,
      manual_tcgplayer: null,
      tcgplayer_file: null
    },
    sources_checked: []
  };
  
  // Check Lorcast
  const lorcastCard = sources.lorcast.cards[canonicalId];
  if (lorcastCard?.raw_data?.tcgplayer_id) {
    analysis.tcgplayer_ids.lorcast = lorcastCard.raw_data.tcgplayer_id;
    analysis.sources_checked.push('lorcast');
  }
  
  // Check JustTCG
  const justTcgCard = sources.justtcg.cards[canonicalId];
  if (justTcgCard) {
    analysis.sources_checked.push('justtcg');
    // JustTCG might have tcgplayer_id or tcgplayerId field
    if (justTcgCard.tcgplayer_id) {
      analysis.tcgplayer_ids.justtcg = justTcgCard.tcgplayer_id;
    } else if (justTcgCard.tcgplayerId) {
      analysis.tcgplayer_ids.justtcg = justTcgCard.tcgplayerId;
    } else if (justTcgCard.matched_card_id) {
      analysis.tcgplayer_ids.justtcg = justTcgCard.matched_card_id;
    }
  }
  
  // Check Dreamborn pricing (both hash ID and canonical ID)
  const dreambornPrice = sources.dreamborn_prices[canonicalId] || 
                         (hashId ? sources.dreamborn_prices[hashId] : null);
  if (dreambornPrice) {
    analysis.sources_checked.push('dreamborn');
    // Try productId field
    let tcgPlayerId = dreambornPrice.base?.TP?.productId || dreambornPrice.foil?.TP?.productId;
    
    // Try extracting from links
    if (!tcgPlayerId) {
      const baseLink = dreambornPrice.base?.TP?.link;
      const foilLink = dreambornPrice.foil?.TP?.link;
      tcgPlayerId = extractTcgPlayerIdFromLink(baseLink) || extractTcgPlayerIdFromLink(foilLink);
    }
    
    if (tcgPlayerId) {
      analysis.tcgplayer_ids.dreamborn_pricing = tcgPlayerId;
    }
  }
  
  // Check Manual TCGPlayer
  const manualCard = sources.manual_tcgplayer.cards?.[canonicalId];
  if (manualCard) {
    analysis.sources_checked.push('manual_tcgplayer');
    if (manualCard.tcgplayer_id) {
      analysis.tcgplayer_ids.manual_tcgplayer = manualCard.tcgplayer_id;
    }
  }
  
  // Check TCGPLAYER.json
  const tcgplayerCard = sources.tcgplayer[canonicalId];
  if (tcgplayerCard) {
    analysis.sources_checked.push('tcgplayer_file');
    if (typeof tcgplayerCard === 'object' && tcgplayerCard.productId) {
      analysis.tcgplayer_ids.tcgplayer_file = tcgplayerCard.productId;
    } else if (typeof tcgplayerCard === 'number') {
      analysis.tcgplayer_ids.tcgplayer_file = tcgplayerCard;
    }
  }
  
  return analysis;
}

function findBestTcgPlayerId(analysis) {
  // Collect all non-null TCGPlayer IDs
  const ids = Object.values(analysis.tcgplayer_ids).filter(id => id !== null);
  
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];
  
  // Check if all IDs agree
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 1) {
    return uniqueIds[0];
  }
  
  // Conflict! Return the most common one, with priority to manual_tcgplayer > lorcast > others
  const priority = ['manual_tcgplayer', 'lorcast', 'justtcg', 'dreamborn_pricing', 'tcgplayer_file'];
  for (const source of priority) {
    if (analysis.tcgplayer_ids[source] !== null) {
      return analysis.tcgplayer_ids[source];
    }
  }
  
  return ids[0]; // Fallback
}

function analyzeAll(sources) {
  console.log('\n🔍 Analyzing TCGPlayer ID coverage...\n');
  
  const stats = {
    total_cards: 0,
    with_tcgplayer_id: 0,
    without_tcgplayer_id: 0,
    id_conflicts: 0,
    sources: {
      lorcast: 0,
      justtcg: 0,
      dreamborn_pricing: 0,
      manual_tcgplayer: 0,
      tcgplayer_file: 0
    }
  };
  
  const cardAnalyses = [];
  const cardsWithoutId = [];
  const conflicts = [];
  
  for (const card of sources.cards) {
    const analysis = analyzeCard(card, sources);
    cardAnalyses.push(analysis);
    stats.total_cards++;
    
    const bestId = findBestTcgPlayerId(analysis);
    
    if (bestId) {
      stats.with_tcgplayer_id++;
      
      // Count which sources contributed
      for (const [source, id] of Object.entries(analysis.tcgplayer_ids)) {
        if (id !== null) {
          stats.sources[source]++;
        }
      }
      
      // Check for conflicts
      const ids = Object.values(analysis.tcgplayer_ids).filter(id => id !== null);
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length > 1) {
        stats.id_conflicts++;
        conflicts.push({
          ...analysis,
          best_id: bestId,
          conflicting_ids: uniqueIds
        });
      }
    } else {
      stats.without_tcgplayer_id++;
      cardsWithoutId.push(analysis);
    }
  }
  
  return { stats, cardAnalyses, cardsWithoutId, conflicts };
}

function generateReport(results) {
  const { stats, cardsWithoutId, conflicts } = results;
  
  console.log('📊 TCGPlayer ID Coverage Report\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log('Overall Coverage:');
  console.log(`  Total cards: ${stats.total_cards}`);
  console.log(`  Cards WITH TCGPlayer ID: ${stats.with_tcgplayer_id} (${(stats.with_tcgplayer_id / stats.total_cards * 100).toFixed(1)}%)`);
  console.log(`  Cards WITHOUT TCGPlayer ID: ${stats.without_tcgplayer_id} (${(stats.without_tcgplayer_id / stats.total_cards * 100).toFixed(1)}%)`);
  
  console.log('\n\nSource Contribution:');
  console.log(`  Lorcast: ${stats.sources.lorcast} cards`);
  console.log(`  JustTCG: ${stats.sources.justtcg} cards`);
  console.log(`  Dreamborn Pricing: ${stats.sources.dreamborn_pricing} cards`);
  console.log(`  Manual TCGPlayer: ${stats.sources.manual_tcgplayer} cards`);
  console.log(`  TCGPLAYER.json: ${stats.sources.tcgplayer_file} cards`);
  
  if (stats.id_conflicts > 0) {
    console.log(`\n\n⚠️  ID Conflicts: ${stats.id_conflicts} cards have different TCGPlayer IDs across sources`);
    console.log('\nSample conflicts (first 5):');
    conflicts.slice(0, 5).forEach(conflict => {
      console.log(`\n  ${conflict.canonical_id}: ${conflict.name}${conflict.title ? ' - ' + conflict.title : ''}`);
      console.log(`    Conflicting IDs: ${conflict.conflicting_ids.join(', ')}`);
      console.log(`    Using: ${conflict.best_id}`);
      Object.entries(conflict.tcgplayer_ids).forEach(([source, id]) => {
        if (id !== null) {
          console.log(`      ${source}: ${id}`);
        }
      });
    });
  }
  
  if (cardsWithoutId.length > 0) {
    console.log(`\n\n❌ Cards Missing TCGPlayer ID: ${cardsWithoutId.length}`);
    
    // Group by set
    const bySet = {};
    cardsWithoutId.forEach(card => {
      if (!bySet[card.set]) bySet[card.set] = [];
      bySet[card.set].push(card);
    });
    
    console.log('\nBy Set:');
    Object.entries(bySet)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([set, cards]) => {
        console.log(`  ${set}: ${cards.length} cards`);
      });
    
    console.log('\n\nSample missing cards (first 10):');
    cardsWithoutId.slice(0, 10).forEach(card => {
      console.log(`\n  ${card.canonical_id}: ${card.name}${card.title ? ' - ' + card.title : ''}`);
      console.log(`    Hash ID: ${card.hash_id || 'N/A'}`);
      console.log(`    Sources checked: ${card.sources_checked.join(', ') || 'none'}`);
    });
  }
}

function generateEnhancedMapping(results, sources) {
  console.log('\n\n📝 Generating enhanced TCGPlayer ID mapping...\n');
  
  const mapping = {
    metadata: {
      created_at: new Date().toISOString(),
      version: '2.0.0',
      description: 'Enhanced TCGPlayer ID mapping with multi-source aggregation',
      coverage: {
        total_cards: results.stats.total_cards,
        with_tcgplayer_id: results.stats.with_tcgplayer_id,
        coverage_percent: (results.stats.with_tcgplayer_id / results.stats.total_cards * 100).toFixed(2)
      }
    },
    tcgplayer_id_to_canonical: {},
    canonical_to_tcgplayer_id: {}
  };
  
  for (const analysis of results.cardAnalyses) {
    const tcgPlayerId = findBestTcgPlayerId(analysis);
    
    if (tcgPlayerId) {
      mapping.canonical_to_tcgplayer_id[analysis.canonical_id] = {
        tcgplayer_id: tcgPlayerId,
        name: analysis.name,
        title: analysis.title,
        set: analysis.set,
        sources: Object.entries(analysis.tcgplayer_ids)
          .filter(([_, id]) => id !== null)
          .map(([source, _]) => source)
      };
      
      // For reverse lookup (might have multiple cards per TCGPlayer ID in case of variants)
      if (!mapping.tcgplayer_id_to_canonical[tcgPlayerId]) {
        mapping.tcgplayer_id_to_canonical[tcgPlayerId] = [];
      }
      mapping.tcgplayer_id_to_canonical[tcgPlayerId].push(analysis.canonical_id);
    }
  }
  
  const outputPath = path.join(process.cwd(), 'data', 'TCGPLAYER_ID_MAPPING.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
  console.log(`💾 Saved enhanced mapping to: ${outputPath}`);
  console.log(`   ${Object.keys(mapping.canonical_to_tcgplayer_id).length} cards mapped`);
  console.log(`   ${Object.keys(mapping.tcgplayer_id_to_canonical).length} unique TCGPlayer IDs`);
}

function main() {
  console.log('🚀 TCGPlayer ID Coverage Analysis\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  const sources = loadAllSources();
  const results = analyzeAll(sources);
  generateReport(results);
  generateEnhancedMapping(results, sources);
  
  console.log('\n✅ Analysis complete!\n');
}

main();

