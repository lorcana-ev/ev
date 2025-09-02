#!/usr/bin/env node
// Final comprehensive discrepancy analysis across all data sources
// Identify gaps, inconsistencies, and data quality issues

import fs from 'fs';
import path from 'path';

function loadMasterDatabase() {
  try {
    return JSON.parse(fs.readFileSync('./data/MASTER_CARD_DATABASE.json', 'utf8'));
  } catch (error) {
    console.error('❌ Could not load master database:', error.message);
    return null;
  }
}

function analyzeSetCompletion(masterDb) {
  console.log('📊 Set Completion Analysis:\n');
  
  const setCoverage = masterDb.discrepancy_analysis.set_coverage;
  const completionAnalysis = {};
  
  Object.entries(setCoverage).forEach(([setCode, coverage]) => {
    const dreambornPct = (coverage.dreamborn / coverage.total * 100).toFixed(1);
    const lorcastPct = (coverage.lorcast / coverage.total * 100).toFixed(1);
    const justTcgPct = (coverage.justtcg / coverage.total * 100).toFixed(1);
    
    completionAnalysis[setCode] = {
      total_cards: coverage.total,
      dreamborn_completion: parseFloat(dreambornPct),
      lorcast_completion: parseFloat(lorcastPct),
      justtcg_completion: parseFloat(justTcgPct),
      complete_in_all_sources: coverage.dreamborn === coverage.lorcast && coverage.lorcast === coverage.justtcg && coverage.justtcg === coverage.total
    };
    
    const status = completionAnalysis[setCode].complete_in_all_sources ? '✅ Complete' : '⚠️  Gaps';
    console.log(`   ${setCode}: ${coverage.total} cards - D:${dreambornPct}% L:${lorcastPct}% J:${justTcgPct}% ${status}`);
  });
  
  return completionAnalysis;
}

function analyzeDataQualityIssues(masterDb) {
  console.log('\\n🔍 Data Quality Issues:\n');
  
  const issues = {
    missing_names: [],
    missing_rarities: [],
    inconsistent_rarities: [],
    pricing_gaps: [],
    identifier_mismatches: []
  };
  
  Object.entries(masterDb.cards).forEach(([cardId, card]) => {
    // Check for missing core data
    if (!card.name || card.name === 'Unknown') {
      issues.missing_names.push(cardId);
    }
    
    if (!card.rarity) {
      issues.missing_rarities.push(cardId);
    }
    
    // Check for pricing availability gaps
    if (card.sources_available.justtcg && card.source_ids.justtcg && !card.source_ids.justtcg.has_pricing) {
      issues.pricing_gaps.push(cardId);
    }
    
    // Check for TCGPlayer ID mismatches
    if (card.source_ids.lorcast?.tcgplayer_id && card.source_ids.justtcg?.tcgplayer_id) {
      if (card.source_ids.lorcast.tcgplayer_id !== card.source_ids.justtcg.tcgplayer_id) {
        issues.identifier_mismatches.push({
          card_id: cardId,
          lorcast_id: card.source_ids.lorcast.tcgplayer_id,
          justtcg_id: card.source_ids.justtcg.tcgplayer_id
        });
      }
    }
  });
  
  console.log(`   Missing names: ${issues.missing_names.length} cards`);
  if (issues.missing_names.length > 0) {
    console.log(`     Examples: ${issues.missing_names.slice(0, 5).join(', ')}`);
  }
  
  console.log(`   Missing rarities: ${issues.missing_rarities.length} cards`);
  if (issues.missing_rarities.length > 0) {
    console.log(`     Examples: ${issues.missing_rarities.slice(0, 5).join(', ')}`);
  }
  
  console.log(`   JustTCG cards without pricing: ${issues.pricing_gaps.length} cards`);
  console.log(`   TCGPlayer ID mismatches: ${issues.identifier_mismatches.length} cards`);
  
  return issues;
}

