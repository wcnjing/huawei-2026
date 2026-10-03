import type { PixelMap } from "../types";

const EMPTY_ROW = "....................";

export function padHair(rows: readonly string[]): PixelMap {
  return [...rows, ...Array.from({ length: 32 - rows.length }, () => EMPTY_ROW)];
}
