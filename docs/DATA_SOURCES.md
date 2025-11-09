# Data Sources Overview

This document explains the data sources used in the Lorcana EV pricing system.

## Summary

**4 Pricing Sources** (with priority ordering):
1. TCGPlayer (highest priority - manually verified prices)
2. JustTCG (automated, real-time)
3. Dreamborn (automated, TCGPlayer mirror)
4. Lorcast (automated, foil pricing support)

## Pricing Sources

All sources provide card pricing information. The website uses a priority-based fallback system.

### 1. TCGPlayer (HIGHEST PRIORITY)
- **File**: `data/MANUAL_TCGPLAYER.json`
- **Source**: Manual entry via interactive scripts
- **Reliability**: High (direct from TCGPlayer.com)
- **Priority**: 1st choice
- **Current Coverage**: ~34-42 cards (Set 10 enchanted/legendary/iconic)
- **Update Method**: Run `node scripts/manual-price-entry-set10.js`
- **Use Case**: High-value cards where accuracy is critical

### 2. JustTCG API
- **File**: `data/JUSTTCG.json`
- **Source**: JustTCG API (automated)
- **Reliability**: High
- **Priority**: 2nd choice
- **Current Coverage**: ~2,300 cards
- **Update Method**: Run `node scripts/update-all.js`
- **Use Case**: Primary automated pricing source

### 3. Dreamborn
- **File**: `data/USD.json`
- **Source**: Dreamborn.ink API (automated)
- **Reliability**: Medium
- **Priority**: 3rd choice
- **Current Coverage**: ~2,335 cards
- **Update Method**: Run `node scripts/update-all.js`
- **Use Case**: Fallback when JustTCG unavailable

### 4. Lorcast
- **File**: `data/LORCAST.json`
- **Source**: Lorcast API (automated)
- **Reliability**: Medium
- **Priority**: 4th choice (last fallback)
- **Current Coverage**: ~2,350 cards
- **Update Method**: Run `node scripts/update-all.js`
- **Use Case**: Provides separate base/foil pricing
- **Note**: Also provides TCGPlayer ID mapping used by other sources

## How Priority Works

The website uses **simple priority fallback** (first available source wins):

```
IF manual_tcgplayer has price:
    USE manual_tcgplayer price
ELSE IF justtcg has price:
    USE justtcg price
ELSE IF dreamborn has price:
    USE dreamborn price
ELSE IF lorcast has price:
    USE lorcast price
ELSE:
    No pricing available
```

This happens **in real-time** in the user's browser when loading the website.

### Example: Card 010-003

This card has pricing from multiple sources:

| Source | Base Price | Foil Price | Used? |
|--------|-----------|-----------|-------|
| TCGPlayer | $9.63 | $13.45 | ✅ YES |
| JustTCG | $7.66 | N/A | ❌ No (TCGPlayer has priority) |
| Dreamborn | $9.48 | $14.09 | ❌ No (TCGPlayer has priority) |
| Lorcast | $0.36 | $2.00 | ❌ No (TCGPlayer has priority) |

**Result**: Uses TCGPlayer ($9.63 base, $13.45 foil) for all calculations

## File Roles

| File | Type | Priority | Used For |
|------|------|----------|----------|
| MANUAL_TCGPLAYER.json | Pricing | 1st | TCGPlayer (manually verified prices) |
| JUSTTCG.json | Pricing | 2nd | Automated JustTCG API pricing |
| USD.json | Pricing | 3rd | Dreamborn automated pricing |
| LORCAST.json | Pricing + Metadata | 4th | Base/foil pricing + TCGPlayer ID mapping |
| cards.json | Card Data | N/A | Complete card database (from Dreamborn) |

## Website Integration

The website (`src/lib/data.js`) loads all pricing sources and uses the `MultiSourcePricing` class to manage priority:

```javascript
// Load all sources
const allPricingSources = {
  manual_tcgplayer: manualTcgPlayerData,  // 1st priority
  justtcg: justTcgData,                   // 2nd priority
  dreamborn: dreambornPrices,             // 3rd priority
  lorcast: lorcastData                    // 4th priority
};

// MultiSourcePricing handles fallback automatically
const multiSourcePricing = new MultiSourcePricing(allPricingSources);
```

## User Controls

Users can customize pricing priority in the **EV Calculator** UI:
- **Pricing Priority** dropdowns let users select their preferred sources
- **Price Comparisons** tab shows prices from all sources side-by-side
- Default: TCGPlayer → JustTCG → Dreamborn → Lorcast

## Common Questions

**Q: When does manual pricing get used?**

A: Manual pricing ALWAYS takes precedence when available. Use it for:
- High-value enchanted/legendary cards where accuracy matters
- New releases not yet in automated sources
- Overriding automated prices you've verified on TCGPlayer

**Q: What if manual price and JustTCG price differ?**

A: Manual price wins. The priority system doesn't average - it picks the first available source.

**Q: Can I change the priority order?**

A: Yes! In the EV Calculator, use the "Pricing Priority" dropdowns to customize your preferred order.

**Q: How often should I update manual prices?**

A: Update when:
- New sets release (enchanted/legendary often missing from JustTCG initially)
- Market prices change significantly (>20% variance)
- You want to verify high-value cards (>$50)

## Scripts

### Update Automated Pricing
```bash
# Fetch JustTCG, Dreamborn, and Lorcast pricing
node scripts/update-all.js
```

### Manual Price Entry
```bash
# Fill gaps in core sets (cards not in JustTCG)
node scripts/manual-price-entry.js

# Verify Set 10 enchanted/legendary cards (recommended)
node scripts/manual-price-entry-set10.js
```

## Technical Implementation

See `src/lib/prices.js` for the `MultiSourcePricing` class that handles priority-based fallback:
- `indexManualTcgPlayerPricing()` - Indexes MANUAL_TCGPLAYER.json format
- `indexJustTcgPricing()` - Indexes JustTCG batch format
- `indexDreambornPricing()` - Indexes Dreamborn USD.json format
- `indexLorcastPricing()` - Indexes Lorcast pricing with separate usd/usd_foil
- `getPrice()` - Returns first available price based on priority
