"use client";

import { useLayoutEffect } from "react";

import { useAppearanceStore } from "@/core/appearance/preferences";

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const appearance = useAppearanceStore();
  useLayoutEffect(() => {
    void useAppearanceStore.persist.rehydrate();
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const attributes = {
      "data-accent": appearance.accentColor,
      "data-text-size": appearance.textSize,
      "data-density": appearance.density,
      "data-content-width": appearance.contentWidth,
      "data-font": appearance.fontFamily,
      "data-corners": appearance.corners,
      "data-row-guides": appearance.stripedRows ? "striped" : "plain",
      "data-reduce-motion": String(appearance.reduceMotion),
      "data-high-contrast": String(appearance.highContrast),
    };
    for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, value);
  }, [appearance]);
  return <>{children}</>;
}
