// Proxies.js - Card proxy generator for Lorcana
class ProxyGenerator {
  constructor() {
    this.allCards = [];
    this.selectedCards = [];
    this.loadedImages = new Map();

    this.initializeElements();
    this.bindEvents();
    this.loadCardData();
  }

  initializeElements() {
    this.cardInput = document.getElementById('cardInput');
    this.loadCardsBtn = document.getElementById('loadCards');
    this.generatePDFBtn = document.getElementById('generatePDF');
    this.clearAllBtn = document.getElementById('clearAll');
    this.messageArea = document.getElementById('messageArea');
    this.previewSection = document.getElementById('previewSection');
    this.cardPreviews = document.getElementById('cardPreviews');
    this.cardCount = document.getElementById('cardCount');
    this.loadingIndicator = document.getElementById('loadingIndicator');
  }

  bindEvents() {
    this.loadCardsBtn.addEventListener('click', () => this.loadCards());
    this.generatePDFBtn.addEventListener('click', () => this.generatePDF());
    this.clearAllBtn.addEventListener('click', () => this.clearAll());
  }

  async loadCardData() {
    try {
      this.showMessage('Loading card database...', 'info');
      const response = await fetch('./data/cards-formatted.json');
      if (!response.ok) throw new Error('Failed to load card data');

      this.allCards = await response.json();
      this.showMessage(`Loaded ${this.allCards.length} cards from database`, 'success');
      this.loadCardsBtn.disabled = false;
    } catch (error) {
      console.error('Error loading card data:', error);
      this.showMessage('Failed to load card database. Please refresh the page.', 'error');
    }
  }

  parseCardInput() {
    const input = this.cardInput.value.trim();
    if (!input) return [];

    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    const cards = [];
    const notFound = [];

    for (const line of lines) {
      const card = this.findCard(line);
      if (card) {
        cards.push(card);
      } else {
        notFound.push(line);
      }
    }

    if (notFound.length > 0) {
      this.showMessage(`Cards not found: ${notFound.join(', ')}`, 'error');
    }

    return cards;
  }

  findCard(query) {
    const normalizedQuery = query.toLowerCase().trim();

    // Try to match by ID first (format: "001-001")
    if (/^\d{3}-\d{3}$/.test(normalizedQuery)) {
      return this.allCards.find(card => card.id === normalizedQuery);
    }

    // Try to match by name and title (format: "Ariel - On Human Legs")
    if (normalizedQuery.includes(' - ')) {
      const [name, title] = normalizedQuery.split(' - ').map(s => s.trim());
      return this.allCards.find(card =>
        card.name?.toLowerCase() === name &&
        card.title?.toLowerCase() === title
      );
    }

    // Try to match by name only
    return this.allCards.find(card =>
      card.name?.toLowerCase() === normalizedQuery
    );
  }

  async loadCards() {
    if (!this.allCards.length) {
      this.showMessage('Card database not loaded yet. Please wait...', 'error');
      return;
    }

    const cards = this.parseCardInput();
    if (cards.length === 0) {
      this.showMessage('No valid cards found. Please check your input.', 'error');
      return;
    }

    this.selectedCards = cards;
    this.showMessage(`Found ${cards.length} cards`, 'success');

    await this.previewCards();
    this.generatePDFBtn.disabled = false;
  }

  async previewCards() {
    this.previewSection.style.display = 'block';
    this.cardCount.textContent = `(${this.selectedCards.length} cards)`;
    this.cardPreviews.innerHTML = '';
    this.loadingIndicator.style.display = 'block';

    for (const card of this.selectedCards) {
      const previewDiv = document.createElement('div');
      previewDiv.className = 'card-preview';

      const img = document.createElement('img');
      const imageUrl = this.getCardImageUrl(card);

      if (imageUrl) {
        img.src = imageUrl;
        img.alt = `${card.name} - ${card.title || ''}`;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        // Store loaded image for PDF generation
        img.onload = () => {
          this.loadedImages.set(card.id, img);
        };

        img.onerror = () => {
          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDEwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTQwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjUwIiB5PSI3MCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPg==';
        };
      } else {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDEwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTQwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjUwIiB5PSI3MCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPg==';
      }

      const nameDiv = document.createElement('div');
      nameDiv.className = 'card-name';
      nameDiv.textContent = `${card.name}${card.title ? ` - ${card.title}` : ''}`;

      previewDiv.appendChild(img);
      previewDiv.appendChild(nameDiv);
      this.cardPreviews.appendChild(previewDiv);
    }

    this.loadingIndicator.style.display = 'none';
  }

