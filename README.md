# Lorcana EV Calculator

A static web application for calculating Expected Value (EV) of Disney Lorcana trading card packs, boxes, and cases.

## Features

- 🃏 **Set Selection** - Calculate EV for specific Lorcana sets (The First Chapter, Rise of the Floodborn, etc.)
- 📊 **Real-time EV Calculations** - Pack, box (24 packs), and case (96 packs) expected values
- 🎯 **Multiple Scenarios** - Conservative, base, and optimistic pack opening odds
- 💰 **Price Analysis** - Set-specific rarity breakdowns with mean and median pricing
- 🎲 **Hit Odds** - Probability calculations for rare card pulls
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Quick Start

### Option 1: Using Node.js (Recommended)

```bash
# Install Node.js 18+ if not already installed
# Clone or download this repository

# Start the development server
npm run dev

# Open your browser to http://localhost:3000
```

### Option 2: Using any HTTP server

```bash
# Using Python 3
python -m http.server 3000

# Using Python 2
python -m SimpleHTTPServer 3000

# Using PHP
php -S localhost:3000

# Then open http://localhost:3000 in your browser
```

### Option 3: GitHub Pages

This application is designed to work on GitHub Pages. Simply push to a GitHub repository and enable Pages in the repository settings.

## Data Verification

Before using the application, you can verify the integrity of your data:

```bash
# JavaScript version
npm run verify

# Ruby version (requires Ruby)
npm run verify-ruby
```

## Project Structure

```
lorcana-ev/
├── data/                    # JSON data files
│   ├── cards.json          # Complete card database (from dreamborn.ink)
│   ├── filters.json        # Filter options (from dreamborn.ink)
│   ├── sorts.json          # Sort options (from dreamborn.ink)
│   ├── USD.json            # Dreamborn/TCGPlayer pricing
│   ├── DREAMBORN.json      # Alternative name for USD.json (TCGPlayer pricing)
│   ├── JUSTTCG.json        # JustTCG API pricing data
│   ├── LORCAST.json        # Lorcast API pricing and card data
│   └── UNIFIED_PRICING.json # Combined pricing from all sources
├── config/
│   └── pack_model.json     # Pack opening model and odds
├── src/
│   ├── lib/
│   │   ├── data.js         # Data loading and normalization
│   │   ├── prices.js       # Multi-source price indexing
│   │   ├── model.js        # EV calculations and Monte Carlo
│   │   └── util.js         # Utility functions
│   ├── app.js              # Main application
│   └── styles.css          # Styling
├── scripts/
│   ├── fetch-dreamborn-pricing.js     # Fetch Dreamborn/TCGPlayer pricing (RECOMMENDED)
│   ├── fetch-lorcast-data.js          # Fetch Lorcast pricing
│   ├── fetch-core-sets-justtcg.js     # Fetch JustTCG pricing (RECOMMENDED)
│   ├── rebuild-unified-pricing.js     # Rebuild unified pricing from all sources
│   ├── fetch-all-justtcg-sets.js      # Fetch all JustTCG sets including promos
│   ├── batch-justtcg-pricing.js       # Legacy batch fetching script
│   ├── fetch-justtcg-prices.js        # Legacy card-by-card fetching
│   ├── verify-data.js                 # Data verification (Node.js)
│   ├── verify-data.rb                 # Data verification (Ruby)
│   ├── serve.js                       # Development server
│   └── test-app.js                    # Module testing
└── index.html              # Main HTML file
```

## How It Works

### Pack Model
- **12 cards per pack**: 6 commons, 3 uncommons, 2 rare-or-higher, 1 foil (any rarity)
- **Configurable odds**: Different scenarios for rare/legendary pull rates
- **Enchanted cards**: Special high-value variants with very low pull rates

### EV Calculation
1. **Price Data**: Loads current market prices from TCGPlayer
2. **Rarity Analysis**: Calculates average prices by rarity and finish (base/foil)
3. **Expected Value**: Multiplies pull odds by average card values
4. **Scenarios**: Adjusts calculations based on conservative/optimistic assumptions

### Supported Features
- **Set Selection** - Choose from 13 different Lorcana sets including main releases and special sets
- **Price Type Selection** - Market, median, or low price calculations
- **Scenario Adjustment** - Conservative, base, or optimistic pack opening assumptions
- **Real-time Recalculation** - Instant updates when changing settings
- **Set-Specific Analysis** - Rarity breakdowns and hit odds per selected set
- **Cross-Set Comparison** - Compare EV across different sets

## Data Sources

This application uses multiple pricing sources to provide comprehensive market data:

