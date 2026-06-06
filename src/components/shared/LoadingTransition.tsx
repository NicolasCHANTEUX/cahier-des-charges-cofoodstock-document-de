"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type LoadingTransitionPhase = "loading" | "revealing";

type LoadingTransitionProps = HTMLAttributes<HTMLDivElement> & {
  fullScreen?: boolean;
  phase?: LoadingTransitionPhase;
};

const tileCount = 168;
const tileColors = [
  "rgba(209, 250, 229, 0.86)",
  "rgba(187, 247, 208, 0.8)",
  "rgba(204, 251, 241, 0.82)",
  "rgba(240, 253, 244, 0.78)",
  "rgba(254, 243, 199, 0.72)"
];

function createTileStyle(index: number) {
  return {
    "--tile-color": tileColors[index % tileColors.length],
    "--tile-enter-delay": `${(index * 23) % 190}ms`,
    "--tile-reveal-delay": `${(index * 47) % 520}ms`,
    "--tile-wave-delay": `${(index * 31) % 900}ms`
  } as CSSProperties;
}

export function LoadingTransition({ className, fullScreen = false, phase = "loading", ...props }: LoadingTransitionProps) {
  return (
    <div
      className={cn(
        "eco-loading-transition relative isolate flex min-h-[50vh] items-center justify-center overflow-hidden",
        fullScreen && "fixed inset-0 min-h-screen",
        className
      )}
      data-phase={phase}
      role="status"
      aria-label="Chargement"
      {...props}
    >
      <div className="eco-loading-mosaic" aria-hidden="true">
        {Array.from({ length: tileCount }, (_, index) => (
          <span className="eco-loading-tile" key={index} style={createTileStyle(index)} />
        ))}
      </div>
      <div className="eco-loading-focus" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
