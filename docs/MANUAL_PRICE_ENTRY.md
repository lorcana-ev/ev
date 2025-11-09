# Manual Price Entry Guide

This guide explains how to manually enter pricing for cards that aren't available in JustTCG's API.

## Overview

Some cards (especially newly released enchanted/iconic cards) may not be available in JustTCG's database immediately after release. The manual price entry system allows you to:

1. Identify **core set cards** (001-010) missing from JustTCG that have TCGPlayer listings
2. Open each card's TCGPlayer page in your browser
3. Manually enter Near Mint Base and Foil prices
4. Store this data in `MANUAL_TCGPLAYER.json` for use in pricing calculations

**Note:** This tool only processes core sets. Promo sets (P1, P2, P3, C1, D23) are excluded.

## When to Use Manual Price Entry

Run manual price entry when:
- New sets are released and enchanted/iconic cards aren't in JustTCG yet
- You notice specific high-value cards missing pricing data
- The unified pricing summary shows cards you care about are skipped

## How to Run

```bash
node scripts/manual-price-entry.js
```

## Interactive Process

The script will:

1. **Scan for missing cards**: Finds cards in Lorcast that aren't in JustTCG
2. **Filter for TCGPlayer links**: Only shows cards that have TCGPlayer product pages
3. **Present each card**:
   ```
   [1/15] 010-236: Cinderella - Dream Come True
      Set: Whispers in the Well
      Number: 236/204
      Rarity: Enchanted
      TCGPlayer ID: 660029

      Press Enter to open TCGPlayer, or type "skip"/"quit":
   ```

4. **Open browser**: Opens the TCGPlayer product page automatically

5. **Prompt for prices**:
   ```
      Base (Normal) price (or press Enter to skip): $
      Foil (Holofoil) price (or press Enter to skip): $399.99
   ```

6. **Save and continue**: Auto-saves every 5 entries

## Commands

During the interactive session:
- **Enter**: Open TCGPlayer page for current card
- **skip** or **s**: Skip this card
- **quit** or **q**: Exit and save progress
- **Enter** (at price prompt): Skip that specific price variant

## Data Storage

Manual prices are saved to `data/MANUAL_TCGPLAYER.json`:

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

## Integration with Unified Pricing

Manual TCGPlayer data is automatically integrated when you run:

```bash
node scripts/rebuild-unified-pricing.js
```

### Priority Rules

1. **JustTCG data is always preferred** - Manual entries are ONLY used for cards not in JustTCG
2. **High confidence** - Manual TCGPlayer data has the same confidence/weight as JustTCG (2x vs Dreamborn's 1x)
3. **Transparent sourcing** - Each card shows which sources contributed to its pricing

### Example Output

```
🎯 Set 10 (Whispers in the Well) Coverage:
   Total cards with pricing: 231
   Cards with JustTCG data: 227
   Cards with Dreamborn data: 229
   Cards with Manual TCGPlayer data: 4
   Cards with multiple sources: 226
```

## Workflow Example

### Step 1: Check for Missing Cards

```bash
node scripts/rebuild-unified-pricing.js
```

Look for output like:
```
⚠️  Skipped Cards (no valid pricing):
   Set 010: 14 cards
      010-223: Not in any source
      010-224: Not in any source
      010-236: Not in any source
```

### Step 2: Run Manual Entry

```bash
node scripts/manual-price-entry.js
```

The script shows:
```
📊 Found 14 cards missing from JustTCG with TCGPlayer links
```

### Step 3: Enter Prices

For each card, the browser opens and you enter prices from the TCGPlayer page.

### Step 4: Rebuild Unified Pricing

```bash
node scripts/rebuild-unified-pricing.js
```

Now those cards will have pricing:
```
📝 Sample Set 10 cards:
   010-236:
     Base: N/A (no_data)
     Foil: $399.99 (single_source)
     Sources: manual_tcgplayer
     Confidence: high
```

## Tips

- **Start with most important cards**: Use "skip" to jump past cards you don't need immediately
- **Save progress frequently**: Auto-saves every 5 entries, but you can quit anytime
- **Re-run anytime**: Already-entered prices are skipped automatically
- **Update prices**: Delete specific entries from `MANUAL_TCGPLAYER.json` to re-enter updated prices

## Maintenance

### Updating Stale Prices

1. Open `data/MANUAL_TCGPLAYER.json`
2. Delete the entry for cards you want to update
3. Run `node scripts/manual-price-entry.js` again
4. The script will prompt for those cards again

### Removing Manual Prices

When JustTCG adds a card:
- Manual pricing is automatically ignored (JustTCG takes priority)
- You can leave old entries in place - they won't affect calculations
- Or clean up manually if desired

## Troubleshooting

### "Browser didn't open automatically"

The script will print the URL - just copy/paste it into your browser.

### "No cards need manual pricing"

All cards either:
- Have JustTCG pricing already
- Don't have TCGPlayer links in Dreamborn data
- Already have manual pricing entries

### "Invalid price error"

Enter numbers only (e.g., `199.99` not `$199.99`). Press Enter to skip if you don't want to enter a price.

## Data Sources Priority

Final priority order in unified pricing:

1. **JustTCG** (weight: 2.0, automatic updates)
2. **Manual TCGPlayer** (weight: 2.0, manual entry, only used when JustTCG missing)
3. **Dreamborn** (weight: 1.0, automatic updates)

This ensures manual data fills gaps without overriding automated sources.
