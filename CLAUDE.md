# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the `lorcana-ev` project - a static website for calculating Expected Value (EV) for Disney Lorcana trading card packs, boxes, and cases. It's designed as a pure client-side application that can be hosted on GitHub Pages.

## Repository Structure

```
lorcana-ev/
├── data/                    # JSON data files from dreamborn.ink API
│   ├── cards.json          # Complete card database (1.1MB)
│   ├── filters.json        # Filter options (323KB)
│   ├── sorts.json          # Sort options (98KB)
│   └── USD.json            # Price data (574KB)
├── docs/                   # Documentation
│   └── implementation-plan.md  # Detailed implementation plan
└── ev/                     # Working directory (current location)
```

## Data Architecture

### Card Data Structure
The `cards.json` file contains comprehensive Lorcana card data with this structure:
- `id`: Unique card identifier (e.g., "001-001")
- `name`: Card name
- `setId`: Set identifier
- `title`: Card subtitle
- `cost`: Ink cost
- `type`: "character", "action", "item", or "song"
- `rarity`: "common", "uncommon", "rare", "super rare", "legendary"
- `variants`: Array including "base" and "foil" variants
- `colors`: Array of ink colors (e.g., ["amber"])
- Card stats: `lore`, `strength`, `willpower`
- Additional metadata: `franchise`, `illustrator`, etc.

### Price Data Structure
The `USD.json` file contains pricing information:
- Keyed by card ID (e.g., "001-061")
- Contains `base` and `foil` variant pricing
- Price sources include TCGPlayer (`TP`) with `price` and `link` data

## Implementation Plan

The project implements a static website with the following architecture (as detailed in `docs/implementation-plan.md`):

### Planned File Structure
```
lorcana-ev/
├── data/                   # JSON data files (existing)
├── config/
│   └── pack_model.json     # Pack opening model configuration
├── src/
│   ├── lib/
│   │   ├── data.js         # Data loading and normalization
│   │   ├── prices.js       # Price indexing and summaries
│   │   ├── model.js        # EV calculations and Monte Carlo
│   │   └── util.js         # Utility functions
│   ├── app.js              # Main application orchestration
│   └── styles.css          # CSS styling
└── index.html              # Main HTML entry point
```

### Key Features
1. **Set Selection**: Choose from 13 different Lorcana sets for analysis
2. **EV Calculations**: Pack, box (24 packs), and case (96 packs) expected value
3. **Price Scenarios**: Conservative, base, and optimistic scenarios
4. **Set-Specific Analysis**: Rarity summaries filtered by selected set
5. **Hit Odds**: Probability calculations for rare pulls
6. **Monte Carlo Simulation**: Statistical modeling of pack openings

### Pack Model Configuration
- 12 cards per pack
- 2 rare-or-higher slots, 1 foil slot, 6 commons, 3 uncommons
- Configurable odds for different rarities
- Support for "Top Chase" cards (enchanted/legendary variants)

## Development Guidelines

### Data Handling
- All data files are large (>100KB) - use appropriate tools for reading
- Card IDs follow format: `{setId}-{number}` (e.g., "001-001")
- Price data may be incomplete - handle missing values gracefully
- Foil variants have separate pricing from base cards

### No Build System Required
- Pure vanilla JavaScript with ES modules
- No package.json or build configuration needed
- Static assets only - suitable for GitHub Pages hosting

### Key Calculations
- EV calculations based on rarity odds and average prices
- Support for bulk card values (commons/uncommons floor price)
- Trimmed mean calculations to handle price outliers
- Probability calculations for "at least one" scenarios

## Common Tasks

### Data Analysis
```bash
# Sample card data structure
head -20 ./data/cards.json

# Check price data format  
head -20 ./data/USD.json

# Test set-specific functionality
npm run test-sets

# View implementation details
cat ./docs/implementation-plan.md
```

### File Navigation
- Card database: `data/cards.json:1-100` (sample entries)
- Price data: `data/USD.json:1-50` (pricing structure)
- Implementation plan: `docs/implementation-plan.md:1-50` (project overview)

## Important Notes

- This is a data-driven application focused on statistical analysis
- All calculations should handle edge cases (missing prices, invalid data)
- The implementation plan in `docs/implementation-plan.md` provides complete code examples
- Price data comes from external APIs and may have missing or stale entries
- Foil cards typically have different (higher) values than base variants