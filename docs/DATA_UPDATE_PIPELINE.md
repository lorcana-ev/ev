# Lorcana EV - Data Update Pipeline

## Overview

This document explains the complete data update pipeline for the Lorcana Expected Value (EV) calculator. The pipeline fetches pricing and card data from multiple sources, unifies them, and calculates realistic EV for sealed products.

## Data Sources

### 1. **JustTCG API**
- **URL**: `https://api.justtcg.com/v1/cards`
- **What it provides**: Real-time pricing data with historical trends
- **Output**: `data/JUSTTCG.json`
- **Script**: `scripts/fetch-all-justtcg-sets.js`
- **Coverage**: ~2,112 cards with Near Mint pricing for base and foil variants
- **Rate limiting**: 500ms delay between requests
- **Features**:
  - Multiple condition/printing variants
  - Price history (7d, 30d)
  - Price change trends
  - Statistical analysis (std dev, IQR, trend slopes)

### 2. **Lorcast API**
- **URL**: `https://api.lorcast.com/v0`
- **What it provides**: Comprehensive card database with metadata
- **Output**: `data/LORCAST.json`
- **Script**: `scripts/fetch-lorcast-data.js`
- **Coverage**: ~2,228 cards across all sets
- **Rate limiting**: 1 second delay between requests
- **Features**:
  - Card attributes (cost, rarity, type, etc.)
  - Set information
  - Variant analysis (enchanted, epic, iconic)
  - Foil availability patterns

### 3. **Dreamborn**
- **URL**:
  - Pricing: `https://dreamborn.ink/cache/prices/USD.json`
  - Cards: `https://dreamborn.ink/cache/en/cards.json`
- **What it provides**: Card database + TCGPlayer pricing
- **Output**:
  - `data/USD.json` (pricing)
  - `data/cards.json` (card database)
  - `data/cards-formatted.json` (alias for compatibility)
- **Script**: `scripts/fetch-dreamborn-pricing.js`
- **Coverage**: 2,181 cards with 84.8% base and 95.8% foil pricing
- **Features**:
  - TCGPlayer market prices
  - Complete card metadata
  - All sets including promos (001-010, C1, D23, P1)

