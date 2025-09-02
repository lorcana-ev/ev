// src/lib/setviewer.js
// Set viewer functionality for detailed card browsing

import { fmt } from './model.js';

export class SetViewer {
  constructor() {
    this.currentSet = null;
    this.filteredCards = [];
    this.allCards = [];
    this.priceIndex = null;
    this.currentFilters = {
      rarity: '',
      sortBy: 'number',
      viewMode: 'grid'
    };
  }

  initialize(cards, priceIndex, multiSourcePricing = null) {
    this.allCards = cards;
    this.priceIndex = priceIndex;
    this.multiSourcePricing = multiSourcePricing;
    this.currentPricingPriority = null;
    this.setupEventListeners();
  }
  
  setPricingPriority(priority) {
    this.currentPricingPriority = priority;
    // Re-render if we have cards to show the updated pricing
    if (this.filteredCards.length > 0) {
      this.updateCards();
    }
  }

  setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Filters
    const rarityFilter = document.getElementById('rarityFilter');
    const sortBy = document.getElementById('sortBy');
    const viewMode = document.getElementById('viewMode');

    if (rarityFilter) {
      rarityFilter.addEventListener('change', () => {
        this.currentFilters.rarity = rarityFilter.value;
        this.updateCards();
      });
    }

    if (sortBy) {
      sortBy.addEventListener('change', () => {
        this.currentFilters.sortBy = sortBy.value;
        this.updateCards();
      });
    }

    if (viewMode) {
      viewMode.addEventListener('change', () => {
        this.currentFilters.viewMode = viewMode.value;
        this.updateViewMode();
      });
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // If switching to set viewer, update it
    if (tabName === 'setviewer') {
      this.updateCards();
    }
  }

  setCurrentSet(setCode) {
    this.currentSet = setCode;
    this.updateCards();
  }

  updateCards() {
    if (!this.currentSet || !this.allCards.length) return;

    // Filter cards by current set
    let cards = this.allCards.filter(card => {
      const cardSet = card.setId || card.id?.split('-')[0];
      return cardSet === this.currentSet;
    });

    // Apply rarity filter
    if (this.currentFilters.rarity) {
      cards = cards.filter(card => 
        card.rarity?.toLowerCase() === this.currentFilters.rarity.toLowerCase()
      );
    }

    // Sort cards
    cards = this.sortCards(cards, this.currentFilters.sortBy);

    this.filteredCards = cards;
    this.updateRarityFilter(cards);
    this.updateStats(cards);
    this.renderCards();
  }

  sortCards(cards, sortBy) {
    return cards.sort((a, b) => {
      switch (sortBy) {
        case 'number':
          const aNum = parseInt(a.number || a.id?.split('-')[1] || '0');
          const bNum = parseInt(b.number || b.id?.split('-')[1] || '0');
          return aNum - bNum;
          
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
          
        case 'rarity':
          const rarityOrder = ['common', 'uncommon', 'rare', 'super rare', 'legendary', 'epic', 'iconic', 'enchanted'];
          const aRarity = rarityOrder.indexOf(a.rarity?.toLowerCase()) ?? 999;
          const bRarity = rarityOrder.indexOf(b.rarity?.toLowerCase()) ?? 999;
          return aRarity - bRarity;
          
        case 'cost':
          return (a.cost || 0) - (b.cost || 0);
          
        case 'price':
          const aPrice = this.getCardPrice(a, 'base') || 0;
          const bPrice = this.getCardPrice(b, 'base') || 0;
          return bPrice - aPrice; // Descending for price
          
        default:
          return 0;
      }
    });
  }

  updateRarityFilter(cards) {
    const rarityFilter = document.getElementById('rarityFilter');
    if (!rarityFilter) return;

    const rarities = [...new Set(cards.map(card => card.rarity).filter(Boolean))];
    rarities.sort();

    // Clear existing options (except "All Rarities")
    rarityFilter.innerHTML = '<option value="">All Rarities</option>';
    
    rarities.forEach(rarity => {
      const option = document.createElement('option');
      option.value = rarity;
      option.textContent = rarity.charAt(0).toUpperCase() + rarity.slice(1);
      rarityFilter.appendChild(option);
    });

    rarityFilter.value = this.currentFilters.rarity;
  }

  updateStats(cards) {
    const statsEl = document.getElementById('setStats');
    if (!statsEl) return;

    const total = cards.length;
    const withPricing = cards.filter(card => 
      this.getCardPrice(card, 'base') || this.getCardPrice(card, 'foil')
    ).length;
    
    const pricingPercent = total > 0 ? (withPricing / total * 100).toFixed(1) : '0';
    
    // Show current pricing source
    const pricingSource = this.currentPricingPriority ? 
      `Priority: ${this.currentPricingPriority.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' → ')}` :
      'Source: Unified Pricing';

    statsEl.innerHTML = `
      <div>Showing ${total} cards</div>
      <div>Pricing coverage: ${pricingPercent}%</div>
      <div class="pricing-source">${pricingSource}</div>
    `;
  }

