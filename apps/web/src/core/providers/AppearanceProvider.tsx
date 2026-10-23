"use client";

import { useEffect } from "react";

import { useAppearanceStore } from "@/core/store/appearance";

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { accentColor, textSize, density, reduceMotion, highContrast } = useAppearanceStore();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-accent", accentColor);
    root.setAttribute("data-text-size", textSize);
    root.setAttribute("data-density", density);

    if (reduceMotion) root.setAttribute("data-reduce-motion", "true");
    else root.removeAttribute("data-reduce-motion");

    if (highContrast) root.setAttribute("data-high-contrast", "true");
    else root.removeAttribute("data-high-contrast");
  }, [accentColor, textSize, density, reduceMotion, highContrast]);

  return <>{children}</>;
}
