import type {
  AccessoryId,
  AvatarConfig,
  CharacterConfig,
  HairColorId,
  HairStyleId,
  OutfitId,
  SkinToneId,
} from "./types";

export const PROFILE_COLORS = ["#4ecdc4", "#ff6b35", "#c77dff", "#ffe66d", "#ff2d55", "#00ff88"] as const;

export const SKIN_TONES: ReadonlyArray<{ id: SkinToneId; label: string; swatch: string }> = [
  { id: "porcelain", label: "PORCELAIN", swatch: "#ffd4bd" },
  { id: "peach", label: "PEACH", swatch: "#f2ae85" },
  { id: "golden", label: "GOLDEN", swatch: "#d89a68" },
  { id: "tan", label: "TAN", swatch: "#bd7e57" },
  { id: "brown", label: "BROWN", swatch: "#a9684b" },
  { id: "deep", label: "DEEP", swatch: "#704133" },
  { id: "green", label: "GREEN", swatch: "#65c466" },
  { id: "blue", label: "BLUE", swatch: "#68a9e8" },
  { id: "purple", label: "PURPLE", swatch: "#b58ae6" },
  { id: "yellow", label: "YELLOW", swatch: "#ffe66d" },
  { id: "red", label: "RED", swatch: "#e87568" },
];

export const HAIR_STYLES: ReadonlyArray<{ id: HairStyleId; label: string }> = [
  { id: "none", label: "BALD" },
  { id: "bowl", label: "BOWL" },
  { id: "tousled", label: "TOUSLED" },
  { id: "fluffy", label: "FLUFFY" },
  { id: "short", label: "SHORT" },
  { id: "crew-cut", label: "CREW CUT" },
  { id: "twin-buns", label: "TWIN BUNS" },
  { id: "pigtails", label: "PIGTAILS" },
  { id: "wavy", label: "WAVY" },
  { id: "long", label: "LONG" },
  { id: "bob", label: "BOB" },
];

export const HAIR_COLORS: ReadonlyArray<{ id: HairColorId; label: string; swatch: string }> = [
  { id: "midnight", label: "MIDNIGHT", swatch: "#2b3445" },
  { id: "espresso", label: "ESPRESSO", swatch: "#4a3028" },
  { id: "chestnut", label: "CHESTNUT", swatch: "#9a6548" },
  { id: "silver", label: "SILVER", swatch: "#9ca6b5" },
  { id: "platinum", label: "PLATINUM", swatch: "#ddd8cf" },
  { id: "blonde", label: "BLONDE", swatch: "#d5aa5e" },
  { id: "auburn", label: "AUBURN", swatch: "#a94f42" },
  { id: "violet", label: "VIOLET", swatch: "#76599b" },
  { id: "denim", label: "DENIM", swatch: "#4f79a8" },
  { id: "sage", label: "SAGE", swatch: "#4f7d61" },
];

export const OUTFITS: ReadonlyArray<{ id: OutfitId; label: string }> = [
  { id: "purple-coat", label: "PURPLE COAT" },
  { id: "red-hoodie", label: "RED HOODIE" },
  { id: "blue-tank", label: "BLUE TANK" },
  { id: "overalls", label: "OVERALLS" },
  { id: "puffer-vest", label: "PUFFER VEST" },
  { id: "jersey-67", label: "67 JERSEY" },
  { id: "yellow-skirt", label: "YELLOW SKIRT" },
  { id: "teal-dress", label: "TEAL DRESS" },
  { id: "pinafore", label: "PINAFORE" },
  { id: "striped-pants", label: "STRIPED PANTS" },
];

export const ACCESSORIES: ReadonlyArray<{ id: AccessoryId; label: string }> = [
  { id: "round-glasses", label: "GLASSES" },
  { id: "hair-bow", label: "HAIR BOW" },
  { id: "necklace", label: "NECKLACE" },
];

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  skinTone: "peach",
  hairStyle: "short",
  hairColor: "midnight",
  outfit: "blue-tank",
  accessories: [],
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  ...DEFAULT_CHARACTER_CONFIG,
  color: "#4ecdc4",
  glow: "#00ff88",
};

const ids = <T extends string>(items: ReadonlyArray<{ id: T }>) => new Set(items.map((item) => item.id));
const skinIds = ids(SKIN_TONES);
const hairStyleIds = ids(HAIR_STYLES);
const hairColorIds = ids(HAIR_COLORS);
const outfitIds = ids(OUTFITS);
const accessoryIds = ids(ACCESSORIES);
const profileColors = new Set<string>(PROFILE_COLORS);

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const allowed = <T extends string>(value: unknown, values: Set<T>, fallback: T): T =>
  typeof value === "string" && values.has(value as T) ? value as T : fallback;

/** Normalises saved/server data and migrates the retired PixelMascot shape. */
export function normalizeAvatarConfig(value: unknown): AvatarConfig {
  const input = record(value);
  return {
    color: allowed(input.color, profileColors, DEFAULT_AVATAR_CONFIG.color),
    glow: allowed(input.glow, profileColors, DEFAULT_AVATAR_CONFIG.glow),
    skinTone: allowed(input.skinTone, skinIds, DEFAULT_AVATAR_CONFIG.skinTone),
    hairStyle: allowed(input.hairStyle, hairStyleIds, DEFAULT_AVATAR_CONFIG.hairStyle),
    hairColor: allowed(input.hairColor, hairColorIds, DEFAULT_AVATAR_CONFIG.hairColor),
    // Legacy mascot outfit names deliberately migrate to the clothed default.
    outfit: allowed(input.outfit, outfitIds, DEFAULT_AVATAR_CONFIG.outfit),
    accessories: Array.isArray(input.accessories)
      ? [...new Set(input.accessories.filter((item): item is AccessoryId => typeof item === "string" && accessoryIds.has(item as AccessoryId)))]
      : [],
  };
}
