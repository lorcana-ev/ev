# EV Calculation Methods Comparison

## Two Different EV Calculators

The Lorcana EV project has **two separate EV calculation methods** that work differently and produce different results.

## Method 1: Web Application (src/lib/model.js)

**Used by**: The live website/web app
**File**: `src/lib/model.js` - `evPack()` function
**Data source**: Direct pricing from JustTCG → Dreamborn → Lorcast (fallback chain)

### Algorithm

```javascript
// Rare-or-higher slots (2 slots)
EV_rareplus = 2 × (
  P(rare) × avg_price(rare, base) +
  P(super_rare) × avg_price(super_rare, base) +
  P(legendary) × avg_price(legendary, base) +
  P(epic) × avg_price(epic, base) +
  P(iconic) × avg_price(iconic, base)
)

// Foil slot (1 slot)
EV_foil =
  P(common_foil) × avg_price(common, foil) +
  P(uncommon_foil) × avg_price(uncommon, foil) +
  P(rare_foil) × avg_price(rare, foil) +
  P(super_rare_foil) × avg_price(super_rare, foil) +
  P(legendary_foil) × avg_price(legendary, foil) +
  P(epic_foil) × avg_price(epic, foil) +
  P(iconic_foil) × avg_price(iconic, foil) +
  P(enchanted) × avg_price(enchanted, special)

// Bulk commons/uncommons (6 commons + 3 uncommons)
EV_bulk = 6 × floor_price(common) + 3 × floor_price(uncommon)

// Total Pack EV
Pack_EV = EV_rareplus + EV_foil + EV_bulk
```

### Key Features

- **Uses mean (average) prices** for each rarity/finish combination
- **No outlier removal** - includes all card prices
- **Bulk floor prices** - Set to $0 by default (configurable)
- **Simple arithmetic mean** - Sum all prices / count
- **Real-time calculation** - Recalculates when you change settings
- **Multiple scenarios** - Conservative/Base/Optimistic with different odds

### Pricing Data Used

- **Primary**: JustTCG real-time pricing
- **Fallback**: Dreamborn TCGPlayer pricing
- **Tertiary**: Lorcast pricing
- **NO unified pricing** - Uses raw sources directly

### Example Output (Set 9 - Fabled)

```
Pack EV: ~$2-4 (varies by scenario)
Box EV: ~$48-96
Case EV: ~$192-384
```

---

## Method 2: Realistic EV Script (scripts/calculate-realistic-ev.js)

**Used by**: Backend script (not shown in web UI)
**File**: `scripts/calculate-realistic-ev.js` - `calculatePackEV()` function
**Data source**: UNIFIED_PRICING.json (weighted average of sources)

### Algorithm

```javascript
// For each rarity, calculate trimmed mean (removes top/bottom 10%)
avg_price_trimmed(rarity) = trimmed_mean(all_prices, trim=0.1)

// Rare-or-higher slots (2 slots)
EV_rareplus = 2 × (
  P(rare) × trimmed_avg(rare, base) +
  P(super_rare) × trimmed_avg(super_rare, base) +
  P(legendary) × trimmed_avg(legendary, base) +
  P(epic) × trimmed_avg(epic, base) +
  P(iconic) × trimmed_avg(iconic, base)
)

// Foil slot (1 slot)
EV_foil =
  P(common_foil) × trimmed_avg(common, foil) +
  P(uncommon_foil) × trimmed_avg(uncommon, foil) +
  P(rare_foil) × trimmed_avg(rare, foil) +
  P(super_rare_foil) × trimmed_avg(super_rare, foil) +
  P(legendary_foil) × trimmed_avg(legendary, foil) +
  P(enchanted) × trimmed_avg(enchanted, foil)

// Guaranteed slots (6 commons + 3 uncommons)
EV_guaranteed = 6 × trimmed_avg(common, base) + 3 × trimmed_avg(uncommon, base)

// Total Pack EV
Pack_EV = EV_rareplus + EV_foil + EV_guaranteed
```

### Key Features

- **Uses trimmed mean** - Removes top/bottom 10% to eliminate outliers
- **Outlier protection** - Removes extreme chase cards from average
- **Unified pricing** - Weighted average (JustTCG 2x, Dreamborn 1x)
- **Single calculation** - Runs once when script is executed
- **Guaranteed slots valued** - Commons/uncommons use actual avg prices (not $0)
- **Stored in JSON** - Results saved to BOX_PRICING.json
- **NOT displayed to users** - Generated but unused by web UI

### Pricing Data Used

- **Unified pricing only** - UNIFIED_PRICING.json
- **Weighted average**: JustTCG (weight 2.0) + Dreamborn (weight 1.0)
- **Trimmed mean** - Excludes extreme outliers

### Example Output (Set 9 - Fabled)

Based on actual run:
```
Pack EV: $160.14
Box EV: $3,843.34
Case EV: $23,060.05

Value Ratio (Box): 28.6x (market $134.38)
Assessment: excellent_value
```

---

## Key Differences

