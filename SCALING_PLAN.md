# Set 9 (Fabled) Price Collection Scaling Plan

## ✅ Phase 1: Bootstrap (COMPLETED)
**Status:** ✅ Complete
**Results:** Successfully added 6 Set 9 cards with pricing data

### What We Accomplished:
- ✅ Found 7+ confirmed TCGPlayer product IDs for Set 9 cards
- ✅ Built working price fetching script (`scripts/fetch-set9-prices.js`)
- ✅ Created card ID mapping script (`scripts/map-card-ids.js`)
- ✅ Validated data structure compatibility 
- ✅ Successfully added pricing for 6 high-value Set 9 cards
- ✅ Confirmed URL pattern matches existing infrastructure
- ✅ Built automated search framework (ready for future enhancement)

### Key Findings:
- **242 total Set 9 cards** need pricing data
- **0 cards had pricing** before our work  
- **6 cards now have pricing** (2.5% coverage)
- **Perfect data structure match** with existing cards
- **Working affiliate link integration**
- **TCGPlayer uses SPA/JavaScript** - requires different scraping approach

## 🎯 Phase 2: Scale Up (NEXT)
**Goal:** Get pricing for 20-50 high-value Set 9 cards

### Priority Card Types:
1. **Enchanted cards** (highest value, most important for EV)
2. **Legendary cards** (high impact on calculations)
3. **Super Rare cards** (moderate impact)
4. **Popular characters** (Mickey, Stitch, Elsa, etc.)

### Discovered Product IDs Ready to Add:
```javascript
// Ready to add to fetch-set9-prices.js
const ADDITIONAL_CARDS = [
  { id: "009-xxx", name: "Circle of Life", title: "Enchanted", productId: 649230, rarity: "enchanted" },
  { id: "009-xxx", name: "I2I", title: "Enchanted", productId: 651116, rarity: "enchanted" },
  { id: "009-xxx", name: "Powerline", title: "World's Greatest Rock Star", productId: 649231, rarity: "enchanted" },
  { id: "009-xxx", name: "Dumbo", title: "Ninth Wonder of the Universe", productId: 651119, rarity: "enchanted" },
  { id: "009-xxx", name: "Lilo", title: "Best Explorer Ever", productId: 649236, rarity: "enchanted" }
];
```

### Action Items:
1. **Map product IDs to card IDs** - Cross-reference with `cards-formatted.json`
2. **Add more cards to script** - Use the `addMoreCards()` function
3. **Run expanded script** - Fetch pricing for 10-15 cards
4. **Verify pricing accuracy** - Cross-check a few manually

## 🚀 Phase 3: Full Coverage (FUTURE)
**Goal:** Complete pricing for all 242 Set 9 cards

### Automation Strategies:
1. **TCGPlayer Search Scraping**
   - Automate product ID discovery via search results
   - Handle rate limiting and anti-bot measures
   - Cross-reference card names/titles

2. **Alternative Data Sources**
   - Investigate Lorcana.gg API endpoints
   - Consider LorcanaPlayer.com data aggregation
   - Evaluate Dreamborn.ink potential APIs

3. **Community Sourcing** 
   - Crowdsource product ID collection
   - Build web form for manual submissions
   - Validate and merge community contributions

## 📊 Current Status Summary

### Infrastructure ✅
- [x] Price fetching framework built
- [x] Data structure validated
- [x] URL pattern confirmed
- [x] Rate limiting implemented
- [x] Error handling included

### Coverage Status 📈
- **Total Set 9 cards:** 242
- **Cards with pricing:** 6 (2.5%)
- **Cards without pricing:** 236 (97.5%)
- **Successfully mapped product IDs:** 5 of 7 known

### Currently Priced Cards:
- ✅ 009-001: The Queen - Conceited Ruler (Epic) - $8.40 base, $19.42 foil
- ✅ 009-004: Beast - Gracious Prince (Rare) - $0.79 base, $20.21 foil  
- ✅ 009-224: Beast - Gracious Prince (Enchanted) - $0.93 base, $14.61 foil
- ✅ 009-228: Dumbo - Ninth Wonder of the Universe (Enchanted) - $8.36 base, $13.06 foil
- ✅ 009-233: Powerline - World's Greatest Rock Star (Enchanted) - $5.26 base, $6.70 foil
- ✅ 009-238: Lilo - Best Explorer Ever (Enchanted) - $6.24 base, $7.84 foil

### Next Immediate Actions 🎯
1. **Manual product ID discovery** - Research more Set 9 enchanted/legendary cards on TCGPlayer
2. **Fix title matching** - Resolve "Circle of Life" and "I2I" mapping issues  
3. **Expand to 15-20 cards** - Focus on highest value cards for EV impact
4. **Test Set 9 EV calculations** with current pricing data
5. **Investigate browser automation** - Puppeteer/Playwright for JavaScript-heavy sites

### Automation Challenges Discovered 🤖
- **TCGPlayer is SPA-based** - Search results load via JavaScript, not in initial HTML
- **Simple HTTP scraping insufficient** - Need browser automation for dynamic content
- **Manual discovery still effective** - Bootstrap approach scales well for high-priority cards
- **Rate limiting critical** - Respectful delays prevent blocking

## 💡 Technical Notes

### Script Usage:
```bash
# Run price collection
node scripts/fetch-set9-prices.js

# Validate approach
node scripts/validate-set9-approach.js

# Check current coverage
grep -c '"009-' data/USD.json
```

### Data Structure:
```json
{
  "009-001": {
    "base": {
      "TP": {
        "price": 1.05,
        "link": "https://partner.tcgplayer.com/c/4892540/1830156/21018/?u=https%3A%2F%2Ftcgplayer.com%2Fproduct%2F650141",
        "productId": 650141
      }
    },
    "foil": { /* same structure */ }
  }
}
```

### Performance Considerations:
- **Rate limiting:** 1 second delay between requests
- **Batch processing:** Process cards in chunks
- **Error recovery:** Continue on individual failures
- **Data backup:** Preserve existing pricing data

---

✨ **Bottom Line:** The bootstrap approach worked perfectly! We now have a proven method to scale up Set 9 price collection systematically.