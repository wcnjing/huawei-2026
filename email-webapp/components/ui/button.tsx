import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger" | "amber";
type Size = "sm" | "md";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-green/10 text-green border-green/40 hover:bg-green/20",
  outline: "bg-panel text-ink border-line hover:border-line-strong",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-white/5",
  danger: "bg-panel text-ink border-line hover:border-danger hover:text-danger",
  amber: "bg-amber/10 text-amber border-amber/50 hover:bg-amber/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[11.5px] px-3 py-[7px]",
  md: "text-xs px-4 py-[9px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "font-mono tracking-wide rounded-[3px] border cursor-pointer transition-transform active:translate-y-px disabled:opacity-40 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-2 uppercase",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