## Data Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAW DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│  JustTCG API          Lorcast API         Dreamborn             │
│  ↓                    ↓                    ↓                     │
│  JUSTTCG.json         LORCAST.json         USD.json             │
│  (pricing)            (cards)              (pricing)            │
│                                             cards.json           │
│                                             (cards)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA UNIFICATION                              │
├─────────────────────────────────────────────────────────────────┤
│  rebuild-unified-pricing.js                                      │
│  ↓                                                               │
│  UNIFIED_PRICING.json                                            │
│  (weighted average of Dreamborn + JustTCG)                       │
│  • JustTCG weighted 2x (more reliable)                           │
│  • Dreamborn weighted 1x                                         │
│  • Confidence scores: high/medium/low                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS & CALCULATIONS                       │
├─────────────────────────────────────────────────────────────────┤
│  extract-box-pricing.js        calculate-realistic-ev.js         │
│  ↓                              ↓                                │
│  BOX_PRICING.json              BOX_PRICING.json (updated)        │
│  (raw prices)                  (+ realistic EV calculations)     │
│                                                                  │
│  compare-pricing-sources.js                                      │
│  ↓                                                               │
│  PRICE_DISCREPANCIES.json                                        │
│  (quality control)                                               │
└─────────────────────────────────────────────────────────────────┘
```

## File Descriptions

### Input Files

| File | Source | Description | Size | Update Frequency |
|------|--------|-------------|------|------------------|
| `JUSTTCG.json` | JustTCG API | Pricing with variants and trends | ~5MB | Run update script |
| `LORCAST.json` | Lorcast API | Card metadata and analysis | - | Run update script |
| `USD.json` | Dreamborn | TCGPlayer pricing | ~900KB | Run update script |
| `cards.json` | Dreamborn | Card database | ~1.6MB | Run update script |
| `cards-formatted.json` | Dreamborn | Alias of cards.json | ~1.6MB | Auto-created |

### Processed Files

| File | Creator | Description | Dependencies |
|------|---------|-------------|--------------|
| `UNIFIED_PRICING.json` | rebuild-unified-pricing.js | Weighted pricing from all sources | USD.json, JUSTTCG.json |
| `BOX_PRICING.json` | extract-box-pricing.js | Box/case market prices + EV | JUSTTCG.json |
| `PRICE_DISCREPANCIES.json` | compare-pricing-sources.js | Quality control report | USD.json, JUSTTCG.json, LORCAST.json |

### Configuration Files

| File | Description |
|------|-------------|
| `config/pack_model.json` | Pack structure, rarity odds, boxes per case |

## Scripts

### Core Update Scripts

#### `scripts/update-all.js`
**Main entry point** - Runs the complete update pipeline.

```bash
node scripts/update-all.js
```

**What it does:**
1. Fetches JustTCG pricing data
2. Fetches Lorcast card data
3. Fetches Dreamborn pricing + cards
4. Rebuilds unified pricing
5. Extracts box pricing
6. Calculates realistic EV

**Duration**: ~2-3 minutes
**Rate limits**: Respects all API rate limits
**Output**: Updates all data files

#### `scripts/fetch-all-justtcg-sets.js`
Fetches pricing from JustTCG API for all available sets.

**Output**: `data/JUSTTCG.json`

**Features**:
- Batch fetching (20 cards per request)
- Rate limiting (500ms between requests)
- Variant extraction (Near Mint Normal/Foil)
- Set discovery and mapping

#### `scripts/fetch-lorcast-data.js`
Fetches card data and metadata from Lorcast API.

**Output**: `data/LORCAST.json`

**Features**:
- Set enumeration
- Card analysis (variants, foil patterns)
- Rarity distribution analysis

#### `scripts/fetch-dreamborn-pricing.js`
Fetches both pricing and card database from Dreamborn.

**Output**:
- `data/USD.json`
- `data/cards.json`
- `data/cards-formatted.json`

**Features**:
- Automatic backup of existing files
- Progress indicators
- Summary statistics

#### `scripts/rebuild-unified-pricing.js`
Combines pricing from Dreamborn and JustTCG into a unified dataset.

**Input**: `USD.json`, `JUSTTCG.json`
**Output**: `UNIFIED_PRICING.json`

**Algorithm**:
- Single source: Use that price
- Multiple sources: Weighted average
  - JustTCG weight: 2.0 (higher reliability)
  - Dreamborn weight: 1.0
- Confidence scoring:
  - `high`: Multiple sources or JustTCG only
  - `medium`: Single Dreamborn source
  - `low`: No data

### Analysis Scripts

#### `scripts/extract-box-pricing.js`
Extracts sealed product pricing from JustTCG data.

**Input**: `JUSTTCG.json`
**Output**: `BOX_PRICING.json`

**What it extracts**:
- Booster box prices
- Case prices
- Product types
- TCGPlayer IDs

**Note**: Does NOT calculate EV (that's done by calculate-realistic-ev.js)

#### `scripts/calculate-realistic-ev.js`
Calculates Expected Value for sealed products using proper rarity odds.

**Input**:
- `UNIFIED_PRICING.json`
- `cards-formatted.json`
- `config/pack_model.json`
- `BOX_PRICING.json`

**Output**: Updates `BOX_PRICING.json` with EV calculations

**Algorithm**:
1. Categorize cards by rarity
2. Calculate trimmed mean prices (removes outliers)
3. Apply rarity odds from pack model
4. Calculate contributions:
   - 2 rare-or-higher slots
   - 1 foil slot
   - 6 common slots
   - 3 uncommon slots
5. Compute pack EV
6. Scale to box (24 packs) and case (4 boxes)

**Pack Model** (from `config/pack_model.json`):
```json
{
  "cards_per_pack": 12,
  "packs_per_box": 24,
  "boxes_per_case": 4,
  "rare_slot_odds": {
    "rare": 0.6765,
    "super rare": 0.1977,
    "legendary": 0.0833,
    "epic": 0.041667,
    "iconic": 0.000833
  },
  "foil_odds": {
    "common": 0.65,
    "uncommon": 0.18,
    "rare": 0.065,
    "super rare": 0.018,
    "legendary": 0.001,
    "epic": 0.006,
    "iconic": 0.001,
    "enchanted": 0.009
  }
}
```

#### `scripts/compare-pricing-sources.js`
Quality control - finds major discrepancies between pricing sources.

**Input**: `USD.json`, `JUSTTCG.json`, `LORCAST.json`
**Output**: `PRICE_DISCREPANCIES.json`

**Flags cards where**:
- Price difference > 20% OR
- Price difference > $5

**Common issues found**:
- Promo card pricing (D23, P1 prefixes)
- Foil variant mismatches
- Outdated pricing

## Usage Guide

### Initial Setup

```bash
# Clone the repository
cd lorcana-ev/ev

