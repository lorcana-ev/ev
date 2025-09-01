#!/usr/bin/env ruby

# Data Verification Script for Lorcana EV (Ruby version)
# Verifies integrity of card data and pricing information

require 'json'
require 'pathname'

class LorcanaDataVerifier
  def initialize
    @project_root = Pathname(__FILE__).dirname.parent
    @errors = 0
    @warnings = 0
  end

  def load_json(filename)
    file_path = @project_root / 'data' / filename
    begin
      JSON.parse(File.read(file_path))
    rescue => e
      puts "❌ Error loading #{filename}: #{e.message}"
      exit 1
    end
  end

  def load_data
    puts '🔍 Loading data files...'
    
    @cards = load_json('cards.json')
    @prices = load_json('USD.json')
    @filters = load_json('filters.json')
    @sorts = load_json('sorts.json')
    
    cards_count = @cards.is_a?(Array) ? @cards.length : @cards.keys.length
    
    puts "📊 Data loaded:"
    puts "  - Cards: #{cards_count} entries"
    puts "  - Prices: #{@prices.keys.length} entries"
    puts "  - Filters: #{@filters.keys.length} categories"
    puts "  - Sorts: #{@sorts.keys.length} options"
  end

  def verify_card_structure
    puts "\n📋 Verifying card data structure..."
    
    required_fields = %w[id name setId type rarity variants]
    card_array = @cards.is_a?(Array) ? @cards : @cards.values
    
    # Sample first 100 cards for structure validation
    sample_cards = card_array.first(100)
    
    sample_cards.each do |card|
      required_fields.each do |field|
        unless card.key?(field)
          puts "❌ Card #{card['id'] || 'unknown'} missing required field: #{field}"
          @errors += 1
        end
      end
      
      # Check variants
      if card['variants'] && !card['variants'].is_a?(Array)
        puts "⚠️  Card #{card['id']} variants should be array, got: #{card['variants'].class}"
        @warnings += 1
      end
      
      # Check rarity values
      valid_rarities = ['common', 'uncommon', 'rare', 'super rare', 'legendary']
      if card['rarity'] && !valid_rarities.include?(card['rarity'].downcase)
        puts "⚠️  Card #{card['id']} has unusual rarity: #{card['rarity']}"
        @warnings += 1
      end
    end
    
    puts "✅ Card structure check complete: #{@errors} errors, #{@warnings} warnings"
    @errors == 0
  end

  def verify_pricing_coverage
    puts "\n💰 Verifying pricing coverage..."
    
    card_array = @cards.is_a?(Array) ? @cards : @cards.values
    
    # Focus on Fabled set (001)
    fabled_cards = card_array.select do |card|
      card['setId'] == '001' || card['id']&.start_with?('001-')
    end
    
    puts "🎯 Found #{fabled_cards.length} cards in Fabled set (001)"
    
    missing_prices = []
    partial_prices = []
    complete_prices = 0
    
    fabled_cards.each do |card|
      card_id = card['id']
      price_data = @prices[card_id]
      
      unless price_data
        missing_prices << card_id
        next
      end
      
      # Check for base and foil variants
      has_base = price_data.dig('base', 'TP', 'price')
      has_foil = price_data.dig('foil', 'TP', 'price')
      
      if !has_base && !has_foil
        missing_prices << card_id
      elsif !has_base || !has_foil
        partial_prices << {
          id: card_id,
          name: card['name'],
          missing: has_base ? 'foil' : 'base',
          has_base: !!has_base,
          has_foil: !!has_foil
        }
      else
        complete_prices += 1
      end
    end
    
    puts "📈 Pricing coverage for Fabled set:"
    puts "  ✅ Complete pricing: #{complete_prices} cards"
    puts "  ⚠️  Partial pricing: #{partial_prices.length} cards"
    puts "  ❌ Missing pricing: #{missing_prices.length} cards"
    
    if partial_prices.length > 0
      puts "\n⚠️  Cards with partial pricing:"
      partial_prices.first(10).each do |card|
        puts "    #{card[:id]} (#{card[:name]}) - missing #{card[:missing]}"
      end
      puts "    ... and #{partial_prices.length - 10} more" if partial_prices.length > 10
    end
    
    if missing_prices.length > 0
      puts "\n❌ Cards with no pricing data:"
      missing_prices.first(10).each do |card_id|
        card = fabled_cards.find { |c| c['id'] == card_id }
        puts "    #{card_id} (#{card&.dig('name') || 'unknown'})"
      end
      puts "    ... and #{missing_prices.length - 10} more" if missing_prices.length > 10
    end
    
    coverage_percent = ((complete_prices + partial_prices.length).to_f / fabled_cards.length * 100).round(1)
    puts "📊 Overall coverage: #{coverage_percent}% of Fabled cards have some pricing data"
    
    missing_prices.empty?
  end

  def verify_price_consistency
    puts "\n🔍 Verifying price data consistency..."
    
    price_issues = []
    price_stats = {
      total_cards: 0,
      with_base_prices: 0,
      with_foil_prices: 0,
      negative_base_prices: 0,
      negative_foil_prices: 0,
      foil_lower_than_base: 0
    }
    
    @prices.each do |card_id, price_data|
      price_stats[:total_cards] += 1
      
      base_price = price_data.dig('base', 'TP', 'price')
      foil_price = price_data.dig('foil', 'TP', 'price')
      
      if base_price
        price_stats[:with_base_prices] += 1
        if base_price < 0
          price_stats[:negative_base_prices] += 1
          price_issues << "#{card_id}: negative base price (#{base_price})"
        end
      end
      
      if foil_price
        price_stats[:with_foil_prices] += 1
        if foil_price < 0
          price_stats[:negative_foil_prices] += 1
          price_issues << "#{card_id}: negative foil price (#{foil_price})"
        end
      end
      
      # Check if foil is cheaper than base (unusual)
      if base_price&.positive? && foil_price&.positive? && foil_price < base_price
        price_stats[:foil_lower_than_base] += 1
        if price_issues.length < 20 # Limit output
          price_issues << "#{card_id}: foil ($#{foil_price}) < base ($#{base_price})"
        end
      end
    end
    
    puts "📊 Price statistics:"
    puts "  Total cards with price data: #{price_stats[:total_cards]}"
    puts "  Cards with base prices: #{price_stats[:with_base_prices]}"
    puts "  Cards with foil prices: #{price_stats[:with_foil_prices]}"
    puts "  Negative base prices: #{price_stats[:negative_base_prices]}"
    puts "  Negative foil prices: #{price_stats[:negative_foil_prices]}"
    puts "  Foil cheaper than base: #{price_stats[:foil_lower_than_base]}"
    
    if price_issues.length > 0
      puts "\n⚠️  Price consistency issues:"
      price_issues.first(15).each { |issue| puts "    #{issue}" }
      puts "    ... and #{price_issues.length - 15} more issues" if price_issues.length > 15
    end
    
    price_stats[:negative_base_prices] == 0 && price_stats[:negative_foil_prices] == 0
  end

  def generate_data_summary
    puts "\n📋 Data Summary:"
    
    card_array = @cards.is_a?(Array) ? @cards : @cards.values
    
    # Set distribution
    set_distribution = Hash.new(0)
    card_array.each do |card|
      set_id = card['setId'] || card['id']&.split('-')&.first || 'unknown'
      set_distribution[set_id] += 1
    end
    
    puts "📦 Cards by set:"
    set_distribution.sort.each do |set_id, count|
      puts "  Set #{set_id}: #{count} cards"
    end
    
    # Rarity distribution for Fabled set
    fabled_cards = card_array.select do |card|
      card['setId'] == '001' || card['id']&.start_with?('001-')
    end
    
    rarity_dist = Hash.new(0)
    fabled_cards.each do |card|
      rarity = card['rarity'] || 'unknown'
      rarity_dist[rarity] += 1
    end
    
    puts "\n🎯 Fabled set rarity distribution:"
    rarity_dist.sort.each do |rarity, count|
      puts "  #{rarity}: #{count} cards"
    end
  end

  def run_verification
    puts "🚀 Starting Lorcana EV data verification...\n"
    
    load_data
    
    all_passed = true
    all_passed &= verify_card_structure
    all_passed &= verify_pricing_coverage
    all_passed &= verify_price_consistency
    
    generate_data_summary
    
    puts "\n" + "=" * 50
    if all_passed
      puts "✅ All verifications passed! Data integrity looks good."
    else
      puts "❌ Some verifications failed. Please review the issues above."
    end
    puts "=" * 50
    
    exit(all_passed ? 0 : 1)
  end
end

# Run the verification
LorcanaDataVerifier.new.run_verification