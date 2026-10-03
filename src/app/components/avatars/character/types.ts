export type SkinToneId =
  | "porcelain"
  | "peach"
  | "golden"
  | "tan"
  | "brown"
  | "deep"
  | "green"
  | "blue"
  | "purple"
  | "yellow"
  | "red";
export type HairStyleId =
  | "none"
  | "bowl"
  | "tousled"
  | "fluffy"
  | "short"
  | "crew-cut"
  | "twin-buns"
  | "pigtails"
  | "wavy"
  | "long"
  | "bob";
export type HairColorId =
  | "midnight"
  | "espresso"
  | "chestnut"
  | "silver"
  | "platinum"
  | "blonde"
  | "auburn"
  | "violet"
  | "denim"
  | "sage";
export type OutfitId =
  | "purple-coat"
  | "red-hoodie"
  | "blue-tank"
  | "overalls"
  | "puffer-vest"
  | "jersey-67"
  | "yellow-skirt"
  | "teal-dress"
  | "pinafore"
  | "striped-pants";
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
export type OutfitDefinition = Readonly<{ map: PixelMap; palette: PixelPalette }>;