function analyzePricingCoverage(masterDb) {
  console.log('\\n💰 Pricing Coverage Analysis:\n');
  
  const pricingStats = {
    total_cards: 0,
    has_justtcg_pricing: 0,
    has_dreamborn_pricing: 0,
    has_both_pricing: 0,
    set_coverage: {}
  };
  
  Object.entries(masterDb.cards).forEach(([cardId, card]) => {
    pricingStats.total_cards++;
    
    const hasJustTcg = card.sources_available.justtcg && card.source_ids.justtcg?.has_pricing;
    const hasDreamborn = card.sources_available.dreamborn; // Dreamborn has pricing for all its cards
    
    if (hasJustTcg) pricingStats.has_justtcg_pricing++;
    if (hasDreamborn) pricingStats.has_dreamborn_pricing++;
    if (hasJustTcg && hasDreamborn) pricingStats.has_both_pricing++;
    
    // Track by set
    const setCode = card.set_code;
    if (!pricingStats.set_coverage[setCode]) {
      pricingStats.set_coverage[setCode] = {
        total: 0,
        justtcg_pricing: 0,
        dreamborn_pricing: 0,
        both_pricing: 0
      };
    }
    
    pricingStats.set_coverage[setCode].total++;
    if (hasJustTcg) pricingStats.set_coverage[setCode].justtcg_pricing++;
    if (hasDreamborn) pricingStats.set_coverage[setCode].dreamborn_pricing++;
    if (hasJustTcg && hasDreamborn) pricingStats.set_coverage[setCode].both_pricing++;
  });
  
  const justTcgPct = (pricingStats.has_justtcg_pricing / pricingStats.total_cards * 100).toFixed(1);
  const dreambornPct = (pricingStats.has_dreamborn_pricing / pricingStats.total_cards * 100).toFixed(1);
  const bothPct = (pricingStats.has_both_pricing / pricingStats.total_cards * 100).toFixed(1);
  
  console.log(`   Total cards: ${pricingStats.total_cards}`);
  console.log(`   JustTCG pricing: ${pricingStats.has_justtcg_pricing} cards (${justTcgPct}%)`);
  console.log(`   Dreamborn pricing: ${pricingStats.has_dreamborn_pricing} cards (${dreambornPct}%)`);
  console.log(`   Both sources: ${pricingStats.has_both_pricing} cards (${bothPct}%)`);
  
  console.log('\\n   Pricing coverage by set:');
  Object.entries(pricingStats.set_coverage).forEach(([setCode, stats]) => {
    const jPct = (stats.justtcg_pricing / stats.total * 100).toFixed(0);
    const dPct = (stats.dreamborn_pricing / stats.total * 100).toFixed(0);
    console.log(`     ${setCode}: J:${jPct}% D:${dPct}% (${stats.total} cards)`);
  });
  
  return pricingStats;
}