# Install dependencies (if any)
npm install
```

### Regular Updates

**Run the complete pipeline:**
```bash
node scripts/update-all.js
```

This is the recommended way to update all data.

### Partial Updates

**Update only pricing data:**
```bash
node scripts/fetch-dreamborn-pricing.js
node scripts/rebuild-unified-pricing.js
```

**Update only JustTCG:**
```bash
node scripts/fetch-all-justtcg-sets.js
node scripts/rebuild-unified-pricing.js
```

**Recalculate EV only:**
```bash
node scripts/calculate-realistic-ev.js
```

### Quality Checks

**Find pricing discrepancies:**
```bash
node scripts/compare-pricing-sources.js
```

Check the output in `data/PRICE_DISCREPANCIES.json` for cards that need manual verification.

## Data Freshness

| Data Type | Recommended Update Frequency |
|-----------|------------------------------|
| Pricing (new sets) | Daily |
| Pricing (older sets) | Weekly |
| Card database | When new sets release |
| EV calculations | After each pricing update |

## Troubleshooting

### "No JustTCG data found"
- Run `fetch-all-justtcg-sets.js` first
- Check API key in script if rate limited

### "Cannot find UNIFIED_PRICING.json"
- Run `rebuild-unified-pricing.js`
- Ensure USD.json and JUSTTCG.json exist

### "Set 9 cards with pricing: 0"
- Update UNIFIED_PRICING.json
- Ensure latest data was fetched

### Box prices only for Fabled (Set 9)
- This is expected - JustTCG only tracks current sealed products
- Older sets may not have box pricing available

### High price discrepancies
- Common for promo cards (P1, D23)
- Check `PRICE_DISCREPANCIES.json` for details
- Manually verify on TCGPlayer if needed

## API Rate Limits

| API | Limit | Our Delay | Notes |
|-----|-------|-----------|-------|
| JustTCG | Unknown | 500ms | Conservative approach |
| Lorcast | Unknown | 1000ms | Conservative approach |
| Dreamborn | None (CDN) | None | Cached static files |

## Expected Outputs

After running `update-all.js`, you should see:

```
✓ JustTCG pricing (data/JUSTTCG.json)
✓ Lorcast card data (data/LORCAST.json)
✓ Dreamborn pricing (data/USD.json)
✓ Dreamborn cards (data/cards.json, data/cards-formatted.json)
✓ Unified pricing (data/UNIFIED_PRICING.json)
✓ Box pricing (data/BOX_PRICING.json)
✓ Realistic EV calculations (BOX_PRICING.json updated)
```

## Next Steps After Update

1. **Review discrepancies**: Check `PRICE_DISCREPANCIES.json`
2. **Verify EV calculations**: Run `calculate-realistic-ev.js`
3. **Start the website**: `npm run dev` or serve static files
4. **Monitor for errors**: Check console output for warnings

## Maintenance

### Adding New Data Sources

1. Create fetch script in `scripts/`
2. Add to `update-all.js` pipeline
3. Update `rebuild-unified-pricing.js` to include new source
4. Document in this file

### Modifying Pack Model

Edit `config/pack_model.json` with new odds, then run:
```bash
node scripts/calculate-realistic-ev.js
```

### Archive Old Data

```bash
# Backup before major updates
mkdir -p backups/$(date +%Y%m%d)
cp data/*.json backups/$(date +%Y%m%d)/
```

## Architecture Decisions

### Why Weighted Average?
- JustTCG has more real-time data and better variant tracking
- Dreamborn provides good baseline but may lag
- 2:1 weighting balances reliability vs coverage

### Why Trimmed Mean for EV?
- Removes extreme outliers (chase cards)
- More realistic for typical pack opening
- Still accounts for high-value cards in distribution

### Why Not TCGPlayer Direct?
- No public API available
- Dreamborn already aggregates TCGPlayer data
- JustTCG provides better historical tracking

### Why Multiple Sources?
- Cross-validation of pricing
- Better coverage (some cards only in one source)
- Resilience if one source is down

## Contact & Support

For issues with this pipeline:
1. Check this documentation
2. Review script output for errors
3. Verify API endpoints are accessible
4. Check data file timestamps

## Version History

- **2025-10-20**: Complete pipeline documentation created
- **2025-10-20**: Added cards.json fetching from Dreamborn
- **2025-10-20**: Integrated EV calculations into update-all.js
- **2025-10-20**: Fixed unified pricing rebuild process
