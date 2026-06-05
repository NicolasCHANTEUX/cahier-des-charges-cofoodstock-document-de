"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

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
    }, 180);
  }, [pathname, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-white/35 backdrop-blur-[1px]"
      data-navigation-loading="true"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 shadow-soft">
        <LoadingSpinner />
      </div>
    </div>
  );
}

export function startNavigationLoading() {
  window.dispatchEvent(new Event(NAVIGATION_LOADING_EVENT));
}
