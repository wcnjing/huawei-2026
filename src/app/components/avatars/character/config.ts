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
  { id: "peach", label: "PEACH", swatch: "#f2ae85" },
  { id: "golden", label: "GOLDEN", swatch: "#d89a68" },
  { id: "brown", label: "BROWN", swatch: "#a9684b" },
  { id: "deep", label: "DEEP", swatch: "#704133" },
];

export const HAIR_STYLES: ReadonlyArray<{ id: HairStyleId; label: string }> = [
  { id: "long", label: "LONG" },
  { id: "pigtails", label: "PIGTAILS" },
  { id: "shoulder", label: "SHOULDER" },
  { id: "side-part", label: "SIDE PART" },
  { id: "cropped", label: "CROPPED" },
];

export const HAIR_COLORS: ReadonlyArray<{ id: HairColorId; label: string; swatch: string }> = [
  { id: "midnight", label: "MIDNIGHT", swatch: "#111827" },
  { id: "brown", label: "BROWN", swatch: "#49301f" },
  { id: "auburn", label: "AUBURN", swatch: "#7b3f2b" },
  { id: "gold", label: "GOLD", swatch: "#c59432" },
  { id: "silver", label: "SILVER", swatch: "#c7ced8" },
];

export const OUTFITS: ReadonlyArray<{ id: OutfitId; label: string }> = [
  { id: "sailor", label: "SAILOR" },
  { id: "yellow-dress", label: "SUN DRESS" },
  { id: "blue-shirt-pants", label: "BLUE SHIRT" },
  { id: "overalls", label: "OVERALLS" },
  { id: "green-sweater", label: "GREEN KNIT" },
];

export const ACCESSORIES: ReadonlyArray<{ id: AccessoryId; label: string }> = [
  { id: "round-glasses", label: "GLASSES" },
  { id: "hair-bow", label: "HAIR BOW" },
  { id: "necklace", label: "NECKLACE" },
];

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  skinTone: "peach",
  hairStyle: "long",
  hairColor: "midnight",
  outfit: "blue-shirt-pants",
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

