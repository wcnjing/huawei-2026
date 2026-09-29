export type SkinToneId = "peach" | "golden" | "brown" | "deep";
export type HairStyleId = "long" | "pigtails" | "shoulder" | "side-part" | "cropped";
export type HairColorId = "midnight" | "brown" | "auburn" | "gold" | "silver";
export type OutfitId = "sailor" | "yellow-dress" | "blue-shirt-pants" | "overalls" | "green-sweater";
export type AccessoryId = "round-glasses" | "hair-bow" | "necklace";

export interface CharacterConfig {
  skinTone: SkinToneId;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  outfit: OutfitId;
  accessories: AccessoryId[];
}

export interface AvatarConfig extends CharacterConfig {
  // These remain profile/room theme settings; the character art uses the palettes above.
  color: string;
  glow: string;
}

export type PixelMap = readonly string[];
export type PixelPalette = Readonly<Record<string, string>>;

