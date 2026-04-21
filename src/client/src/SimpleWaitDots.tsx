import React from "react";

/** Minimal opacity-only dots for tight layouts (e.g. movie search field + button). */
export function SimpleWaitDots({
  variant = "muted",
  className = "",
}: {
  variant?: "muted" | "on-accent";
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={`simple-wait-dots simple-wait-dots--${variant} ${className}`.trim()}
      aria-hidden
    >
      <span className="simple-wait-dots__dot" />
      <span className="simple-wait-dots__dot" />
      <span className="simple-wait-dots__dot" />
    </span>
  );
}
