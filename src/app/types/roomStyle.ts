export const ROOM_STYLE_KEY = 'safespace_room_styles_v1';

export const WALL_COLORS = [
  { id: 'auto', name: 'Match avatar', color: '' },
  { id: 'midnight', name: 'Midnight', color: '#101b32' },
  { id: 'violet', name: 'Violet', color: '#211733' },
  { id: 'lagoon', name: 'Lagoon', color: '#0c292e' },
  { id: 'rose', name: 'Rose', color: '#301729' },
  { id: 'forest', name: 'Forest', color: '#12291f' },
] as const;
export const WALL_PATTERNS = [
  { id: 'grid', name: 'Pixel grid' }, { id: 'plain', name: 'Solid' },
  { id: 'stripes', name: 'Stripes' }, { id: 'stars', name: 'Pixel stars' },
] as const;
export const FLOORS = [
  { id: 'original', name: 'Original', color: '' },
  { id: 'oak', name: 'Dark oak', color: '#3c2d32' },
  { id: 'tile', name: 'Slate tiles', color: '#273348' },
  { id: 'checker', name: 'Arcade checks', color: '#302342' },
  { id: 'carpet', name: 'Soft carpet', color: '#253d43' },
] as const;
export const ROOM_LIGHTS = [
  { id: 'auto', name: 'Match avatar', color: '' },
  { id: 'mint', name: 'Mint', color: '#4ecdc4' },
  { id: 'green', name: 'Electric green', color: '#00ff88' },
  { id: 'pink', name: 'Hot pink', color: '#ff71c5' },
  { id: 'purple', name: 'Lilac', color: '#c77dff' },
  { id: 'gold', name: 'Gold', color: '#ffe66d' },
] as const;

export type RoomStyle = {
  name: string;
  wall: typeof WALL_COLORS[number]['id'];
  pattern: typeof WALL_PATTERNS[number]['id'];
  floor: typeof FLOORS[number]['id'];
  light: typeof ROOM_LIGHTS[number]['id'];
  glow: boolean;
};
export type RoomStyles = Record<string, RoomStyle>;
export const DEFAULT_ROOM_STYLE: RoomStyle = {
  name: '', wall: 'auto', pattern: 'grid', floor: 'original', light: 'auto', glow: false,
};
export const ROOM_PRESETS: { id: string; name: string; style: Omit<RoomStyle, 'name'> }[] = [
  { id: 'classic', name: 'Classic', style: DEFAULT_ROOM_STYLE },
  { id: 'arcade', name: 'Neon arcade', style: { wall: 'violet', pattern: 'grid', floor: 'checker', light: 'pink', glow: true } },
  { id: 'starlight', name: 'Starlight', style: { wall: 'midnight', pattern: 'stars', floor: 'tile', light: 'purple', glow: true } },
  { id: 'hideaway', name: 'Mint hideaway', style: { wall: 'lagoon', pattern: 'stripes', floor: 'oak', light: 'mint', glow: true } },
];

function choice<T extends string>(value: unknown, options: readonly { id: T }[], fallback: T): T {
  return options.find(option => option.id === value)?.id ?? fallback;
}

export function normalizeRoomStyle(value: unknown): RoomStyle {
  const source = value && typeof value === 'object' ? value as Partial<RoomStyle> : {};
  return {
    name: typeof source.name === 'string' ? source.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32) : '',
    wall: choice(source.wall, WALL_COLORS, 'auto'),
    pattern: choice(source.pattern, WALL_PATTERNS, 'grid'),
    floor: choice(source.floor, FLOORS, 'original'),
    light: choice(source.light, ROOM_LIGHTS, 'auto'),
    glow: source.glow === true,
  };
}

export function loadRoomStyles(): RoomStyles {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ROOM_STYLE_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).map(([id, value]) => [id, normalizeRoomStyle(value)]));
  } catch { return {}; }
}

export function saveRoomStyles(styles: RoomStyles): boolean {
  try {
    localStorage.setItem(ROOM_STYLE_KEY, JSON.stringify(Object.fromEntries(
      Object.entries(styles).map(([id, style]) => [id, normalizeRoomStyle(style)]),
    )));
    return true;
  } catch { return false; }
}

export function roomColors(style: RoomStyle, background: string, accent: string) {
  return {
    wall: WALL_COLORS.find(option => option.id === style.wall)?.color || background,
    light: ROOM_LIGHTS.find(option => option.id === style.light)?.color || accent,
    floor: FLOORS.find(option => option.id === style.floor)?.color || background,
  };
}
