"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingTransition } from "@/components/shared/LoadingTransition";

export const NAVIGATION_LOADING_EVENT = "ecofoodstock:navigation-loading";

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function showLoading() {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

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
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 420);
  }, [pathname, visible]);

  if (!visible) {
    return null;
  }

  return (
    <LoadingTransition
      className="pointer-events-none fixed inset-x-0 bottom-20 top-16 z-[15] min-h-0 lg:bottom-0 lg:left-64"
      data-navigation-loading="true"
    />
  );
}

export function startNavigationLoading() {
  window.dispatchEvent(new Event(NAVIGATION_LOADING_EVENT));
}
