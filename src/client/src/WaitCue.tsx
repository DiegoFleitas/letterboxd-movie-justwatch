import React from "react";
import { useReducedMotion } from "framer-motion";

export type WaitCueSize = "xs" | "sm" | "md";

export function WaitCue({
  size = "sm",
  className = "",
}: {
  size?: WaitCueSize;
  className?: string;
}): React.ReactElement {
  const reduce = useReducedMotion();
  const staticCls = reduce ? " wait-cue--static" : "";
  return (
    <span className={`wait-cue wait-cue--${size}${staticCls} ${className}`.trim()} aria-hidden>
      <span className="wait-cue__bar" />
      <span className="wait-cue__bar" />
      <span className="wait-cue__bar" />
    </span>
  );
}
