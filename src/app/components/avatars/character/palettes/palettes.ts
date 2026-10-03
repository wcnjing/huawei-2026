import type { HairColorId, PixelPalette, SkinToneId } from "../types";

export const skinPalettes: Record<SkinToneId, PixelPalette> = {
  porcelain: { m: "#ffd4bd", s: "#e8ae91", f: "#b96850", e: "#0a0e1a", r: "#e8e1d5" },
  peach: { m: "#f2ae85", s: "#e59a72", f: "#b96850", e: "#0a0e1a", r: "#e8e1d5" },
  golden: { m: "#d89a68", s: "#bf7952", f: "#8e4938", e: "#0a0e1a", r: "#e8e1d5" },
  tan: { m: "#bd7e57", s: "#9e6044", f: "#743f34", e: "#0a0e1a", r: "#e8e1d5" },
  brown: { m: "#a9684b", s: "#895039", f: "#67372f", e: "#0a0e1a", r: "#e8e1d5" },
  deep: { m: "#704133", s: "#553027", f: "#3c211e", e: "#0a0e1a", r: "#e8e1d5" },
  green: { m: "#65c466", s: "#3f9b55", f: "#24613c", e: "#0a0e1a", r: "#e8e1d5" },
  blue: { m: "#68a9e8", s: "#4f79a8", f: "#315078", e: "#0a0e1a", r: "#e8e1d5" },
  purple: { m: "#b58ae6", s: "#8b6bba", f: "#60448c", e: "#0a0e1a", r: "#e8e1d5" },
  yellow: { m: "#ffe66d", s: "#d5aa5e", f: "#9a6548", e: "#0a0e1a", r: "#e8e1d5" },
  red: { m: "#e87568", s: "#c94f4f", f: "#8f3038", e: "#0a0e1a", r: "#e8e1d5" },
};

export const hairPalettes: Record<HairColorId, PixelPalette> = {
  midnight: { h: "#2b3445" },
  espresso: { h: "#4a3028" },
  chestnut: { h: "#9a6548" },
  silver: { h: "#9ca6b5" },
  platinum: { h: "#ddd8cf" },
  blonde: { h: "#d5aa5e" },
  auburn: { h: "#a94f42" },
  violet: { h: "#76599b" },
  denim: { h: "#4f79a8" },
  sage: { h: "#4f7d61" },
};
