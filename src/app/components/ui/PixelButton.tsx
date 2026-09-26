import { useState } from "react";

export function PixelButton({
  children,
  onClick,
  color = "#00ff88",
  textColor = "#0a0e1a",
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
        backgroundColor: disabled ? "#2a3a5c" : color,
        color: disabled ? "#6b8ba4" : textColor,
        border: `4px solid ${disabled ? "#1a2340" : "#0a0e1a"}`,
        boxShadow: pressed || disabled ? "none" : `4px 4px 0px #0a0e1a`,
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

