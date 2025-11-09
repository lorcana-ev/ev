# Manual Pricing Priority System

## Overview

The pricing system now prioritizes **Manual TCGPlayer** data as the most accurate source, giving it the highest weight in pricing calculations.

## Priority Hierarchy

### Weighting System

```
Manual TCGPlayer:  3.0x weight (HIGHEST - most accurate)
JustTCG API:       2.0x weight
Dreamborn:         1.0x weight (baseline)
```

### How It Works

When multiple sources have pricing for the same card:
1. **Manual pricing always contributes** (not just when JustTCG is missing)
2. Weighted average is calculated: `(Manual×3 + JustTCG×2 + Dreamborn×1) / total_weight`
3. Result is stored in `UNIFIED_PRICING.json`
4. Website automatically uses unified pricing

### Example Calculation

Card has pricing from all three sources:
- Manual: $100
- JustTCG: $95
- Dreamborn: $90

Calculation:
```
weighted_sum = (100 × 3.0) + (95 × 2.0) + (90 × 1.0)
             = 300 + 190 + 90 = 580

total_weight = 3.0 + 2.0 + 1.0 = 6.0

final_price = 580 / 6.0 = $96.67
```

Manual pricing pulls the average toward $100 (3x more influence than Dreamborn).

## Scripts

### 1. General Manual Entry (All Sets)
```bash
node scripts/manual-price-entry.js
```

**Purpose**: Fill pricing gaps for cards missing from JustTCG
- Shows cards that JustTCG doesn't have
- Filters to core sets only (001-010)
- Skips cards that already have manual pricing

**Use when**: New sets release and some cards aren't in JustTCG yet

### 2. Set 10 Specific Entry
```bash
node scripts/manual-price-entry-set10.js
```

**Purpose**: Verify/update ALL Set 10 cards
- Shows ALL Set 10 cards (even if JustTCG has pricing)
- Displays current prices from all sources
- Allows updating prices or keeping current values

**Use when**:
- Verifying Set 10 pricing accuracy
- Market prices change significantly
- You want to override automated pricing with verified TCGPlayer prices

### 3. Rebuild Unified Pricing
```bash
node scripts/rebuild-unified-pricing.js
```

**Purpose**: Combine all sources with weighted averaging
- Loads Dreamborn, JustTCG, and Manual pricing
- Applies 3x/2x/1x weights
- Generates `UNIFIED_PRICING.json`

**Run after**: Adding or updating manual prices

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│  Manual Price Entry Scripts                         │
│  ├─ manual-price-entry.js (gaps only)               │
│  └─ manual-price-entry-set10.js (all Set 10)        │
└────────────────┬────────────────────────────────────┘
                 ↓
         ┌───────────────────┐
         │ MANUAL_TCGPLAYER  │
         │      .json        │
         │  (your pricing)   │
         └───────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│  rebuild-unified-pricing.js                          │
│  ├─ Loads Manual (3x weight)                         │
│  ├─ Loads JustTCG (2x weight)                        │
│  └─ Loads Dreamborn (1x weight)                      │
└────────────────┬────────────────────────────────────┘
                 ↓
         ┌───────────────────┐
         │ UNIFIED_PRICING   │
         │      .json        │
         │  (weighted avg)   │
         └───────────────────┘
                 ↓
         ┌───────────────────┐
         │   Website UI      │
         │  (automatic)      │
         └───────────────────┘
