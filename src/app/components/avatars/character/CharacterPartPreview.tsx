import type { ReactNode } from "react";
import { accessoryRegistry } from "./accessories/accessoryRegistry";
import { hairRegistry } from "./hair/hairRegistry";
import { outfitRegistry } from "./outfits/outfitRegistry";
import { hairPalettes } from "./palettes/palettes";
import { PixelLayer } from "./shared/PixelLayer";
import type { AccessoryId, HairColorId, HairStyleId, OutfitId, PixelMap } from "./types";

function mapViewBox(map: PixelMap): string {
  let minX = 20;
  let minY = 32;
  let maxX = -1;
  let maxY = -1;
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === ".") continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  });
  return maxX < 0 ? "0 0 20 32" : `${minX - 1} ${minY - 1} ${maxX - minX + 3} ${maxY - minY + 3}`;
}

function PartSvg({ viewBox, label, children }: { viewBox: string; label: string; children: ReactNode }) {
  return (
    <svg
      width={62}
      height={48}
      viewBox={viewBox}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      style={{ display: "block", imageRendering: "pixelated", overflow: "visible" }}
    >
      {children}
    </svg>
  );
}

export function HairPreview({ style, color, label }: {
  style: Exclude<HairStyleId, "none">;
  color: HairColorId;
  label: string;
}) {
  const map = hairRegistry[style];
  return (
    <PartSvg viewBox={mapViewBox(map)} label={label}>
      <PixelLayer map={map} palette={hairPalettes[color]} name={`preview-hair-${style}`} />
    </PartSvg>
  );
}

export function OutfitPreview({ outfit, label }: { outfit: OutfitId; label: string }) {
  const definition = outfitRegistry[outfit];
  return (
    <PartSvg viewBox={mapViewBox(definition.map)} label={label}>
      <PixelLayer map={definition.map} palette={definition.palette} name={`preview-outfit-${outfit}`} />
    </PartSvg>
  );
}

const ACCESSORY_VIEW_BOX: Record<AccessoryId, string> = {
  "round-glasses": "5 6 11 5",
  "hair-bow": "11 1 9 5",
  necklace: "7 14 6 5",
};

export function AccessoryPreview({ accessory, label }: { accessory: AccessoryId; label: string }) {
  const Layer = accessoryRegistry[accessory].Layer;
  return <PartSvg viewBox={ACCESSORY_VIEW_BOX[accessory]} label={label}><Layer /></PartSvg>;
}
