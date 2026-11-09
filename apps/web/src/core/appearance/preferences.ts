import { create } from "zustand";
import { persist } from "zustand/middleware";

export const appearanceDefaults = {
  accentColor: "lime",
  textSize: "md",
  density: "standard",
  reduceMotion: false,
  highContrast: false,
  contentWidth: "wide",
  fontFamily: "brand",
  corners: "soft",
  sidebarCollapsed: false,
  stripedRows: false,
};
type AppearancePreferences = typeof appearanceDefaults;
const choices: Partial<Record<keyof AppearancePreferences, readonly string[]>> = {
  accentColor: ["lime", "cyan", "purple", "pink", "orange", "mint", "yellow", "neutral"],
  textSize: ["sm", "md", "lg"],
  density: ["compact", "standard", "relaxed"],
  contentWidth: ["focused", "wide"],
  fontFamily: ["brand", "system"],
  corners: ["subtle", "soft", "round"],
};
export function normalizeAppearance(value: unknown): AppearancePreferences {
  const result = { ...appearanceDefaults };
  if (!value || typeof value !== "object") return result;
  for (const key of Object.keys(appearanceDefaults) as (keyof AppearancePreferences)[]) {
    const item = (value as Record<string, unknown>)[key];
    const options = choices[key];
    if (options && typeof item === "string" && options.includes(item))
      Object.assign(result, { [key]: item });
    else if (!options && typeof item === "boolean") Object.assign(result, { [key]: item });
  }
  return result;
}
interface AppearanceState extends AppearancePreferences {
  reset: () => void;
  setAccentColor: (value: string) => void;
  setTextSize: (value: string) => void;
  setDensity: (value: string) => void;
  setReduceMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setContentWidth: (value: string) => void;
  setFontFamily: (value: string) => void;
  setCorners: (value: string) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setStripedRows: (value: boolean) => void;
}
export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => {
      const update = (key: keyof AppearancePreferences, value: string | boolean) =>
        set({ [key]: normalizeAppearance({ [key]: value })[key] });
      return {
        ...appearanceDefaults,
        reset: () => set(appearanceDefaults),
        setAccentColor: (value) => update("accentColor", value),
        setTextSize: (value) => update("textSize", value),
        setDensity: (value) => update("density", value),
        setReduceMotion: (value) => update("reduceMotion", value),
        setHighContrast: (value) => update("highContrast", value),
        setContentWidth: (value) => update("contentWidth", value),
        setFontFamily: (value) => update("fontFamily", value),
        setCorners: (value) => update("corners", value),
        setSidebarCollapsed: (value) => update("sidebarCollapsed", value),
        setStripedRows: (value) => update("stripedRows", value),
      };
    },
    {
      name: "bod-appearance-storage",
      version: 1,
      skipHydration: true,
      partialize: (state) => normalizeAppearance(state),
      migrate: (state) => normalizeAppearance(state),
      merge: (persisted, current) => ({ ...current, ...normalizeAppearance(persisted) }),
    },
  ),
);
