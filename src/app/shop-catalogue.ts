export const SHOP_CATEGORIES = [
  { id: 'basic', name: 'Basic furniture' },
  { id: 'lights', name: 'Lighting' },
  { id: 'decor', name: 'Decor' },
  { id: 'storage', name: 'Storage' },
  { id: 'tech', name: 'Tech & entertainment' },
  { id: 'sports', name: 'Sports & hobbies' },
] as const;
export const DECOR_TYPES = [
  { id: 'carpets', name: 'Carpets' },
  { id: 'plants', name: 'Plants' },
  { id: 'openings', name: 'Windows & doors' },
] as const;
export type ShopCategory = typeof SHOP_CATEGORIES[number]['id'];
export type DecorType = typeof DECOR_TYPES[number]['id'];
type ItemBase = { id: string; name: string; cost: number; color: string; art: string };
export type ShopItem = ItemBase & (
  | { category: 'decor'; decorType: DecorType }
  | { category: Exclude<ShopCategory, 'decor'>; decorType?: never }
);

// Existing IDs and prices remain stable so previously bought furniture is retained.
export const SHOP_CATALOGUE: ShopItem[] = [
  { id: 'shop-sofa', name: 'MINT COUCH', cost: 50, color: '#4ecdc4', art: '01-mint-couch', category: 'basic' },
  { id: 'shop-bed', name: 'STARLIGHT BED', cost: 120, color: '#c77dff', art: '02-starlight-bed', category: 'basic' },
  { id: 'shop-chair', name: 'BLUSH CHAIR', cost: 35, color: '#ff71c5', art: '03-blush-chair', category: 'basic' },
  { id: 'shop-table', name: 'COFFEE TABLE', cost: 45, color: '#4ecdc4', art: '04-coffee-table', category: 'basic' },
  { id: 'shop-chandelier', name: 'CRYSTAL CHANDELIER', cost: 150, color: '#ffe66d', art: '05-crystal-chandelier', category: 'lights' },
  { id: 'shop-wall-light', name: 'WALL SCONCE', cost: 40, color: '#ff71c5', art: '06-wall-sconce', category: 'lights' },
  { id: 'shop-lamp', name: 'READING LAMP', cost: 25, color: '#ffe66d', art: '07-reading-lamp', category: 'lights' },
  { id: 'shop-window', name: 'CITY WINDOW', cost: 200, color: '#4ecdc4', art: '08-city-window', category: 'decor', decorType: 'openings' },
  { id: 'shop-curtained-window', name: 'CURTAINED WINDOW', cost: 220, color: '#c77dff', art: '09-curtained-window', category: 'decor', decorType: 'openings' },
  { id: 'shop-door', name: 'NEON-PANEL DOOR', cost: 100, color: '#4ecdc4', art: '10-neon-panel-door', category: 'decor', decorType: 'openings' },
  { id: 'shop-rug', name: 'WOVEN RUNNER', cost: 60, color: '#ff71c5', art: '11-woven-runner', category: 'decor', decorType: 'carpets' },
  { id: 'shop-orbit-carpet', name: 'ORBIT CARPET', cost: 65, color: '#c77dff', art: '12-orbit-carpet', category: 'decor', decorType: 'carpets' },
  { id: 'shop-plant', name: 'LEAFY PLANT', cost: 30, color: '#4ecdc4', art: '13-leafy-plant', category: 'decor', decorType: 'plants' },
  { id: 'shop-cactus', name: 'FLOWERING CACTUS', cost: 35, color: '#ff71c5', art: '14-flowering-cactus', category: 'decor', decorType: 'plants' },
  { id: 'shop-hanging-planter', name: 'HANGING PLANTER', cost: 55, color: '#4ecdc4', art: '15-hanging-planter', category: 'decor', decorType: 'plants' },
  { id: 'shop-bookshelf', name: 'BOOKCASE', cost: 90, color: '#c77dff', art: '16-bookcase', category: 'storage' },
  { id: 'shop-cabinet', name: 'DRAWER CABINET', cost: 75, color: '#ffe66d', art: '17-drawer-cabinet', category: 'storage' },
  { id: 'shop-computer', name: 'DESKTOP SETUP', cost: 180, color: '#4ecdc4', art: '18-desktop-setup', category: 'tech' },
  { id: 'shop-laptop', name: 'LAPTOP', cost: 130, color: '#4ecdc4', art: '19-laptop', category: 'tech' },
  { id: 'shop-tv', name: 'MOVIE-NIGHT TV', cost: 80, color: '#c77dff', art: '20-movie-night-tv', category: 'tech' },
  { id: 'shop-basketball', name: 'BASKETBALL HOOP', cost: 110, color: '#ff6b35', art: '21-basketball-hoop', category: 'sports' },
  { id: 'shop-dumbbells', name: 'DUMBBELL RACK', cost: 70, color: '#c77dff', art: '22-dumbbell-rack', category: 'sports' },
  { id: 'shop-skateboard', name: 'SKATEBOARD', cost: 60, color: '#ff71c5', art: '23-skateboard', category: 'sports' },
  { id: 'shop-guitar', name: 'ACOUSTIC GUITAR', cost: 100, color: '#ffe66d', art: '24-acoustic-guitar', category: 'sports' },
];

export type ShopFilter = 'ALL' | 'AFFORDABLE' | 'OWNED';
export function filterShopItems(category: ShopCategory | 'all', decor: DecorType | 'all', filter: ShopFilter, owned: string[], coins: number) {
  return SHOP_CATALOGUE.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    if (category === 'decor' && decor !== 'all' && item.decorType !== decor) return false;
    if (filter === 'OWNED') return owned.includes(item.id);
    if (filter === 'AFFORDABLE') return !owned.includes(item.id) && coins >= item.cost;
    return true;
  });
}
