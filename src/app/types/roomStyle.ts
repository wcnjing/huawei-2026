export const ROOM_STYLE_KEY = 'safespace_room_styles_v1';

/*
 * DAY AND NIGHT ROOMS (notes/previews/2026-11-06-day-rooms-proposal, option C)
 * Every wall and floor below has a night colour (`color`) and a pale day twin (`day`) with the
 * same name and hue, so a player's choices work in both. Which one a room shows is set here:
 *   'choice'  each room gets Lighting: Auto / Day / Night in Customise. Auto, the default,
 *             follows the viewer's theme (day in light, night in dark). This is option C.
 *   'theme'   no choice: every room follows the viewer's theme (option B). Customise hides the
 *             Lighting control. Saved choices are kept, so switching back to 'choice' restores them.
 *   'night'   every room is the neon night scene in both themes, as before (option A).
 * The website has the same switch in drill-mode-site/src/components/room/roomStyle.ts.
 */
export const ROOM_LIGHTING_MODE = 'choice' as 'choice' | 'theme' | 'night';

export const ROOM_LIGHTING = [
  { id: 'auto', name: 'Auto', hint: "Follows each viewer's theme" },
  { id: 'day', name: 'Day', hint: 'Always daylight' },
  { id: 'night', name: 'Night', hint: 'Always neon night' },
] as const;
export type RoomTime = 'day' | 'night';

export const WALL_COLORS = [
  { id: 'auto', name: 'Match avatar', color: '', day: '' },
  { id: 'midnight', name: 'Midnight', color: '#101b32', day: '#dde6f4' },
  { id: 'violet', name: 'Violet', color: '#211733', day: '#ebe3f6' },
  { id: 'lagoon', name: 'Lagoon', color: '#0c292e', day: '#d9efec' },
  { id: 'rose', name: 'Rose', color: '#301729', day: '#f6e2ec' },
  { id: 'forest', name: 'Forest', color: '#12291f', day: '#dfeee3' },
] as const;
export const WALL_PATTERNS = [
  { id: 'grid', name: 'Pixel grid' }, { id: 'plain', name: 'Solid' },
  { id: 'stripes', name: 'Stripes' }, { id: 'stars', name: 'Pixel stars' },
  { id: 'brick', name: 'Brick' }, { id: 'hex', name: 'Honeycomb' },
  { id: 'circuit', name: 'Circuit' },
] as const;
export const FLOORS = [
  { id: 'original', name: 'Original', color: '', day: '' },
  { id: 'oak', name: 'Dark oak', color: '#3c2d32', day: '#c9a47e' },
  { id: 'tile', name: 'Slate tiles', color: '#273348', day: '#c4cfdd' },
  { id: 'checker', name: 'Arcade checks', color: '#302342', day: '#d7cce7' },
  { id: 'carpet', name: 'Soft carpet', color: '#253d43', day: '#bad7d3' },
  { id: 'concrete', name: 'Concrete', color: '#2c2f36', day: '#c9cdd3' },
  { id: 'neon', name: 'Neon grid', color: '#0d1f2e', day: '#d3e4ee' },
  { id: 'metal', name: 'Brushed metal', color: '#33383f', day: '#c5cbd3' },
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
  /** Day, night, or (auto) whatever the viewer's theme is. See ROOM_LIGHTING_MODE. */
  lighting: typeof ROOM_LIGHTING[number]['id'];
};
export type RoomStyles = Record<string, RoomStyle>;
export const DEFAULT_ROOM_STYLE: RoomStyle = {
  name: '', wall: 'auto', pattern: 'grid', floor: 'original', light: 'auto', glow: false, lighting: 'auto',
};
/** Presets change the look, not the lighting: a player's Day / Night choice stays. */
export const ROOM_PRESETS: { id: string; name: string; style: Omit<RoomStyle, 'name' | 'lighting'> }[] = [
  { id: 'classic', name: 'Classic', style: { wall: 'auto', pattern: 'grid', floor: 'original', light: 'auto', glow: false } },
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
    // Rooms saved before day rooms existed start on Auto.
    lighting: choice(source.lighting, ROOM_LIGHTING, 'auto'),
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

/** Day or night: what this room shows to a viewer on `theme` (see ROOM_LIGHTING_MODE). */
export function roomTime(style: { lighting?: RoomStyle['lighting'] } | undefined, theme: 'light' | 'dark'): RoomTime {
  if (ROOM_LIGHTING_MODE === 'night') return 'night';
  const lighting = ROOM_LIGHTING_MODE === 'choice' ? style?.lighting ?? 'auto' : 'auto';
  if (lighting === 'day' || lighting === 'night') return lighting;
  return theme === 'light' ? 'day' : 'night';
}

/** The "Match avatar" wall in daylight: a pale tint of the member's colour. */
export function dayWall(accent: string) {
  return `color-mix(in srgb, ${accent} 14%, #f7f9fc)`;
}

/** The room's wall, floor and neon colours. `time` picks the night colours or their day twins. */
export function roomColors(style: RoomStyle, background: string, accent: string, time: RoomTime = 'night') {
  const day = time === 'day';
  const wall = WALL_COLORS.find(option => option.id === style.wall);
  const floor = FLOORS.find(option => option.id === style.floor);
  const base = day ? dayWall(accent) : background;
  return {
    wall: (day ? wall?.day : wall?.color) || base,
    light: ROOM_LIGHTS.find(option => option.id === style.light)?.color || accent,
    floor: (day ? floor?.day : floor?.color) || base,
  };
}
