import { useEffect, useState } from "react";
import { accessoryRegistry } from "./accessories/accessoryRegistry";
import { StandardBody, StandardHead } from "./bodies/StandardBody";
import { hairRegistry } from "./hair/hairRegistry";
import { outfitRegistry } from "./outfits/outfitRegistry";
import { hairPalettes, skinPalettes } from "./palettes/palettes";
import { PixelLayer } from "./shared/PixelLayer";
import type { CharacterConfig } from "./types";

export function CharacterAvatar({
  config,
  size = 64,
  animate = false,
  title = "Customised character",
  variant = "full",
}: {
  config: CharacterConfig;
  /** Approximate rendered height, matching the old square avatar API. */
  size?: number;
  animate?: boolean;
  title?: string;
  /** Use a square, head-and-hair crop for compact message avatars. */
  variant?: "full" | "head";
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % 2), 600);
    return () => window.clearInterval(timer);
  }, [animate]);

  const skin = skinPalettes[config.skinTone] ?? skinPalettes.peach;
  const hair = hairPalettes[config.hairColor] ?? hairPalettes.midnight;
  const hairMap = config.hairStyle === "none" ? null : hairRegistry[config.hairStyle] ?? hairRegistry.short;
  // The registry has no unclothed entry: malformed data also falls back to blue + black.
  const outfit = outfitRegistry[config.outfit] ?? outfitRegistry["blue-tank"];
  const accessories = Array.isArray(config.accessories) ? config.accessories : [];
  const renderAccessories = (slot: "neck" | "face" | "head") => accessories.map((id) => {
    const definition = accessoryRegistry[id];
    if (!definition || definition.slot !== slot) return null;
    const Layer = definition.Layer;
    return <Layer key={id} />;
  });

  return (
    <svg
      width={variant === "head" ? size : size * 0.625}
      height={size}
      viewBox={variant === "head" ? "0 0 20 20" : "0 0 20 32"}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      style={{ display: "block", imageRendering: "pixelated", overflow: variant === "head" ? "hidden" : "visible", flexShrink: 0 }}
    >
      <title>{title}</title>
      <g transform={animate && frame ? "translate(0 -1)" : undefined}>
        {variant === "head" ? <StandardHead palette={skin} /> : <StandardBody palette={skin} />}
        {variant === "full" && <PixelLayer map={outfit.map} palette={outfit.palette} name={`outfit-${config.outfit}`} />}
        {variant === "full" && renderAccessories("neck")}
        {hairMap && <PixelLayer map={hairMap} palette={hair} name={`hair-${config.hairStyle}`} />}
        {renderAccessories("face")}
        {renderAccessories("head")}
      </g>
    </svg>
  );
}
