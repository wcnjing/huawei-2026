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

// Existing IDs remain stable so previously bought furniture is retained; prices may change.
// Prices follow real-world value (a yoga mat is cheap, a desktop is a big purchase): with
// payday, daily rewards and drills an active player earns roughly 600–800 coins a week.
export const SHOP_CATALOGUE: ShopItem[] = [
  { id: 'shop-sofa', name: 'MINT COUCH', cost: 1400, color: '#4ecdc4', art: '01-mint-couch', category: 'basic' },
  { id: 'shop-bed', name: 'STARLIGHT BED', cost: 1800, color: '#c77dff', art: '02-starlight-bed', category: 'basic' },
  { id: 'shop-chair', name: 'BLUSH CHAIR', cost: 520, color: '#ff71c5', art: '03-blush-chair', category: 'basic' },
  { id: 'shop-table', name: 'COFFEE TABLE', cost: 620, color: '#4ecdc4', art: '04-coffee-table', category: 'basic' },
  { id: 'shop-chandelier', name: 'CRYSTAL CHANDELIER', cost: 1600, color: '#ffe66d', art: '05-crystal-chandelier', category: 'lights' },
  { id: 'shop-wall-light', name: 'WALL SCONCE', cost: 320, color: '#ff71c5', art: '06-wall-sconce', category: 'lights' },
  { id: 'shop-lamp', name: 'READING LAMP', cost: 300, color: '#ffe66d', art: '07-reading-lamp', category: 'lights' },
  { id: 'shop-window', name: 'CITY WINDOW', cost: 1450, color: '#4ecdc4', art: '08-city-window', category: 'decor', decorType: 'openings' },
  { id: 'shop-curtained-window', name: 'CURTAINED WINDOW', cost: 1650, color: '#c77dff', art: '09-curtained-window', category: 'decor', decorType: 'openings' },
  { id: 'shop-door', name: 'NEON-PANEL DOOR', cost: 1200, color: '#4ecdc4', art: '10-neon-panel-door', category: 'decor', decorType: 'openings' },
  { id: 'shop-rug', name: 'WOVEN RUNNER', cost: 480, color: '#ff71c5', art: '11-woven-runner', category: 'decor', decorType: 'carpets' },
  { id: 'shop-orbit-carpet', name: 'ORBIT CARPET', cost: 720, color: '#c77dff', art: '12-orbit-carpet', category: 'decor', decorType: 'carpets' },
  { id: 'shop-plant', name: 'LEAFY PLANT', cost: 350, color: '#4ecdc4', art: '13-leafy-plant', category: 'decor', decorType: 'plants' },
  { id: 'shop-cactus', name: 'FLOWERING CACTUS', cost: 260, color: '#ff71c5', art: '14-flowering-cactus', category: 'decor', decorType: 'plants' },
  { id: 'shop-hanging-planter', name: 'HANGING PLANTER', cost: 320, color: '#4ecdc4', art: '15-hanging-planter', category: 'decor', decorType: 'plants' },
  { id: 'shop-bookshelf', name: 'BOOKCASE', cost: 950, color: '#c77dff', art: '16-bookcase', category: 'storage' },
  { id: 'shop-cabinet', name: 'DRAWER CABINET', cost: 850, color: '#ffe66d', art: '17-drawer-cabinet', category: 'storage' },
  { id: 'shop-computer', name: 'DESKTOP SETUP', cost: 3000, color: '#4ecdc4', art: '18-desktop-setup', category: 'tech' },
  { id: 'shop-laptop', name: 'LAPTOP', cost: 2400, color: '#4ecdc4', art: '19-laptop', category: 'tech' },
  { id: 'shop-tv', name: 'MOVIE-NIGHT TV', cost: 2000, color: '#c77dff', art: '20-movie-night-tv', category: 'tech' },
  { id: 'shop-basketball', name: 'BASKETBALL HOOP', cost: 750, color: '#ff6b35', art: '21-basketball-hoop', category: 'sports' },
  { id: 'shop-dumbbells', name: 'DUMBBELL RACK', cost: 1000, color: '#c77dff', art: '22-dumbbell-rack', category: 'sports' },
  { id: 'shop-skateboard', name: 'SKATEBOARD', cost: 380, color: '#ff71c5', art: '23-skateboard', category: 'sports' },
  { id: 'shop-guitar', name: 'ACOUSTIC GUITAR', cost: 800, color: '#ffe66d', art: '24-acoustic-guitar', category: 'sports' },
  { id: 'shop-bean-bag', name: 'BEAN BAG', cost: 450, color: '#4ecdc4', art: '25-bean-bag', category: 'basic' },
  { id: 'shop-bedside-table', name: 'BEDSIDE TABLE', cost: 380, color: '#c77dff', art: '26-bedside-table', category: 'basic' },
  { id: 'shop-bar-stool', name: 'BAR STOOL', cost: 280, color: '#ff71c5', art: '27-bar-stool', category: 'basic' },
  { id: 'shop-neon-sign', name: 'NEON SIGN', cost: 680, color: '#ff6b35', art: '28-neon-sign', category: 'lights' },
  { id: 'shop-floor-lamp', name: 'FLOOR LAMP', cost: 420, color: '#ffe66d', art: '29-floor-lamp', category: 'lights' },
  { id: 'shop-zigzag-rug', name: 'ZIGZAG RUG', cost: 580, color: '#4ecdc4', art: '30-zigzag-rug', category: 'decor', decorType: 'carpets' },
  { id: 'shop-circle-mat', name: 'CIRCLE MAT', cost: 300, color: '#ff71c5', art: '31-circle-mat', category: 'decor', decorType: 'carpets' },
  { id: 'shop-succulent-trio', name: 'SUCCULENT TRIO', cost: 280, color: '#4ecdc4', art: '32-succulent-trio', category: 'decor', decorType: 'plants' },
  { id: 'shop-palm-tree', name: 'PALM TREE', cost: 850, color: '#4ecdc4', art: '33-palm-tree', category: 'decor', decorType: 'plants' },
  { id: 'shop-skylight', name: 'SKYLIGHT', cost: 2600, color: '#c77dff', art: '34-skylight', category: 'decor', decorType: 'openings' },
  { id: 'shop-arched-door', name: 'ARCHED DOOR', cost: 1800, color: '#ff6b35', art: '35-arched-door', category: 'decor', decorType: 'openings' },
  { id: 'shop-toy-chest', name: 'TOY CHEST', cost: 520, color: '#ffe66d', art: '36-toy-chest', category: 'storage' },
  { id: 'shop-shoe-rack', name: 'SHOE RACK', cost: 380, color: '#c77dff', art: '37-shoe-rack', category: 'storage' },
  { id: 'shop-gaming-console', name: 'GAMING CONSOLE', cost: 1100, color: '#4ecdc4', art: '38-gaming-console', category: 'tech' },
  { id: 'shop-retro-radio', name: 'RETRO RADIO', cost: 420, color: '#ff6b35', art: '39-retro-radio', category: 'tech' },
  { id: 'shop-vr-headset', name: 'VR HEADSET', cost: 1300, color: '#c77dff', art: '40-vr-headset', category: 'tech' },
  { id: 'shop-yoga-mat', name: 'YOGA MAT', cost: 260, color: '#4ecdc4', art: '41-yoga-mat', category: 'sports' },
  { id: 'shop-punching-bag', name: 'PUNCHING BAG', cost: 650, color: '#ff71c5', art: '42-punching-bag', category: 'sports' },
  { id: 'shop-surfboard', name: 'SURFBOARD', cost: 1150, color: '#ffe66d', art: '43-surfboard', category: 'sports' },
  { id: 'shop-bike', name: 'BIKE', cost: 1500, color: '#ff6b35', art: '44-bike', category: 'sports' },
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
