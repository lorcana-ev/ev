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
├── data/                    # JSON data files from dreamborn.ink
│   ├── cards.json          # Complete card database
│   ├── filters.json        # Filter options  
│   ├── sorts.json          # Sort options
│   └── USD.json            # Price data from TCGPlayer
├── config/
│   └── pack_model.json     # Pack opening model and odds
├── src/
│   ├── lib/
│   │   ├── data.js         # Data loading and normalization
│   │   ├── prices.js       # Price indexing and summaries  
│   │   ├── model.js        # EV calculations and Monte Carlo
│   │   └── util.js         # Utility functions
│   ├── app.js              # Main application
│   └── styles.css          # Styling
├── scripts/
│   ├── verify-data.js      # Data verification (Node.js)
│   ├── verify-data.rb      # Data verification (Ruby)
│   ├── serve.js            # Development server
│   └── test-app.js         # Module testing
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

- **Card Data**: [dreamborn.ink](https://dreamborn.ink) - Community-maintained Lorcana database
- **Price Data**: TCGPlayer - Current market pricing
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

### Updating Data
To update card or price data:
1. Replace files in the `data/` directory
2. Run verification script to check data integrity
3. Restart the application

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