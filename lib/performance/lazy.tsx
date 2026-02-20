"use client";

import React from "react";

function prefetchComponent(
  importFunc: () => Promise<unknown>
): void {
  if (typeof window !== "undefined") {
    setTimeout(() => {
      importFunc().catch(() => {});
    }, 100);
  }
}

function prefetchOnIdle(
  importFunc: () => Promise<unknown>
): void {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    requestIdleCallback(() => {
      importFunc().catch(() => {});
    });
  } else {
    prefetchComponent(importFunc);
  }
}

export function useComponentPreloader() {
  React.useEffect(() => {
    prefetchOnIdle(() => import("@/components/settings/SettingsDrawer"));
  }, []);
}
