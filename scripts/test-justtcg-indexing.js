// Test the updated JustTCG indexing method

import fs from 'fs';

// Import the MultiSourcePricing class
import { MultiSourcePricing } from '../src/lib/prices.js';

function testJustTCGIndexing() {
  console.log('🧪 Testing JustTCG Indexing Fix\n');

  // Load JustTCG data
  const justTcgData = JSON.parse(fs.readFileSync('./data/JUSTTCG.json', 'utf8'));
  
  console.log(`📊 Raw JustTCG data structure:`);
  console.log(`   Metadata: ${Object.keys(justTcgData.metadata || {}).length} keys`);
  console.log(`   Batches: ${Object.keys(justTcgData.batches || {}).length} batches`);
  
  // Count total raw cards
  let totalRawCards = 0;
  let set009Cards = 0;
  
  for (const [batchKey, batch] of Object.entries(justTcgData.batches || {})) {
    if (batch.raw_cards) {
      totalRawCards += batch.raw_cards.length;
      const fabledCards = batch.raw_cards.filter(c => c.set === 'Fabled');
      set009Cards += fabledCards.length;
      console.log(`   ${batchKey}: ${batch.raw_cards.length} cards (${fabledCards.length} Fabled)`);
    }
  }
  
  console.log(`   Total raw cards: ${totalRawCards}`);
  console.log(`   Total Fabled cards: ${set009Cards}`);

  // Test the indexing
  const multiPricing = new MultiSourcePricing({
    justtcg: justTcgData,
    dreamborn: null,
    lorcast: null
  });
  
  // Check if JustTCG source was indexed
  const justTcgIndex = multiPricing.sources.justtcg;
  console.log(`\n💰 JustTCG Index Results:`);
  console.log(`   Indexed entries: ${justTcgIndex.size}`);
  
  // Check for specific Fabled cards
  const fabledSamples = [
    '009-001', '009-002', '009-242'  // Samples including the iconic card
  ];
  
  for (const cardId of fabledSamples) {
    const basePrice = justTcgIndex.get(`${cardId}-base`);
    const foilPrice = justTcgIndex.get(`${cardId}-foil`);
    
    console.log(`   ${cardId}:`);
    console.log(`     Base: ${basePrice ? `$${basePrice.market}` : 'Not found'}`);
    console.log(`     Foil: ${foilPrice ? `$${foilPrice.market}` : 'Not found'}`);
  }
  
  // List all indexed card IDs that start with 009
  const indexed009 = [];
  for (const key of justTcgIndex.keys()) {
    if (key.startsWith('009-')) {
      indexed009.push(key);
    }
  }
  
  console.log(`\n🎯 Indexed Set 009 entries: ${indexed009.length}`);
  if (indexed009.length > 0) {
    console.log(`   Sample entries: ${indexed009.slice(0, 10).join(', ')}`);
  }
  
  // Test price lookup using the multi-source system
  const testPrice = multiPricing.getPrice('009-242-foil', ['justtcg']);
  console.log(`\n🔍 Test lookup 009-242-foil: ${testPrice ? `$${testPrice.market} [${testPrice.source}]` : 'Not found'}`);

  return {
    totalRawCards,
    set009Cards,
    indexedEntries: justTcgIndex.size,
    indexed009Count: indexed009.length
  };
}

// Run the test
const results = testJustTCGIndexing();
console.log('\n✅ Test Complete');