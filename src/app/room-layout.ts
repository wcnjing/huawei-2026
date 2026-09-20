export type RoomPosition = { x: number; y: number };
export type RoomLayout = Record<string, RoomPosition>;
export type RoomLayouts = Record<string, RoomLayout>;

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
    const fallback = { x: (index % 4) * 30, y: Math.floor(index / 4) % 2 ? 100 : 40 };
    return [id, valid ? snapPosition(candidate.x!, candidate.y!) : fallback];
  }));
}
