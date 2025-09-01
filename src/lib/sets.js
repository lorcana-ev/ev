// src/lib/sets.js
// Set information and mappings

export const SET_NAMES = {
  '001': 'The First Chapter',
  '002': 'Rise of the Floodborn', 
  '003': 'Into the Inklands',
  '004': 'Ursula\'s Return',
  '005': 'Shimmering Skies',
  '006': 'Azurite Sea',
  '007': 'Set 7', 
  '008': 'Set 8', 
  '009': 'Set 9 (No Pricing)', // Indicate no pricing available
  'C1': 'Convention Exclusives',
  'D23': 'D23 Expo Exclusives',
  'P1': 'Promos Series 1',
  'P2': 'Promos Series 2'
};

export const SET_RELEASE_ORDER = [
  '001', '002', '003', '004', '005', '006', '007', '008', '009'
];

export const SPECIAL_SETS = ['C1', 'D23', 'P1', 'P2'];

export function getSetName(setCode) {
  return SET_NAMES[setCode] || `Set ${setCode}`;
}

export function getAllSets(cards) {
  const cardArray = Array.isArray(cards) ? cards : Object.values(cards);
  const setDistribution = new Map();
  
  for (const card of cardArray) {
    const setId = card.setId || card.id?.split('-')[0] || 'unknown';
    if (!setDistribution.has(setId)) {
      setDistribution.set(setId, {
        code: setId,
        name: getSetName(setId),
        count: 0,
        isSpecial: SPECIAL_SETS.includes(setId)
      });
    }
    setDistribution.get(setId).count++;
  }
  
  // Sort sets by release order, with special sets at the end
  const sortedSets = Array.from(setDistribution.values()).sort((a, b) => {
    if (a.isSpecial && !b.isSpecial) return 1;
    if (!a.isSpecial && b.isSpecial) return -1;
    
    if (!a.isSpecial && !b.isSpecial) {
      const aIndex = SET_RELEASE_ORDER.indexOf(a.code);
      const bIndex = SET_RELEASE_ORDER.indexOf(b.code);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    }
    
    return a.code.localeCompare(b.code);
  });
  
  return sortedSets;
}