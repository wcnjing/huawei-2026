import type { PixelMap, PixelPalette } from "../types";

export function PixelLayer({ map, palette, name }: { map: PixelMap; palette: PixelPalette; name: string }) {
  const runs: Array<{ x: number; y: number; width: number; fill: string }> = [];
  map.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const key = row[x];
      if (key === ".") { x += 1; continue; }
      let end = x + 1;
      while (end < row.length && row[end] === key) end += 1;
      const fill = palette[key];
      if (fill) runs.push({ x, y, width: end - x, fill });
      x = end;
    }
  });

  return (
    <g data-character-layer={name}>
      {runs.map((run, index) => (
        <rect key={`${run.y}-${run.x}-${index}`} x={run.x} y={run.y} width={run.width} height={1} fill={run.fill} />
      ))}
    </g>
  );
}

