# Box Pricing Feature Removal - October 20, 2025

## Summary

Removed the box pricing extraction feature and related files as they provided minimal value.

## What Was Removed

### 1. Data File
- ✅ **`data/BOX_PRICING.json`** - Deleted

**Why removed:**
- Only contained data for Fabled set (newest set)
- Data was outdated (last updated September 1, 2025)
- Contained broken EV calculations ($146/pack - absurd)
- Never displayed to users in the web application
- No sealed product pricing available for older sets (001-008)

### 2. Scripts
- ✅ **`scripts/extract-box-pricing.js`** - Deleted
- ✅ **`scripts/investigate-box-case-products.js`** - Deleted

**Why removed:**
- Only extracted data for 1 set out of 9 main sets
- Generated outdated pricing data
- Not called by update-all.js anymore
- Investigation script was one-time use

## Why Box Pricing Wasn't Useful

### Limited Data Availability
JustTCG only has sealed product pricing for:
- **Fabled Booster Box**: $134.38 (Set 009)
- **Fabled Booster Box Case**: $613.44 (4 boxes)
- **D23 Collection**: $175.22 (special collection)

**Missing data for:**
- The First Chapter (001)
- Rise of the Floodborn (002)
- Into the Inklands (003)
- Ursula's Return (004)
- Shimmering Skies (005)
- Azurite Sea (006)
- Gateway (007)
- Darklight (008)

### Why Older Sets Missing
- Sealed products sold out or unavailable
- JustTCG doesn't track products without active inventory
- Would need manual TCGPlayer lookups

### What the Web App Already Shows
The web application already calculates and displays:
- **Pack EV** - Expected value per pack
- **Box EV** - Pack EV × 24 packs
- **Case EV** - Pack EV × 96 packs (4 boxes)

These calculated EVs are what users need to compare against market prices, not the market prices themselves.

## Impact

### Files Removed
- `data/BOX_PRICING.json` (5.6KB)
- `scripts/extract-box-pricing.js` (5.4KB)
- `scripts/investigate-box-case-products.js` (6.5KB)

**Total:** ~17.5KB removed

### Pipeline Impact
- ✅ Pipeline already didn't call these scripts (removed earlier in cleanup)
- ✅ No change to update-all.js needed
- ✅ No impact on web application functionality

## If Box Market Pricing is Needed Later

### For Current Set (Fabled)
Box/case pricing can be extracted directly from JustTCG batches data:

```javascript
// Example: Get Fabled box pricing
const justTcg = JSON.parse(fs.readFileSync('data/JUSTTCG.json'));
for (const [batchKey, batchData] of Object.entries(justTcg.batches)) {
  for (const card of batchData.raw_cards) {
    if (card.name.includes('Booster Box')) {
      console.log(card.name, card.variants);
    }
  }
}
```

### For Older Sets
Would need to:
1. Manually check TCGPlayer for availability
2. Most older sealed products are sold out or significantly marked up
3. Not suitable for automated tracking

## Recommendation

If you want to show market prices for comparison:
- **For newest set**: Pull directly from JustTCG batches on-demand
- **For older sets**: Accept that sealed product pricing is unavailable
- **Focus on**: Pack EV calculations (which the web app does well)

The web app's strength is calculating **what a pack is worth**, not tracking **what sealed products cost**. Users can easily compare the calculated pack EV against current market prices themselves.

## Documentation Updates

- ✅ Updated `docs/CLEANUP_2025-10-20.md` to reflect deletions
- ✅ Created this document (`docs/BOX_PRICING_REMOVAL.md`)
- ℹ️ No changes needed to `docs/DATA_UPDATE_PIPELINE.md` (already didn't mention box pricing)
- ℹ️ No changes needed to README.md (didn't reference BOX_PRICING.json)

## Conclusion

The box pricing feature was removed because:
1. **Limited data** - Only 1 set out of 9
2. **Outdated** - September data in October
3. **Broken calculations** - Absurd EV values
4. **Not used** - Never displayed to users
5. **Unnecessary** - Web app shows calculated EVs instead

The web application works perfectly without it, and the pipeline is now simpler and cleaner.
