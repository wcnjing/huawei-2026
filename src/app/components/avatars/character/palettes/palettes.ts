import type { HairColorId, PixelPalette, SkinToneId } from "../types";

export const skinPalettes: Record<SkinToneId, PixelPalette> = {
  peach: { m: "#f2ae85", s: "#e59a72", f: "#b96850" },
  golden: { m: "#d89a68", s: "#bf7952", f: "#8e4938" },
  brown: { m: "#a9684b", s: "#895039", f: "#67372f" },
  deep: { m: "#704133", s: "#553027", f: "#3c211e" },
};

export const hairPalettes: Record<HairColorId, PixelPalette> = {
  midnight: { h: "#111827" },
  brown: { h: "#49301f" },
  auburn: { h: "#7b3f2b" },
  gold: { h: "#c59432" },
  silver: { h: "#c7ced8" },
};

export const facePalette: PixelPalette = { e: "#0a0e1a", r: "#e8e1d5" };

