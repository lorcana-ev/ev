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
    const fuzzyMatches = [];

    for (const line of lines) {
      const parsed = this.parseCardLine(line);
      const result = this.findCardWithInfo(parsed.cardName);

      if (result.card) {
        // Add the card multiple times based on quantity
        for (let i = 0; i < parsed.quantity; i++) {
          cards.push(result.card);
        }

        if (result.isFuzzy) {
          const quantityText = parsed.quantity > 1 ? `${parsed.quantity}x ` : '';
          fuzzyMatches.push(`"${line}" → "${quantityText}${result.card.name}${result.card.title ? ` - ${result.card.title}` : ''}"`);
        }
      } else {
        notFound.push(line);
      }
    }

    // Show feedback messages
    const messages = [];
    if (fuzzyMatches.length > 0) {
      messages.push(`Fuzzy matches found: ${fuzzyMatches.join(', ')}`);
    }
    if (notFound.length > 0) {
      messages.push(`Cards not found: ${notFound.join(', ')}`);
    }

    if (messages.length > 0) {
      this.showMessage(messages.join('<br>'), notFound.length > 0 ? 'error' : 'info');
    }

    return cards;
  }

  parseCardLine(line) {
    const trimmed = line.trim();

    // Check for quantity notation (4x, 2x, etc.)
    const quantityMatch = trimmed.match(/^(\d+)x?\s+(.+)$/i);

    if (quantityMatch) {
      const quantity = parseInt(quantityMatch[1], 10);
      const cardName = quantityMatch[2].trim();
      return { quantity: Math.max(1, Math.min(quantity, 20)), cardName }; // Limit to reasonable range
    }

    // No quantity specified, default to 1
    return { quantity: 1, cardName: trimmed };
  }

  findCardWithInfo(query) {
    const normalizedQuery = query.toLowerCase().trim();

    // Try to match by ID first (format: "001-001")
    if (/^\d{3}-\d{3}$/.test(normalizedQuery)) {
      const card = this.allCards.find(card => card.id === normalizedQuery);
      return { card, isFuzzy: false };
    }

    // Try to match by name and title (format: "Ariel - On Human Legs")
    if (normalizedQuery.includes(' - ')) {
      const [name, title] = normalizedQuery.split(' - ').map(s => s.trim());

      // Exact match first
      let exactMatch = this.allCards.find(card =>
        card.name?.toLowerCase() === name &&
        card.title?.toLowerCase() === title
      );
      if (exactMatch) return { card: exactMatch, isFuzzy: false };

      // Fuzzy match for name and title
      const fuzzyMatch = this.findBestMatch(name, title);
      return { card: fuzzyMatch, isFuzzy: !!fuzzyMatch };
    }

    // Try exact name match first
    let exactMatch = this.allCards.find(card =>
      card.name?.toLowerCase() === normalizedQuery
    );
    if (exactMatch) return { card: exactMatch, isFuzzy: false };

    // Fuzzy match for name only
    const fuzzyMatch = this.findBestMatch(normalizedQuery);
    return { card: fuzzyMatch, isFuzzy: !!fuzzyMatch };
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

      // Exact match first
      let exactMatch = this.allCards.find(card =>
        card.name?.toLowerCase() === name &&
        card.title?.toLowerCase() === title
      );
      if (exactMatch) return exactMatch;

      // Fuzzy match for name and title
      return this.findBestMatch(name, title);
    }

    // Try exact name match first
    let exactMatch = this.allCards.find(card =>
      card.name?.toLowerCase() === normalizedQuery
    );
    if (exactMatch) return exactMatch;

    // Fuzzy match for name only
    return this.findBestMatch(normalizedQuery);
  }

  findBestMatch(name, title = null) {
    let bestMatch = null;
    let bestScore = 0;

    for (const card of this.allCards) {
      let score = 0;

      // Calculate name similarity
      const nameScore = this.calculateSimilarity(name, card.name?.toLowerCase() || '');
      score += nameScore * 2; // Weight name heavily

      // Calculate title similarity if provided
      if (title && card.title) {
        const titleScore = this.calculateSimilarity(title, card.title.toLowerCase());
        score += titleScore;
      } else if (title && !card.title) {
        // Penalty for having a title when card doesn't
        score -= 0.5;
      } else if (!title && card.title) {
        // Small bonus for not specifying title when card has one
        score += 0.1;
      }

      // Bonus for exact name match
      if (card.name?.toLowerCase() === name) {
        score += 1;
      }

      // Bonus for partial name match
      if (card.name?.toLowerCase().includes(name) || name.includes(card.name?.toLowerCase() || '')) {
        score += 0.5;
      }

      if (score > bestScore && score > 0.6) { // Minimum threshold
        bestScore = score;
        bestMatch = card;
      }
    }

    return bestMatch;
  }

  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    // Exact match
    if (str1 === str2) return 1;

    // Contains match
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }

    // Levenshtein distance based similarity
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return Math.max(0, (maxLength - distance) / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
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
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // A4 landscape dimensions: 297x210mm
      // 8 cards per page: 4 columns x 2 rows
      // Standard card aspect ratio is approximately 63:88 (about 0.716)
      const pageWidth = 297;
      const pageHeight = 210;
      const cols = 4;
      const rows = 2;

      // Calculate card dimensions to fit 8 cards with margins
      const totalMarginX = 20; // Total horizontal margin
      const totalMarginY = 20; // Total vertical margin
      const cardSpacing = 5; // Space between cards

      const availableWidth = pageWidth - totalMarginX - (cardSpacing * (cols - 1));
      const availableHeight = pageHeight - totalMarginY - (cardSpacing * (rows - 1));

      const cardWidth = (availableWidth / cols) * 0.75; // Scale down to 75%
      const cardHeight = (availableHeight / rows) * 0.75; // Scale down to 75%

      // Recalculate margins to center the smaller cards
      const totalUsedWidth = (cardWidth * cols) + (cardSpacing * (cols - 1));
      const totalUsedHeight = (cardHeight * rows) + (cardSpacing * (rows - 1));
      const marginX = (pageWidth - totalUsedWidth) / 2;
      const marginY = (pageHeight - totalUsedHeight) / 2;

      let pageCardCount = 0;

      for (let i = 0; i < this.selectedCards.length; i++) {
        const card = this.selectedCards[i];

        // Start new page after every 8 cards
        if (pageCardCount === 8) {
          pdf.addPage();
          pageCardCount = 0;
        }

        // Calculate position (4 columns x 2 rows)
        const col = pageCardCount % cols;
        const row = Math.floor(pageCardCount / cols);
        const x = marginX + col * (cardWidth + cardSpacing);
        const y = marginY + row * (cardHeight + cardSpacing);

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
    messageDiv.innerHTML = message; // Allow HTML for better formatting
    this.messageArea.appendChild(messageDiv);
  }
}

// Initialize the proxy generator when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ProxyGenerator();
});