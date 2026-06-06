"use client";

import type { HTMLAttributes } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

type LoadingTransitionPhase = "loading" | "revealing";

type LoadingTransitionProps = HTMLAttributes<HTMLDivElement> & {
  fullScreen?: boolean;
  phase?: LoadingTransitionPhase;
};

const stripeCount = 26;

const stripeDelays = [
  120,
  20,
  260,
  80,
  340,
  0,
  210,
  150,
  390,
  60,
  300,
  180,
  440,
  100,
  240,
  30,
  360,
  140,
  420,
  70,
  280,
  200,
  470,
  110,
  330,
  50
];

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
      <div className="eco-loading-stripes" aria-hidden="true">
        {Array.from({ length: stripeCount }, (_, index) => (
          <span
            className="eco-loading-stripe"
            key={index}
            style={
              {
                "--stripe-index": index,
                "--stripe-delay": `${stripeDelays[index]}ms`
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
