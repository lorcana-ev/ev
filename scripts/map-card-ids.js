#!/usr/bin/env node
// Card ID to Product ID Mapping Script
// Maps Set 9 card IDs to known TCGPlayer product IDs

import fs from 'fs';
import path from 'path';

// Load cards data
const cardsPath = path.join(process.cwd(), 'data', 'cards-formatted.json');
const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Known product IDs from our research
const KNOWN_PRODUCTS = [
  { name: "The Queen", title: "Conceited Ruler", productId: 650141, rarity: "epic" },
  { name: "Beast", title: "Gracious Prince", productId: 651122, rarity: "enchanted" },
  { name: "Circle of Life", title: "Enchanted", productId: 649230, rarity: "enchanted" },
  { name: "I2I", title: "Enchanted", productId: 651116, rarity: "enchanted" },
  { name: "Powerline", title: "World's Greatest Rock Star", productId: 649231, rarity: "enchanted" },
  { name: "Dumbo", title: "Ninth Wonder of the Universe", productId: 651119, rarity: "enchanted" },
  { name: "Lilo", title: "Best Explorer Ever", productId: 649236, rarity: "enchanted" }
];

function findCardId(productInfo) {
  // Find matching card in Set 9
  const matches = cardsData.filter(card => 
    card.setId === '009' && 
    card.name === productInfo.name &&
    (card.title === productInfo.title || 
     (card.title && card.title.includes(productInfo.title)) || 
     (productInfo.title && productInfo.title.includes(card.title)))
  );
  
  if (matches.length === 1) {
    return matches[0].id;
  } else if (matches.length > 1) {
    // Multiple matches - need to determine which one
    console.log(`⚠️  Multiple matches for ${productInfo.name} - ${productInfo.title}:`);
    matches.forEach(match => {
      console.log(`   - ${match.id}: ${match.name} - ${match.title} (${match.rarity})`);
    });
    
    // For enchanted cards, prefer the higher number (usually enchanted variant)
    if (productInfo.rarity === 'enchanted') {
      const enchantedMatch = matches.find(m => m.rarity === 'enchanted');
      if (enchantedMatch) return enchantedMatch.id;
      
      // Otherwise take the higher numbered one
      return matches.sort((a, b) => parseInt(b.number) - parseInt(a.number))[0].id;
    }
    
    return matches[0].id; // Default to first match
  }
  
  return null;
}

function mapAllProducts() {
  console.log('🔍 Mapping known product IDs to Set 9 card IDs...\n');
  
  const mappings = [];
  
  for (const product of KNOWN_PRODUCTS) {
    const cardId = findCardId(product);
    
    if (cardId) {
      mappings.push({
        cardId: cardId,
        name: product.name,
        title: product.title,
        productId: product.productId,
        rarity: product.rarity
      });
      console.log(`✅ ${cardId}: ${product.name} - ${product.title} → Product ${product.productId}`);
    } else {
      console.log(`❌ No match found for: ${product.name} - ${product.title}`);
    }
  }
  
  console.log(`\n📊 Summary: Mapped ${mappings.length}/${KNOWN_PRODUCTS.length} product IDs to card IDs\n`);
  
  // Generate code to add to fetch script
  if (mappings.length > 0) {
    console.log('🚀 Code to add to fetch-set9-prices.js:');
    console.log('```javascript');
    mappings.forEach(mapping => {
      console.log(`  { id: "${mapping.cardId}", name: "${mapping.name}", title: "${mapping.title}", productId: ${mapping.productId}, rarity: "${mapping.rarity}" },`);
    });
    console.log('```\n');
  }
  
  return mappings;
}

// Run mapping
mapAllProducts();