| Aspect | Web App (model.js) | Realistic EV Script |
|--------|-------------------|---------------------|
| **Price Averaging** | Simple mean | Trimmed mean (removes outliers) |
| **Data Source** | Raw sources (JustTCG→Dreamborn→Lorcast) | UNIFIED_PRICING.json |
| **Outlier Handling** | No outlier removal | Removes top/bottom 10% |
| **Bulk Cards** | Floor price ($0 default) | Actual average prices |
| **Calculation Timing** | Real-time in browser | Pre-calculated by script |
| **Scenarios** | Multiple (Conservative/Base/Optimistic) | Single (Base only) |
| **User Visibility** | ✅ Displayed in web UI | ❌ Hidden (stored but not shown) |
| **Pack EV (typical)** | $2-4 | $160+ |
| **Difference** | Conservative | EXTREMELY inflated |

---

## Why the Huge Difference?

### The realistic-ev script is **NOT realistic** - it's broken!

The script calculates Pack EV of **$160.14**, which is absurd. Here's why:

### Problem 1: Wrong Formula for Guaranteed Slots

**Realistic EV script (WRONG)**:
```javascript
// Line 179-180 in calculate-realistic-ev.js
const commonEV = PACK_STRUCTURE.common * (rarityAverages.common?.base || 0.05);
const uncommonEV = PACK_STRUCTURE.uncommon * (rarityAverages.uncommon?.base || 0.15);
```

This says: "You get 6 commons at their average price"

**But that's wrong!** You don't get 6 *average-priced* commons. You get 6 *random* commons, most of which are near-bulk.

**Correct approach** (web app):
```javascript
// Use bulk floor prices (typically $0)
const bulk = 6 × $0.00 + 3 × $0.00 = $0
```

### Problem 2: Rare Slot Contribution Doubled

**Realistic EV script**:
```javascript
// Line 158 in calculate-realistic-ev.js
const rarityEV = (baseSlotContribution * PACK_STRUCTURE.rare_plus) +
                 (foilSlotContribution * PACK_STRUCTURE.foil);
```

This adds the base slot contribution for **both** the 2 rare-or-higher slots AND again for the foil slot.

**This double-counts the rare slot odds!**

### Problem 3: Average Prices Include Chase Cards

Even with trimmed mean, the averages are inflated because:
- Legendary average includes high-value chase cards
- Super rare average includes meta-playable cards
- The trimmed mean only removes the **extreme** outliers, not moderately expensive cards

### Actual Math Check

Let's verify the web app's calculation is more realistic:

**Set 9 Pack (Web App)**:
```
Rare slot 1: ~67% rare ($0.50) + 20% SR ($1.50) + 8% legendary ($10) = ~$1.50
Rare slot 2: ~$1.50
Foil slot: ~$0.50 (mostly common/uncommon foils)
Bulk (6C + 3U): $0
Total: ~$3.50 per pack
```

**Set 9 Box**: 24 packs × $3.50 = **~$84 EV**

**Market price**: $134.38

**Value ratio**: 0.625x (you lose money on average - expected for sealed products)

This makes sense! Sealed products typically have negative EV because:
1. Stores need profit margin
2. Distribution/shipping costs
3. Risk premium
4. Many commons/uncommons are near-worthless

---

## The Realistic EV Output is WRONG

Looking at the actual output stored in BOX_PRICING.json:

```json
{
  "realistic_estimated_value": {
    "ev": 3843.34,           // ❌ Box EV of $3,843 is absurd
    "pack_ev": 160.14,       // ❌ Pack EV of $160 is impossible
    "value_ratio": 28.6,     // ❌ 28x value is fantasy
    "value_assessment": "excellent_value"  // ❌ Wrong conclusion
  }
}
```

**Reality check**: If boxes had 28x value ratio, everyone would buy every box and immediately profit $3,700+ per box. The market would instantly correct this.

---

## Recommendations

### Option 1: Fix the Realistic EV Script

The script needs major fixes:
1. Remove the double-counting of rare slot contributions
2. Use bulk floor prices for commons/uncommons (not averages)
3. Better outlier handling (maybe bottom 25% of rarity prices)
4. Test against known EV data

### Option 2: Remove the Realistic EV Script

Since it's:
- Not used by the web app
- Producing wildly incorrect values
- Creating confusion
- Taking time in the update pipeline

It might be better to remove it entirely from `update-all.js`

### Option 3: Use It for Value Ratio Only

The script could be repurposed to:
- Compare calculated EV to market price
- Identify sets with unusual value ratios
- Flag potential data quality issues

But it would need the calculation fixes first.

---

## Current Recommendation

**The web app's EV calculation (model.js) is the correct one.**

It should be trusted over the "realistic" script, which despite its name, produces unrealistic results due to algorithmic errors.

The realistic-ev script should either be:
1. Fixed and validated against real-world data
2. Removed from the update pipeline
3. Clearly marked as experimental/broken

---

## Summary

| Calculator | Status | Accuracy | User-Facing |
|------------|--------|----------|-------------|
| **Web App (model.js)** | ✅ Working | ✅ Realistic (~$2-4 pack) | ✅ Yes |
| **Realistic Script** | ❌ Broken | ❌ Inflated (~$160 pack) | ❌ No |

**Bottom line**: The web app shows accurate EV. The "realistic-ev" script is broken and unused. We should either fix it or remove it from the pipeline.
