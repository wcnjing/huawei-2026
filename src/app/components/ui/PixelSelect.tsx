import type { CSSProperties, SelectHTMLAttributes } from "react";
import { IconChevron } from "../icons";

/**
 * A native <select> in the pixel style, with our chevron in place of the browser's arrow.
 * `style` goes on the select itself; `containerStyle` on the wrapper (width, margins).
 */
export function PixelSelect({ chevronColor = "var(--teal)", containerStyle, style, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { chevronColor?: string; containerStyle?: CSSProperties }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", ...containerStyle }}>
      <select
        {...props}
        style={{ appearance: "none", WebkitAppearance: "none", borderRadius: 0, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", padding: "6px 34px 6px 10px", width: "100%", ...style }}
      >
        {children}
      </select>
      <span aria-hidden="true" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
        <IconChevron size={12} color={chevronColor} />
      </span>
    </div>
  );
}