```

## File Structure

### MANUAL_TCGPLAYER.json
```json
{
  "metadata": {
    "created_at": "2025-11-08T...",
    "last_updated": "2025-11-08T...",
    "note": "Manual price entries for cards not available in JustTCG"
  },
  "cards": {
    "010-236": {
      "base_price": null,
      "foil_price": 399.99,
      "source": "manual_tcgplayer",
      "reliability": "high",
      "last_updated": "2025-11-08T...",
      "tcgplayer_id": 660029,
      "card_name": "Cinderella - Dream Come True",
      "set_name": "Whispers in the Well",
      "rarity": "Enchanted"
    }
  }
}
```

### UNIFIED_PRICING.json (updated)
```json
{
  "metadata": {
    "version": "3.0.0",
    "source_weights": {
      "manual_tcgplayer": 3.0,
      "justtcg_api": 2.0,
      "dreamborn": 1.0
    },
    "note": "Manual TCGPlayer pricing is preferred as most accurate..."
  },
  "cards": {
    "010-236": {
      "cardId": "010-236",
      "sources": {
        "manual_tcgplayer": {
          "base_price": null,
          "foil_price": 399.99,
          "source": "manual_tcgplayer",
          "reliability": "high"
        }
      },
      "unified_pricing": {
        "base": null,
        "foil": 399.99,
        "confidence": "high",
        "base_method": "no_data",
        "foil_method": "single_source"
      }
    }
  }
}
```

## Confidence Levels

**High**:
- Multiple sources agree (weighted average)
- Manual pricing present
- JustTCG pricing present

**Medium**:
- Only Dreamborn pricing available

**Low**:
- No valid pricing data

## Website Integration

✅ **No code changes needed!**

The website automatically uses the most accurate pricing because:
1. It loads `UNIFIED_PRICING.json`
2. Unified pricing already contains weighted values
3. Manual pricing (3x weight) dominates the average

## Best Practices

### When to Use Manual Entry

1. **New Set Releases**: Enchanted/Iconic cards often missing from JustTCG initially
2. **Price Discrepancies**: Large variance between sources (>20%)
3. **High-Value Cards**: Cards >$50 where accuracy matters most
4. **Market Changes**: Sudden spikes or drops you've verified on TCGPlayer

### Workflow

**For New Set 10 Cards:**
```bash
# 1. Enter prices for all Set 10 cards
node scripts/manual-price-entry-set10.js

# 2. Rebuild unified pricing
node scripts/rebuild-unified-pricing.js

# 3. Verify results
cat data/UNIFIED_PRICING.json | jq '.cards["010-236"]'
```

**For Filling Gaps:**
```bash
# 1. Check what's missing
node scripts/rebuild-unified-pricing.js | grep "skipped"

# 2. Fill in missing prices
node scripts/manual-price-entry.js

# 3. Rebuild
node scripts/rebuild-unified-pricing.js
```

## Maintenance

### Updating Prices

To update existing manual prices:

**Option 1: Edit JSON directly**
```bash
vim data/MANUAL_TCGPLAYER.json
# Update prices, save
node scripts/rebuild-unified-pricing.js
```

**Option 2: Re-run Set 10 script**
```bash
node scripts/manual-price-entry-set10.js
# Shows current prices, enter new ones
```

### Removing Manual Prices

To let automated sources take over:
```bash
# Remove specific cards from MANUAL_TCGPLAYER.json
jq 'del(.cards["010-236"])' data/MANUAL_TCGPLAYER.json > tmp.json
mv tmp.json data/MANUAL_TCGPLAYER.json

# Rebuild to use automated sources
node scripts/rebuild-unified-pricing.js
```

## Version History

- **v3.0.0**: Manual pricing gets highest weight (3.0x)
- **v2.1.0**: Manual pricing added (2.0x weight, gap-fill only)
- **v2.0.0**: Multi-source with JustTCG + Dreamborn

## Technical Details

### Weight Calculation

See `scripts/rebuild-unified-pricing.js:341-363` for base price calculation:

```javascript
sourcesWithBase.forEach(source => {
  let weight = 1.0;
  if (source.source === 'manual_tcgplayer') {
    weight = 3.0;  // Highest priority
  } else if (source.source === 'justtcg_api') {
    weight = 2.0;
  }
  weightedSum += source.base_price * weight;
  totalWeight += weight;
});

basePrice = Math.round((weightedSum / totalWeight) * 100) / 100;
```

### Website Usage

The website loads unified pricing at startup:

`src/lib/data.js:9`:
```javascript
fetch('./data/UNIFIED_PRICING.json').then(r => r.json())
```

And indexes it using `prices.js:208-304`:
```javascript
export function indexPrices(pricesBlob) {
  // Handles UNIFIED_PRICING.json format (v3.0.0+)
  for (const [cardId, cardData] of Object.entries(pricesBlob.cards)) {
    if (cardData.base !== null && cardData.base > 0) {
      idx.set(`${cardId}-base`, {
        market: cardData.base,  // Already weighted!
        ...
      });
    }
  }
}
```

The website automatically uses the weighted prices - no changes needed!
