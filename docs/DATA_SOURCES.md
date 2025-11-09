# Data Sources Overview

This document clarifies the different data sources used in the Lorcana EV pricing system.

## Summary

**3 Pricing Sources** + **1 Metadata Source** = **4 Data Files Total**

## Pricing Sources (3)

These sources provide actual card pricing information:

### 1. Manual TCGPlayer (HIGHEST PRIORITY)
- **File**: `data/MANUAL_TCGPLAYER.json`
- **Source**: Manual entry via interactive scripts
- **Reliability**: High (direct from TCGPlayer.com)
- **Priority**: 1st choice
- **Current Coverage**: ~42 cards
- **Use Case**: Fill gaps and verify high-value cards

### 2. JustTCG API
- **File**: `data/JUSTTCG.json`
- **Source**: JustTCG API (automated)
- **Reliability**: High
- **Priority**: 2nd choice
- **Current Coverage**: ~2,300 cards
- **Use Case**: Primary automated pricing source

### 3. Dreamborn
- **File**: `data/USD.json`
- **Source**: Dreamborn.ink API (automated)
- **Reliability**: Medium
- **Priority**: 3rd choice (fallback)
- **Current Coverage**: ~2,335 cards
- **Use Case**: Backup pricing when JustTCG unavailable

## Metadata Source (1)

This source provides supporting data but NOT pricing:

### Lorcast (METADATA ONLY)
- **File**: `data/LORCAST.json`
- **Source**: Lorcast API
- **Purpose**: TCGPlayer ID mapping
- **NOT USED FOR**: Pricing
- **Use Case**: Remap Dreamborn's hash-based card IDs to proper format

**Example**: Dreamborn uses `010/8818aec4...` for some cards. Lorcast provides the TCGPlayer ID that maps this to `010-236`.

## How Preference Works

The unified pricing system uses **simple preference** (not weighted averaging):

```
IF manual_tcgplayer has price:
    USE manual_tcgplayer price
ELSE IF justtcg_api has price:
    USE justtcg_api price
ELSE IF dreamborn has price:
    USE dreamborn price
ELSE:
    No pricing available
```

### Example: Card 010-003

This card has pricing from all three sources:

| Source | Base Price | Foil Price |
|--------|-----------|-----------|
| Manual TCGPlayer | $9.63 | $13.45 |
| JustTCG | $7.66 | N/A |
| Dreamborn | $9.48 | $14.09 |

**Result**: Uses Manual TCGPlayer ($9.63 base, $13.45 foil)

The unified pricing file stores:
```json
{
  "unified_pricing": {
    "base": 9.63,
    "foil": 13.45,
    "base_method": "manual",
    "foil_method": "manual",
    "base_source": "manual_tcgplayer",
    "foil_source": "manual_tcgplayer"
  }
}
```

## File Roles

| File | Type | Used For |
|------|------|----------|
| MANUAL_TCGPLAYER.json | Pricing | User-entered prices from TCGPlayer |
| JUSTTCG.json | Pricing | Automated API pricing |
| USD.json | Pricing | Dreamborn automated pricing |
| LORCAST.json | Metadata | TCGPlayer ID mapping ONLY |
| UNIFIED_PRICING.json | Output | Combined pricing using preference system |

## Verification

To verify the data sources, check the metadata in `UNIFIED_PRICING.json`:

```bash
jq '.metadata' data/UNIFIED_PRICING.json
```

Expected output:
```json
{
  "pricing_sources": {
    "dreamborn": 2335,
    "justtcg_api": 2300,
    "manual_tcgplayer": 42
  },
  "source_priority": [
    "manual_tcgplayer",
    "justtcg_api",
    "dreamborn"
  ],
  "data_files_used": {
    "pricing": [
      "MANUAL_TCGPLAYER.json",
      "JUSTTCG.json",
      "USD.json"
    ],
    "metadata": [
      "LORCAST.json"
    ]
  },
  "note": "Simple preference: Manual TCGPlayer > JustTCG > Dreamborn. First available source is used. Lorcast is metadata-only."
}
```

## Common Questions

**Q: Why do we have 4 data files but only 3 pricing sources?**

A: LORCAST.json is metadata-only. It provides TCGPlayer IDs to remap Dreamborn's hash-based entries, but doesn't contain any pricing information itself.

**Q: When does manual pricing get used?**

A: Manual pricing ALWAYS takes precedence when available. It's used for both:
- Filling gaps (cards not in JustTCG)
- Verifying/overriding automated pricing for high-value cards

**Q: What if manual price and JustTCG price differ?**

A: Manual price wins. The preference system doesn't average or blend - it picks the first available source according to priority.

**Q: How often should I update manual prices?**

A: Update when:
- New sets release (enchanted/legendary cards often missing initially)
- Market prices change significantly (>20% variance)
- High-value cards (>$50) need verification

## Scripts

### Manual Entry
```bash
# Fill gaps in core sets
node scripts/manual-price-entry.js

# Verify Set 10 enchanted/legendary cards
node scripts/manual-price-entry-set10.js
```

### Rebuild Unified Pricing
```bash
# Combine all sources with preference system
node scripts/rebuild-unified-pricing.js
```

## Technical Implementation

See `scripts/rebuild-unified-pricing.js:224-268` for the complete implementation with inline comments explaining each data source's role.
