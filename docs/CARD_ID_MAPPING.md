# Card ID Mapping System

## Overview

The Lorcana EV application uses a **canonical card ID format** for all pricing lookups across different data sources. This document explains the ID mapping system and how it ensures consistent pricing data access.

## The Problem

Different data sources use different card ID formats:

| Source | ID Format | Example |
|--------|-----------|---------|
| **cards.json** (Dreamborn) | Hash-based | `010/8384b543c69a62baaba2fe2b4b3dab2b87123648` |
| **JustTCG API** | Set-Number | `010-001` |
| **Lorcast API** | Set-Number | `010-001` |
| **TCGPlayer** | Product ID (numeric) | `660029` |
| **Manual Pricing** | Set-Number | `010-001` |

Without a mapping system, pricing lookups fail because the hash-based IDs don't match the set-number format used by pricing sources.

## The Solution

We use an **authoritative mapping file** that bridges all ID formats:

```
Hash ID (cards.json) 
    ↓
Authoritative Mapping (using TCGPlayer IDs as bridge)
    ↓
Canonical ID (set-number format: "010-001")
    ↓
Pricing lookups work across all sources
```

## Files

### 1. AUTHORITATIVE_CARD_ID_MAPPING.json

**Location**: `data/AUTHORITATIVE_CARD_ID_MAPPING.json`

**Purpose**: Comprehensive mapping with full card data and pricing availability tracking.

**Structure**:
```json
{
  "metadata": {
    "created_at": "2025-11-09T...",
    "version": "1.0.0",
    "sources": { ... }
  },
  "cards": {
    "010-001": {
      "canonical_id": "010-001",
      "set_id": "010",
      "number": "1",
      "name": "Baloo",
      "title": "Easygoing Bear",
      "rarity": "rare",
      "identifiers": {
        "dreamborn_hash": "010/8384b543c69a62baaba2fe2b4b3dab2b87123648",
        "tcgplayer_id": 660029,
        "justtcg_available": true,
        "lorcast_available": true
      },
      "pricing_availability": {
        "dreamborn": true,
        "justtcg": true,
        "lorcast": true,
        "manual_tcgplayer": false
      }
    }
  }
}
```

### 2. CARD_ID_LOOKUP.json

**Location**: `data/CARD_ID_LOOKUP.json`

**Purpose**: Simplified, fast lookup for hash ↔ canonical ID conversions.

**Structure**:
```json
{
  "hash_to_canonical": {
    "010/8384b543c69a62baaba2fe2b4b3dab2b87123648": "010-001"
  },
  "canonical_to_hash": {
    "010-001": "010/8384b543c69a62baaba2fe2b4b3dab2b87123648"
  }
}
```

## How It Works

### 1. Mapping Creation (Script)

**Script**: `scripts/create-authoritative-id-mapping.js`

```bash
node scripts/create-authoritative-id-mapping.js
```

The script:
1. Loads all data sources (cards.json, LORCAST.json, JUSTTCG.json, USD.json, MANUAL_TCGPLAYER.json)
2. Uses **TCGPlayer IDs as the authoritative bridge** between sources
3. Maps hash-based IDs to canonical set-number format
4. Tracks pricing availability across all sources
5. Generates two files:
   - `AUTHORITATIVE_CARD_ID_MAPPING.json` (comprehensive)
   - `CARD_ID_LOOKUP.json` (simplified for web app)

### 2. Runtime Usage (Web App)

**File**: `src/lib/data.js`

```javascript
// 1. Load the mapping
const cardIdMapping = await loadCardIdMapping();
// Map: hash ID → canonical ID

// 2. Build printings with canonical IDs
const printings = buildPrintings(cards, cardIdMapping);
// Each printing gets a printing_id like "010-001-base"

// 3. Pricing lookups use canonical format
multiSourcePricing.getPrice("010-001-base")  // ✅ Works!
```

## Canonical ID Format

**Format**: `{set}-{number}`
- Set: 3-digit set code (e.g., "010")
- Number: 3-digit zero-padded card number (e.g., "001")
- **Example**: `010-001`

**Why this format?**
- Used by JustTCG, Lorcast, and Manual TCGPlayer sources
- Human-readable and sortable
- Consistent across 96%+ of pricing data

## TCGPlayer IDs as Bridge

TCGPlayer product IDs serve as the authoritative bridge because:
1. **Universal**: Most cards have TCGPlayer IDs
2. **Stable**: Don't change over time
3. **Available**: Lorcast provides TCGPlayer IDs for all cards
4. **Authoritative**: TCGPlayer is the primary pricing source

The mapping process:
```
1. Extract TCGPlayer ID from Dreamborn pricing data (hash entry)
2. Look up the same TCGPlayer ID in Lorcast (has canonical ID)
3. Map: Dreamborn hash → TCGPlayer ID → Lorcast canonical ID
```

## Updating the Mapping

Run the mapping script whenever:
- New cards are added to cards.json
- New pricing sources are integrated
- Data sources are updated significantly

```bash
cd /home/b/src/lorcana-ev/ev
node scripts/create-authoritative-id-mapping.js
```

The web app will automatically use the updated mapping on next page load.

## Statistics

Current mapping coverage (as of 2025-11-09):
- **Total cards**: 2,382
- **Cards with TCGPlayer ID**: 2,317 (97.3%)
- **Hash IDs successfully mapped**: 229 of 272 (84.2%)
- **Pricing coverage**:
  - Dreamborn: 2,331 cards (97.9%)
  - JustTCG: 2,286 cards (96.0%)
  - Lorcast: 2,303 cards (96.7%)
  - Manual TCGPlayer: 37 cards (1.6%)

## Troubleshooting

### Issue: Pricing not showing for some cards

**Check**:
1. Is the card ID in `CARD_ID_LOOKUP.json`?
2. Does the card have a TCGPlayer ID in `AUTHORITATIVE_CARD_ID_MAPPING.json`?
3. Is pricing available in any source for this canonical ID?

**Solution**: Run `create-authoritative-id-mapping.js` to rebuild the mapping.

### Issue: Hash ID not mapping

**Cause**: Card has no TCGPlayer ID in Dreamborn pricing data or Lorcast.

**Workaround**: The system falls back to constructing the canonical ID from set + number.

## Related Files

- `src/lib/data.js` - Loads mapping and builds printings with canonical IDs
- `src/lib/prices.js` - Uses canonical IDs for all pricing lookups
- `scripts/rebuild-unified-pricing.js` - Uses same approach for pricing file generation
- `data/LORCAST.json` - Source of TCGPlayer IDs
- `data/cards.json` - Source of hash-based IDs

## See Also

- [DATA_SOURCES.md](./DATA_SOURCES.md) - Pricing source priority
- [DATA_UPDATE_PIPELINE.md](./DATA_UPDATE_PIPELINE.md) - How to update data

