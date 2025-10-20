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

## Data Updates

### Quick Start - Update Everything

```bash
node scripts/update-all.js
```

This single command updates all pricing and card data:
- ✓ **JustTCG API** - Real-time pricing with variants and trends
- ✓ **Lorcast API** - Card metadata and rarity analysis
- ✓ **Dreamborn** - TCGPlayer pricing + complete card database
- ✓ **Unified Pricing** - Weighted average of all sources
- ✓ **Box Pricing** - Sealed product prices with realistic EV

**Duration**: ~2-3 minutes | **Output**: 6 data files updated

📖 **Documentation**:
- [Quick Reference](README_DATA_UPDATES.md) - Commands and common issues
- [Complete Guide](docs/DATA_UPDATE_PIPELINE.md) - Full pipeline documentation
- [Recent Updates](docs/UPDATES_2025-10-20.md) - What changed today

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

### Individual Data Source Updates

If you need to update only specific sources (see [docs](docs/DATA_UPDATE_PIPELINE.md) for details):

```bash
# Update individual sources
node scripts/fetch-dreamborn-pricing.js  # Dreamborn pricing + cards
node scripts/fetch-all-justtcg-sets.js   # JustTCG pricing
node scripts/fetch-lorcast-data.js       # Lorcast metadata

# After updating sources, rebuild unified pricing
node scripts/rebuild-unified-pricing.js

# Recalculate EV
node scripts/calculate-realistic-ev.js
```

### Data Files Overview

| File | Source | Purpose | Updated By |
|------|--------|---------|------------|
| `USD.json` | Dreamborn | TCGPlayer pricing | fetch-dreamborn-pricing.js |
| `cards.json` | Dreamborn | Card database | fetch-dreamborn-pricing.js |
| `JUSTTCG.json` | JustTCG API | Real-time pricing | fetch-all-justtcg-sets.js |
| `LORCAST.json` | Lorcast API | Card metadata | fetch-lorcast-data.js |
| `UNIFIED_PRICING.json` | Combined | Weighted average pricing | rebuild-unified-pricing.js |
| `BOX_PRICING.json` | JustTCG + Calc | Box/case prices + EV | extract-box-pricing.js + calculate-realistic-ev.js |

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