- **Card Data**: [dreamborn.ink](https://dreamborn.ink) - Community-maintained Lorcana database
- **Price Data** (multiple sources with automatic fallback):
  - **JustTCG** (primary) - Real-time market pricing via JustTCG API
  - **Dreamborn** (secondary) - TCGPlayer pricing from dreamborn.ink
  - **Lorcast** (tertiary) - Additional pricing data from Lorcast API
- **Pack Model**: Community estimates based on observed pack opening data

## Development

### Testing the Application
```bash
# Test core modules
npm run test

# Test set filtering functionality
npm run test-sets

# Verify data integrity
npm run verify

# Start development server
npm run dev
```

### Updating Pricing Data
```bash
# Update all pricing sources
npm run update-dreamborn    # Fetch latest from Dreamborn/TCGPlayer
npm run update-justtcg      # Fetch from JustTCG (with resume & retry)
npm run update-lorcast      # Fetch from Lorcast

# Rebuild unified pricing after updates
npm run rebuild-pricing

# Verify everything is working
npm run verify
```

### Updating Data

The application uses three separate pricing data files that you can update independently:

#### Updating Dreamborn Pricing
Dreamborn pricing comes from TCGPlayer via dreamborn.ink's API.

**Recommended method (automated):**
```bash
npm run update-dreamborn
# or: node scripts/fetch-dreamborn-pricing.js
```

This script:
- Fetches latest pricing from `https://dreamborn.ink/cache/prices/USD.json`
- Backs up existing `USD.json` to `USD.json.backup`
- Shows download progress and coverage statistics
- Suggests next steps (rebuild unified pricing, verify data)

**Manual method:**
1. Download from https://dreamborn.ink/cache/prices/USD.json
2. Save as `data/USD.json`
3. Rebuild unified pricing: `node scripts/rebuild-unified-pricing.js`
4. Verify data: `npm run verify`

**Note**: The `USD.json` file is also referenced as `DREAMBORN.json` in some scripts. This is the TCGPlayer pricing data in Dreamborn's format.

#### Updating JustTCG Pricing
JustTCG pricing is fetched via the JustTCG API:

**Recommended method (most recent):**
```bash
npm run update-justtcg
# or: node scripts/fetch-core-sets-justtcg.js
```

This script:
- **Fetches only core sets** (001-009), excluding promos and special products
- **Resumes where it left off** - won't refetch cards already in the database
- **Automatic retry logic** - waits 30s, 60s, 90s when rate limited (up to 3 retries)
- **Smart completion tracking** - only refetches incomplete sets (< 90%)
- **Rate limiting** - 2 seconds between requests to respect API limits

**Usage tips:**
- Run multiple times if rate limited - it will resume automatically
- The script shows progress like "Resuming from offset 140 (127 cards already fetched)"
- Sets with 90%+ completion are considered done and won't be refetched within 7 days
- Check progress with: `node -e "const d=require('./data/JUSTTCG.json'); console.log('Total:',Object.keys(d.cards).length,'cards')"`

**Alternative scripts (older, not recommended):**
- `fetch-all-justtcg-sets.js` - Fetches ALL sets including promos (may hit rate limits)
- `batch-justtcg-pricing.js` - Older batch fetching script (superseded by core-sets version)
- `fetch-justtcg-prices.js` - Original test script, searches card-by-card (very slow)

**Rate Limiting**: The JustTCG API has daily limits. The recommended script respects these limits and won't refetch recent data.

#### Updating Lorcast Pricing
Lorcast pricing is fetched via the Lorcast API:

**Recommended method:**
```bash
npm run update-lorcast
# or: node scripts/fetch-lorcast-data.js
```

This script:
- Fetches all sets and cards from Lorcast API
- Creates/updates `data/LORCAST.json`
- Includes comprehensive card metadata
- Uses 1-second delays to respect rate limits

#### Price Source Priority
The application uses this fallback hierarchy:
1. **JustTCG** - Primary source (most current market data)
2. **Dreamborn** - Secondary source (TCGPlayer pricing)
3. **Lorcast** - Tertiary source (additional coverage)

If a card's price isn't found in JustTCG, the app automatically falls back to Dreamborn, then Lorcast.

#### Data File Summary
```
data/
├── USD.json              # Dreamborn/TCGPlayer pricing (from dreamborn.ink)
├── DREAMBORN.json        # Same data as USD.json (some scripts use this name)
├── JUSTTCG.json          # JustTCG API pricing data
├── LORCAST.json          # Lorcast API pricing and card data
├── UNIFIED_PRICING.json  # Combined pricing from all sources
├── cards.json            # Card database from dreamborn.ink
├── filters.json          # Filter options
└── sorts.json            # Sort options
```

### Customizing Pack Odds
Edit `config/pack_model.json` to adjust:
- Cards per pack/box/case
- Rarity slot configurations  
- Pull rate scenarios
- Bulk card floor prices

## Browser Compatibility

- Modern browsers supporting ES6 modules
- Chrome/Firefox/Safari/Edge (recent versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Make your changes
3. Test with `npm run verify` and `node scripts/test-app.js`
4. Submit a pull request

## Disclaimers

- This tool is for **educational purposes only**
- EV calculations are estimates based on current market data
- Actual pack contents and values may vary significantly
- Not affiliated with Disney or Ravensburger
- Use at your own risk for any purchasing decisions

## License

MIT License - see LICENSE file for details