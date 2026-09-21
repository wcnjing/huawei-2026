export type RoomPosition = { x: number; y: number };
export type RoomLayout = Record<string, RoomPosition>;
export type RoomLayouts = Record<string, RoomLayout>;

const HANGING_ITEMS = new Set(['shop-chandelier', 'shop-wall-light', 'shop-window', 'shop-curtained-window', 'shop-hanging-planter']);
const CARPETS = new Set(['shop-rug', 'shop-orbit-carpet']);

export function furnitureLayer(id: string): number {
  return CARPETS.has(id) ? 0 : HANGING_ITEMS.has(id) ? 1 : 2;
}

// Where an item's art should sit within its (aspect-ratio-preserving) placement box.
// A hanging item's box top sits at the room's ceiling (see the y:0 fallback below), so
// its art must touch the TOP of that box — any leftover space from fitting a wide art
// asset into a tall box belongs below it, like a chain dangling into the room, not
// above it as a gap between the art and the ceiling it's meant to be mounted on.
// Everything else stands on the floor, so it anchors to the bottom of its box instead.
export function furnitureAnchor(id: string): 'top' | 'bottom' {
  return HANGING_ITEMS.has(id) ? 'top' : 'bottom';
}

// Coordinates describe the available travel of the whole item, not its centre.
// Thus 100 still keeps its right/bottom edge inside rooms of any size.
export function snapPosition(x: number, y: number): RoomPosition {
  const snap = (n: number) => Math.max(0, Math.min(100, Math.round((Number.isFinite(n) ? n : 0) / 10) * 10));
  return { x: snap(x), y: snap(y) };
}

export function reconcileLayout(itemIds: string[], saved: unknown): RoomLayout {
  const source = saved && typeof saved === 'object' ? saved as Record<string, unknown> : {};
  return Object.fromEntries([...new Set(itemIds)].map((id, index) => {
    const candidate = Object.hasOwn(source, id) ? source[id] as Partial<RoomPosition> | null : null;
    const valid = candidate && typeof candidate.x === 'number' && Number.isFinite(candidate.x)
      && typeof candidate.y === 'number' && Number.isFinite(candidate.y);
    const fallback = {
      x: (index % 4) * 30,
      y: HANGING_ITEMS.has(id) ? 0 : CARPETS.has(id) ? 100 : Math.floor(index / 4) % 2 ? 100 : 40,
    };
    return [id, valid ? snapPosition(candidate.x!, candidate.y!) : fallback];
  }));
}
