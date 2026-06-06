"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

export const NAVIGATION_LOADING_EVENT = "ecofoodstock:navigation-loading";

const LoadingTransition = dynamic(
  () => import("@/components/shared/LoadingTransition").then((mod) => mod.LoadingTransition),
  { ssr: false }
);

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"loading" | "revealing">("loading");
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingPathRef = useRef(pathname);
  const loadingStartedAtRef = useRef(0);

  useEffect(() => {
    function showLoading() {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      loadingPathRef.current = pathname;
      loadingStartedAtRef.current = Date.now();
      setPhase("loading");
      setVisible(true);

      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
      }

      maxTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, 6000);
    }

    window.addEventListener(NAVIGATION_LOADING_EVENT, showLoading);

    return () => {
      window.removeEventListener(NAVIGATION_LOADING_EVENT, showLoading);

      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible || phase === "revealing" || pathname === loadingPathRef.current) {
      return;
    }

    const elapsed = Date.now() - loadingStartedAtRef.current;
    const revealDelay = Math.max(0, 260 - elapsed);

    hideTimerRef.current = setTimeout(() => {
      setPhase("revealing");

      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, 1080);
    }, revealDelay);
  }, [pathname, phase, visible]);

  if (!visible) {
    return null;
  }

  return (
    <LoadingTransition
      className="pointer-events-none fixed inset-x-0 bottom-20 top-16 z-[15] min-h-0 lg:bottom-0 lg:left-64"
      data-navigation-loading="true"
      phase={phase}
    />
  );
}

export function startNavigationLoading() {
  window.dispatchEvent(new Event(NAVIGATION_LOADING_EVENT));
}
