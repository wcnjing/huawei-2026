import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10.5px] px-2 py-1 rounded-[3px] border border-line bg-panel-alt text-ink-soft uppercase tracking-wide",
        className
      )}
      {...props}
    />
  );
}
