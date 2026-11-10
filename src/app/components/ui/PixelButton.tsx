import { useState } from "react";
import { fill } from "../../utils/color";

// A button is always a solid neon fill with navy text, so a hue's text token passed as the
// colour (var(--teal), darker in light) becomes its fill (var(--teal-fill)).

export function PixelButton({
  children,
  onClick,
  color = "var(--green-fill)",
  textColor = "var(--on-fill)",
  size = "md",
  full = false,
  disabled = false,
  compact = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const pad = compact ? "" : size === "lg" ? "px-6 py-4" : size === "sm" ? "px-3 py-2" : "px-4 py-3";
  const textSize = compact ? "10px" : size === "lg" ? "var(--text-heading)" : size === "sm" ? "var(--text-label)" : "var(--text-body)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        fontSize: textSize,
        ...(compact ? { padding: "2px 6px", height: "26px", minHeight: "26px", boxSizing: "border-box" as const, lineHeight: "12px" } : {}),
        backgroundColor: disabled ? "var(--border)" : fill(color),
        color: disabled ? "var(--muted-foreground)" : textColor,
        border: `4px solid ${disabled ? "var(--secondary)" : "var(--outline)"}`,
        boxShadow: pressed || disabled ? "none" : `4px 4px 0px var(--outline)`,
        transform: pressed ? "translate(4px, 4px)" : "translate(0,0)",
        fontFamily: "'Share Tech Mono', monospace",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.05s, box-shadow 0.05s",
        imageRendering: "pixelated",
      }}
      className={`pixel-button ${pad} ${full ? "w-full" : ""} select-none outline-none`}
    >
      {children}
    </button>
  );
}

