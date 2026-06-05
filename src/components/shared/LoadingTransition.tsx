import { Box } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type LoadingTransitionProps = HTMLAttributes<HTMLDivElement> & {
  fullScreen?: boolean;
};

export function LoadingTransition({ className, fullScreen = false, ...props }: LoadingTransitionProps) {
  return (
    <div
      className={cn(
        "eco-loading-transition relative isolate flex min-h-[50vh] items-center justify-center overflow-hidden bg-[#f7fbf8]",
        fullScreen && "fixed inset-0 min-h-screen",
        className
      )}
      role="status"
      aria-label="Chargement"
      {...props}
    >
      <div className="eco-loading-layer eco-loading-layer-primary" />
      <div className="eco-loading-layer eco-loading-layer-secondary" />
      <div className="eco-loading-sweep" />
      <div className="eco-loading-mark">
        <Box className="h-6 w-6 text-brand-700" aria-hidden="true" />
      </div>
    </div>
  );
}