  updateViewMode() {
    const cardGrid = document.getElementById('cardGrid');
    const cardTable = document.getElementById('cardTable');
    
    if (this.currentFilters.viewMode === 'grid') {
      if (cardGrid) cardGrid.style.display = 'grid';
      if (cardTable) cardTable.style.display = 'none';
    } else {
      if (cardGrid) cardGrid.style.display = 'none';
      if (cardTable) cardTable.style.display = 'block';
    }
  }

  renderCards() {
    if (this.currentFilters.viewMode === 'grid') {
      this.renderGridView();
    } else {
      this.renderTableView();
    }
    this.updateViewMode();
  }

  renderGridView() {
    const gridEl = document.getElementById('cardGrid');
    if (!gridEl) return;

    if (this.filteredCards.length === 0) {
      gridEl.innerHTML = '<div class="no-cards">No cards found matching the current filters.</div>';
      return;
    }

    const cardsHtml = this.filteredCards.map(card => {
      const basePrice = this.getCardPrice(card, 'base');
      const foilPrice = this.getCardPrice(card, 'foil');

      return `
        <div class="card-item" data-card-id="${card.id}">
          <div class="card-image">
            ${this.getCardImageHtml(card, '')}
          </div>
          <div class="card-info">
            <div class="card-name">${card.name || 'Unknown'}</div>
            ${card.title ? `<div class="card-subtitle">${card.title}</div>` : ''}
            <div class="card-stats">
              ${card.cost !== undefined ? `<span class="card-cost">${card.cost}</span>` : ''}
              <span class="card-rarity">${card.rarity || 'Unknown'}</span>
            </div>
            <div class="card-pricing">
              <div class="price-base">
                <div class="price-label">Base</div>
                <div class="price-value ${!basePrice ? 'price-missing' : ''}">
                  ${basePrice ? fmt(basePrice) : '—'}
                </div>
              </div>
              <div class="price-foil">
                <div class="price-label">Foil</div>
                <div class="price-value ${!foilPrice ? 'price-missing' : ''}">
                  ${foilPrice ? fmt(foilPrice) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    gridEl.innerHTML = cardsHtml;
  }

  renderTableView() {
    const tableBodyEl = document.getElementById('cardTableBody');
    if (!tableBodyEl) return;

    if (this.filteredCards.length === 0) {
      tableBodyEl.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No cards found matching the current filters.</td></tr>';
      return;
    }

    const rowsHtml = this.filteredCards.map(card => {
      const basePrice = this.getCardPrice(card, 'base');
      const foilPrice = this.getCardPrice(card, 'foil');
      const rarityClass = (card.rarity || '').toLowerCase().replace(/\s+/g, '-');

      return `
        <tr data-card-id="${card.id}">
          <td>
            ${this.getCardImageHtml(card, 'card-table-image')}
          </td>
          <td class="card-table-name">
            <div class="name">${card.name || 'Unknown'}</div>
            ${card.title ? `<div class="subtitle">${card.title}</div>` : ''}
          </td>
          <td>${card.cost !== undefined ? card.cost : '—'}</td>
          <td>${card.type || '—'}</td>
          <td><span class="rarity-badge rarity-${rarityClass}">${card.rarity || 'Unknown'}</span></td>
          <td>${basePrice ? fmt(basePrice) : '—'}</td>
          <td>${foilPrice ? fmt(foilPrice) : '—'}</td>
        </tr>
      `;
    }).join('');

    tableBodyEl.innerHTML = rowsHtml;
  }

  getCardPrice(card, variant = 'base') {
    if (!card.id) return null;
    
    // Use multi-source pricing if available and priority is set
    if (this.multiSourcePricing && this.currentPricingPriority) {
      const priceData = this.multiSourcePricing.getPrice(`${card.id}-${variant}`, this.currentPricingPriority);
      if (priceData) {
        return priceData.market || priceData.median || priceData.low || null;
      }
    }
    
    // Fallback to unified pricing
    if (this.priceIndex) {
      const priceData = this.priceIndex.get(`${card.id}-${variant}`);
      return priceData?.market || priceData?.median || priceData?.low || null;
    }
    
    return null;
  }

  getCardImageUrl(card) {
    if (!card.id) return null;
    
    // Use the correct CDN format: https://cdn.dreamborn.ink/images/en/cards/{card-id}
    return `https://cdn.dreamborn.ink/images/en/cards/${card.id}`;
  }

  // Generate image HTML with fallback handling
  getCardImageHtml(card, className = 'card-table-image') {
    const imageUrl = this.getCardImageUrl(card);
    
    if (!imageUrl) {
      return `<div class="${className}" style="display: flex; align-items: center; justify-content: center; background: var(--bg-primary); color: var(--text-tertiary); font-size: 12px;">No Image</div>`;
    }
    
    // Use a much simpler onerror handler
    return `<img class="${className}" src="${imageUrl}" alt="${card.name}" onerror="this.style.display='none'; this.nextSibling.style.display='flex';"><div class="${className}" style="display: none; align-items: center; justify-content: center; background: var(--bg-primary); color: var(--text-tertiary); font-size: 12px;">No Image</div>`;
  }
}

// Export singleton instance
export const setViewer = new SetViewer();