  getCardImageUrl(card) {
    if (!card.id) return null;
    // Use the same CDN format as the main application
    return `https://cdn.dreamborn.ink/images/en/cards/${card.id}`;
  }

  async generatePDF() {
    if (this.selectedCards.length === 0) {
      this.showMessage('No cards selected. Please load cards first.', 'error');
      return;
    }

    this.showMessage('Generating PDF...', 'info');
    this.generatePDFBtn.disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // A4 dimensions: 210x297mm
      // Card dimensions for standard trading cards: ~63x88mm
      // With some margin, we can fit 8 cards: 2 columns x 4 rows
      const cardWidth = 63;
      const cardHeight = 88;
      const marginX = (210 - (2 * cardWidth)) / 3; // Space between cards and margins
      const marginY = (297 - (4 * cardHeight)) / 5; // Space between cards and margins

      let pageCardCount = 0;

      for (let i = 0; i < this.selectedCards.length; i++) {
        const card = this.selectedCards[i];

        // Start new page after every 8 cards
        if (pageCardCount === 8) {
          pdf.addPage();
          pageCardCount = 0;
        }

        // Calculate position
        const col = pageCardCount % 2;
        const row = Math.floor(pageCardCount / 2);
        const x = marginX + col * (cardWidth + marginX);
        const y = marginY + row * (cardHeight + marginY);

        // Add card image if available
        const imageUrl = this.getCardImageUrl(card);
        if (imageUrl) {
          try {
            // We need to load the image as base64 for jsPDF
            const base64Image = await this.loadImageAsBase64(imageUrl);
            if (base64Image) {
              pdf.addImage(base64Image, 'JPEG', x, y, cardWidth, cardHeight);
            } else {
              // Fallback: draw a placeholder rectangle
              this.drawCardPlaceholder(pdf, x, y, cardWidth, cardHeight, card);
            }
          } catch (error) {
            console.warn(`Failed to load image for ${card.name}:`, error);
            this.drawCardPlaceholder(pdf, x, y, cardWidth, cardHeight, card);
          }
        } else {
          this.drawCardPlaceholder(pdf, x, y, cardWidth, cardHeight, card);
        }

        pageCardCount++;
      }

      // Save the PDF
      const filename = `lorcana-proxies-${this.selectedCards.length}-cards.pdf`;
      pdf.save(filename);

      this.showMessage(`PDF generated successfully: ${filename}`, 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.showMessage('Failed to generate PDF. Please try again.', 'error');
    } finally {
      this.generatePDFBtn.disabled = false;
    }
  }

  drawCardPlaceholder(pdf, x, y, width, height, card) {
    // Draw border
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, width, height);

    // Add card name
    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    const text = `${card.name}${card.title ? ` - ${card.title}` : ''}`;
    const textWidth = pdf.getStringUnitWidth(text) * 8 / pdf.internal.scaleFactor;
    const textX = x + (width - textWidth) / 2;
    const textY = y + height / 2;
    pdf.text(text, textX, textY);

    // Add card ID
    pdf.setFontSize(6);
    pdf.text(card.id || 'Unknown ID', x + 2, y + height - 2);
  }

  async loadImageAsBase64(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        try {
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataURL);
        } catch (error) {
          console.warn('Failed to convert image to base64:', error);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image:', url);
        resolve(null);
      };

      img.src = url;
    });
  }

  clearAll() {
    this.cardInput.value = '';
    this.selectedCards = [];
    this.loadedImages.clear();
    this.previewSection.style.display = 'none';
    this.cardPreviews.innerHTML = '';
    this.generatePDFBtn.disabled = true;
    this.showMessage('', '');
  }

  showMessage(message, type) {
    this.messageArea.innerHTML = '';
    if (!message) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    this.messageArea.appendChild(messageDiv);
  }
}

// Initialize the proxy generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ProxyGenerator();
});