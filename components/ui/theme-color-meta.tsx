"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = {
  light: "#edf5f9",
  dark: "#030812",
} as const;

export const SPLASH_THEME_COLOR = "#0e131c";

function setThemeColorMeta(color: string) {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"][data-dynamic="true"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("data-dynamic", "true");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = resolvedTheme === "light" ? THEME_COLORS.light : THEME_COLORS.dark;
    setThemeColorMeta(color);
  }, [resolvedTheme]);

  return null;
}