function identifyHighPriorityGaps(masterDb) {
  console.log('\\n🎯 High Priority Data Gaps:\n');
  
  const gaps = {
    missing_new_rarities: [],
    incomplete_main_sets: [],
    missing_pricing_for_valuable: [],
    recommendations: []
  };
  
  // Find cards with new rarities (Epic/Iconic) missing from sources
  Object.entries(masterDb.cards).forEach(([cardId, card]) => {
    if (['epic', 'iconic'].includes(card.rarity)) {
      if (!card.sources_available.dreamborn) {
        gaps.missing_new_rarities.push({ cardId, rarity: card.rarity, missing_from: 'dreamborn' });
      }
      if (!card.sources_available.justtcg) {
        gaps.missing_new_rarities.push({ cardId, rarity: card.rarity, missing_from: 'justtcg' });
      }
    }
  });
  
  // Find incomplete main sets (001-009)
  const mainSets = ['001', '002', '003', '004', '005', '006', '007', '008', '009'];
  const setCoverage = masterDb.discrepancy_analysis.set_coverage;
  
  mainSets.forEach(setCode => {
    const coverage = setCoverage[setCode];
    if (coverage) {
      const dreambornMissing = coverage.total - coverage.dreamborn;
      const lorcastMissing = coverage.total - coverage.lorcast;  
      const justTcgMissing = coverage.total - coverage.justtcg;
      
      if (dreambornMissing > 0 || lorcastMissing > 0 || justTcgMissing > 5) {
        gaps.incomplete_main_sets.push({
          setCode,
          total: coverage.total,
          missing: { dreamborn: dreambornMissing, lorcast: lorcastMissing, justtcg: justTcgMissing }
        });
      }
    }
  });
  
  console.log(`   Epic/Iconic cards missing from sources: ${gaps.missing_new_rarities.length}`);
  gaps.missing_new_rarities.slice(0, 5).forEach(gap => {
    console.log(`     ${gap.cardId} (${gap.rarity}) missing from ${gap.missing_from}`);
  });
  
  console.log(`\\n   Incomplete main sets: ${gaps.incomplete_main_sets.length}`);
  gaps.incomplete_main_sets.forEach(gap => {
    console.log(`     ${gap.setCode}: ${gap.total} total, missing D:${gap.missing.dreamborn} L:${gap.missing.lorcast} J:${gap.missing.justtcg}`);
  });
  
  // Generate recommendations
  if (gaps.incomplete_main_sets.length > 0) {
    gaps.recommendations.push('Complete JustTCG fetching for main sets (001-008) - currently missing due to rate limits');
  }
  
  if (gaps.missing_new_rarities.length > 0) {
    gaps.recommendations.push('Update Dreamborn database to include Epic/Iconic rarities from Set 9');
  }
  
  const justTcgCoverage = Object.values(setCoverage).reduce((acc, c) => acc + c.justtcg, 0);
  const totalCards = Object.values(setCoverage).reduce((acc, c) => acc + c.total, 0);
  if (justTcgCoverage / totalCards < 0.8) {
    gaps.recommendations.push('Expand JustTCG coverage beyond current 36% to improve pricing accuracy');
  }
  
  console.log('\\n📋 Recommendations:');
  gaps.recommendations.forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec}`);
  });
  
  return gaps;
}

function finalDiscrepancyAnalysis() {
  console.log('🔍 Final Comprehensive Discrepancy Analysis\\n');
  console.log('=' .repeat(60) + '\\n');
  
  const masterDb = loadMasterDatabase();
  if (!masterDb) return;
  
  console.log(`📊 Master Database Overview:`);
  console.log(`   Total unique cards: ${masterDb.metadata.total_cards}`);
  console.log(`   Cards in all 3 sources: ${masterDb.metadata.coverage_summary.all_three_sources}`);
  console.log(`   Source card counts: D:${masterDb.metadata.sources.dreamborn} L:${masterDb.metadata.sources.lorcast} J:${masterDb.metadata.sources.justtcg}\\n`);
  
  // Analyze set completion
  const setCompletion = analyzeSetCompletion(masterDb);
  
  // Analyze data quality
  const qualityIssues = analyzeDataQualityIssues(masterDb);
  
  // Analyze pricing coverage
  const pricingCoverage = analyzePricingCoverage(masterDb);
  
  // Identify high priority gaps
  const priorityGaps = identifyHighPriorityGaps(masterDb);
  
  // Create final analysis report
  const finalReport = {
    summary: {
      total_cards: masterDb.metadata.total_cards,
      coverage_by_source: masterDb.metadata.sources,
      three_source_coverage: masterDb.metadata.coverage_summary.all_three_sources,
      completion_percentage: (masterDb.metadata.coverage_summary.all_three_sources / masterDb.metadata.total_cards * 100).toFixed(1)
    },
    set_analysis: setCompletion,
    quality_analysis: qualityIssues,
    pricing_analysis: pricingCoverage,
    priority_gaps: priorityGaps,
    recommendations: priorityGaps.recommendations,
    generated_at: new Date().toISOString()
  };
  
  // Save the final analysis
  fs.writeFileSync('./data/FINAL_DISCREPANCY_ANALYSIS.json', JSON.stringify(finalReport, null, 2));
  
  console.log('\\n' + '=' .repeat(60));
  console.log('🎯 FINAL SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Master database created with ${masterDb.metadata.total_cards} unique cards`);
  console.log(`📊 Three-source coverage: ${finalReport.summary.three_source_coverage} cards (${finalReport.summary.completion_percentage}%)`);
  console.log(`💰 Pricing available for ${pricingCoverage.has_justtcg_pricing + pricingCoverage.has_dreamborn_pricing - pricingCoverage.has_both_pricing} unique cards`);
  console.log(`🔧 ${priorityGaps.recommendations.length} recommendations identified for data improvement`);
  console.log('\\n💾 Analysis saved to FINAL_DISCREPANCY_ANALYSIS.json');
  
  return finalReport;
}

// Export for use by other scripts
export { finalDiscrepancyAnalysis };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  finalDiscrepancyAnalysis();
}