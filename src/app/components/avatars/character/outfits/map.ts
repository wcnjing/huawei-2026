import type { PixelMap } from "../types";

const EMPTY_ROW = "....................";

export function placeOutfit(startRow: number, rows: readonly string[]): PixelMap {
  return [
    ...Array.from({ length: startRow }, () => EMPTY_ROW),
    ...rows,
    ...Array.from({ length: 32 - startRow - rows.length }, () => EMPTY_ROW),
  ];
}

export const shiftLeft = (row: string) => `${row.slice(1)}.`;
