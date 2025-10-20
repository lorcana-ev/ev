# Lorcana EV - Data Update Pipeline

## Overview

This document explains the data update pipeline for the Lorcana Expected Value (EV) calculator. The pipeline fetches pricing and card data from multiple external sources that the web application uses directly.

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
│                    EXTERNAL DATA SOURCES                         │
├─────────────────────────────────────────────────────────────────┤
│  JustTCG API          Lorcast API         Dreamborn CDN         │
│  ↓                    ↓                    ↓                     │
│  JUSTTCG.json         LORCAST.json         USD.json             │
│  (pricing)            (cards)              (pricing + cards)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WEB APPLICATION                               │
├─────────────────────────────────────────────────────────────────┤
│  • Loads all three sources                                       │
│  • Automatic fallback: JustTCG → Dreamborn → Lorcast            │
│  • EV calculated in browser using config/pack_model.json        │
│  • Real-time recalculation based on user settings               │
└─────────────────────────────────────────────────────────────────┘
```

## File Descriptions

### Data Files

| File | Source | Description | Size | Update Frequency |
|------|--------|-------------|------|------------------|
| `JUSTTCG.json` | JustTCG API | Pricing with variants and trends | ~5MB | Daily/Weekly |
| `LORCAST.json` | Lorcast API | Card metadata and analysis | Variable | Weekly |
| `USD.json` | Dreamborn | TCGPlayer pricing | ~900KB | Daily/Weekly |
| `cards.json` | Dreamborn | Card database | ~1.6MB | When sets release |
| `cards-formatted.json` | Dreamborn | Alias of cards.json | ~1.6MB | Auto-created |

### Configuration Files

| File | Description |
|------|-------------|
| `config/pack_model.json` | Pack structure, rarity odds, boxes per case |

## Scripts

### Main Update Script

#### `scripts/update-all.js`
**Main entry point** - Fetches all data from external sources.

```bash
node scripts/update-all.js
```

**What it does:**
1. Fetches JustTCG pricing data
2. Fetches Lorcast card data
3. Fetches Dreamborn pricing + cards

**Duration**: ~1-2 minutes
**Rate limits**: Respects all API rate limits
**Output**: Updates 5 data files

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

### Analysis Scripts

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
```

**Update only JustTCG:**
```bash
node scripts/fetch-all-justtcg-sets.js
```

**Update only Lorcast:**
```bash
node scripts/fetch-lorcast-data.js
```

### Quality Checks

**Find pricing discrepancies:**
```bash
node scripts/compare-pricing-sources.js
```

Check the output in `data/PRICE_DISCREPANCIES.json` for cards that need manual verification.

## How the Web App Uses the Data

### Price Lookup with Fallback

The web application (src/lib/prices.js) implements a **multi-source pricing system**:

1. **Load all sources** - JustTCG, Dreamborn, Lorcast
2. **Index each source** - Create fast lookup maps
3. **Fallback chain** - JustTCG → Dreamborn → Lorcast
4. **Return first available** - Use the first source that has the card

### EV Calculation (src/lib/model.js)

The web app calculates EV **in the browser** using:

```javascript
Pack EV = Rare-or-higher slots + Foil slot + Bulk floor

Rare-or-higher (2 slots):
  = 2 × Σ(rarity_probability × average_price)

Foil slot (1 slot):
  = Σ(rarity_probability × average_foil_price)

Bulk (6 commons + 3 uncommons):
  = 6 × floor_price + 3 × floor_price
```

**Key features**:
- Uses **mean prices** for each rarity
- Configurable scenarios (Conservative/Base/Optimistic)
- Real-time recalculation
- No preprocessing required

## Data Freshness

| Data Type | Recommended Update Frequency |
|-----------|------------------------------|
| Pricing (new sets) | Daily |
| Pricing (older sets) | Weekly |
| Card database | When new sets release |

## Troubleshooting

### "No JustTCG data found"
- Run `fetch-all-justtcg-sets.js` first
- Check API access

### Missing card data
- Run `fetch-dreamborn-pricing.js`
- Verify cards.json was created

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
```

## Next Steps After Update

1. **Start the website**: `npm run dev`
2. **Review discrepancies** (optional): `node scripts/compare-pricing-sources.js`
3. **Verify data**: Check console for any errors

## Maintenance

### Adding New Data Sources

1. Create fetch script in `scripts/`
2. Add to `update-all.js` pipeline
3. Update `src/lib/prices.js` to index the new source
4. Add to fallback chain
5. Document in this file

### Modifying Pack Model

Edit `config/pack_model.json` with new odds. The web app will use them automatically.

### Archive Old Data

```bash
# Backup before major updates
mkdir -p backups/$(date +%Y%m%d)
cp data/*.json backups/$(date +%Y%m%d)/
```

## Architecture Decisions

### Why Multiple Sources?
- **Cross-validation** of pricing
- **Better coverage** (some cards only in one source)
- **Resilience** if one source is down
- **Market comparison** between different platforms

### Why Client-Side EV Calculation?
- **No preprocessing** needed
- **Real-time recalculation** as user changes settings
- **Transparent** - user can see how it's calculated
- **Flexible** - easy to adjust scenarios

### Why Direct Source Usage (No Unified Pricing)?
- **Simpler pipeline** - fewer intermediate files
- **Transparency** - clear which source provided each price
- **Flexibility** - users can choose priority
- **Performance** - browser handles fallback efficiently

## Version History

- **2025-10-20**: Simplified pipeline - removed unused unified pricing and EV calculation
- **2025-10-20**: Added cards.json fetching from Dreamborn
- **2025-10-20**: Created comprehensive documentation
