/** A hue token (text, line or fill): the colours that get the light outline. */
const HUE = /^var\(--(green|yellow|teal|red|orange|violet|cyan|pink)(-fill|-line)?\)$/;

/**
 * `edge`: give the grey gear the dark outline in light too, like the coloured icons next to it
 * (an experiment from the light-theme review; the app header uses it).
 * Inner lines (light-theme review): in a colour (the yellow House settings tab) the gear gets the
 * thin inner line so its centre stands out; grey, it keeps the outline only.
 */
export function IconGear({ size = 16, color = "var(--muted-foreground)", edge = false }: { size?: number; color?: string; edge?: boolean }) {
  return (
    <svg className={edge ? "px-icon px-edge" : "px-icon"} data-inner={HUE.test(color.trim()) ? "thin" : undefined} width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M4 4h4v1h-4zM4 5h1v2h-1zM7 5h1v2h-1zM4 7h4v1h-4z" />
      <path className="px-hole-line" fill="none" d="M4 4H8V8H4ZM6 5H5V7H7V5Z" />
      <rect x={4} y={0} width={4} height={2} fill={color} />
      <rect x={2} y={2} width={8} height={2} fill={color} />
      <rect x={0} y={4} width={4} height={4} fill={color} />
      <rect x={8} y={4} width={4} height={4} fill={color} />
      <rect x={5} y={5} width={2} height={2} fill={color} />
      <rect x={2} y={8} width={8} height={2} fill={color} />
      <rect x={4} y={10} width={4} height={2} fill={color} />
    </svg>
  );
}
