# Missing Cards Analysis - Core Sets 001-009

**Analysis Date**: 2025-09-02  
**Status**: Complete - Ready for Review

## Summary

Comprehensive analysis of missing cards across three data sources (Dreamborn, Lorcast, JustTCG) for Disney Lorcana core sets 001-009, with filters applied to exclude non-essential cards.

## Key Findings

### Overall Numbers (After Filtering)
- **Total core set cards**: 2,051
- **Missing from Dreamborn**: 6 cards (excluded 13 promos/variants)
- **Missing from Lorcast**: 10 cards (excluded 21 promos/variants)
- **Missing from JustTCG**: 26 cards (excluded 13 promos/variants)

### Filters Applied
- ✅ **Excluded**: Promo cards (P1, P2 series)
- ✅ **Excluded**: Dalmatian puppy variants (003-04a through 003-04e)
- ✅ **Excluded**: Puzzle inserts and booster packs (00N, 000 non-playable products)
- ✅ **Kept**: Bruno Madrigal (009-000) - legitimate playable card
- ✅ **Kept**: Foil variants (008-##f series) - need investigation

## Detailed Breakdown

### Missing from Dreamborn (6 cards)
- **Set 008**: 5 foil variants (008-01f, 008-02f, 008-03f, 008-65f, 008-125f)
- **Set 009**: Bruno Madrigal (009-000) - super rare, legitimate card

### Missing from Lorcast (10 cards)
- **Set 003**: 6 cards including Dalmatian variants + Piglet (003-223)
- **Set 007**: Bolt (007-223) and Elsa (007-224) - both super rare
- **Set 008**: Goofy (008-223) and Pinocchio (008-224) - both legendary

### Missing from JustTCG (26 cards) - Highest Impact
**High-value missing cards (7 total):**
- **Set 004**: Yen Sid (004-223, legendary), Mulan (004-224, legendary)
- **Set 008**: Goofy (008-223, legendary), Pinocchio (008-224, legendary)
- **Set 009**: Bruno Madrigal (009-000, super rare), Genie (009-229, enchanted), Mulan (009-235, enchanted)

**Other missing cards:**
- Various commons, uncommons, and rares across sets 001, 003, 005, 006

## Cards Only in One Source (16 total)

### Dreamborn Exclusive (10 cards)
- 5 Dalmatian variants (003-04a through 003-04e)
- 5 high-value cards: Piglet, Bolt, Elsa, Goofy, Pinocchio

### Lorcast Exclusive (6 cards)
- 5 Set 008 foil variants (008-##f)
- 1 Bruno Madrigal (009-000)

### JustTCG Exclusive
- ✅ None (good coverage overlap)

## Issues Identified & Resolved

### ✅ Fixed Issues
1. **Set 009 Foil Pricing**: Fixed unified pricing to handle "Cold Foil" variants (98.8% coverage achieved)
2. **Database Cleanup**: Removed all non-core sets, normalized rarities
3. **Box/Case Products**: Confirmed JustTCG doesn't carry Disney Lorcana sealed products

### ❓ Questions for Further Investigation

1. **Set 008 Foil Variants**: Are the 008-##f cards legitimate separate entries or just different foil numbering?
   - Pattern: 008-01f, 008-02f, 008-03f, 008-65f, 008-125f
   - All marked as foil variants, only in Lorcast
   
2. **Bruno Madrigal (009-000)**: Why is this legitimate card missing from 2/3 sources?
   - Unusual "000" card number
   - Super rare rarity
   - Only in Lorcast
   
3. **High Card Numbers (223-225)**: Pattern suggests special/bonus cards
   - Multiple sets have gaps at 223-224
   - These may be late additions or special releases

## Impact on EV Calculator

### High Impact ⚠️
- **7 high-value cards missing from JustTCG** affects pricing accuracy
- **Enchanted cards** (009-229, 009-235) have significant EV impact
- **Legendary cards** (004/008 series) affect rare pull calculations

### Medium Impact ⚠️  
- Bruno Madrigal (009-000) missing from primary sources
- Set 008 foil variants may affect foil pricing calculations

### Low Impact ✅
- Common/uncommon gaps have minimal EV effect
- Good fallback coverage (most cards in 2+ sources)

## Recommendations

### Immediate Actions
1. **Pricing Fallback**: Use Dreamborn pricing for missing JustTCG cards
2. **Documentation**: Mark high-value missing cards in EV calculations
3. **User Alerts**: Note when calculations use incomplete pricing data

### Future Investigation (When Resources Allow)
1. **Set 008 Foil Investigation**: Determine if foil variants are separate cards
2. **Bruno Madrigal Research**: Investigate why card is missing from major sources
3. **High Card Number Pattern**: Research 223-225 card number significance

## Data Quality Assessment

**Overall: GOOD** ✅  
- 97.5% of cards present in all three sources
- 98.2% of cards present in 2+ sources  
- Missing cards follow logical patterns
- High-value gaps documented and manageable

## Files Generated

- `FILTERED_MISSING_CARDS.json` - Detailed analysis data
- `COMPREHENSIVE_CORE_DISCREPANCIES.json` - Full discrepancy analysis  
- `CORE_SETS_ONLY_DATABASE.json` - Clean core sets database
- `UNIFIED_PRICING.json` - Fixed pricing with Set 009 foils

## Next Steps

1. Review Set 008 foil variant pattern
2. Research Bruno Madrigal card availability  
3. Consider manual pricing additions for high-value missing cards
4. Monitor JustTCG for updates to missing legendary/enchanted cards

---

*Analysis completed as part of comprehensive data source integration project. Core sets database is production-ready with documented limitations.*