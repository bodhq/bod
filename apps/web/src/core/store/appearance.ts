import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppearanceState {
  accentColor: string;
  textSize: string;
  density: string;
  reduceMotion: boolean;
  highContrast: boolean;
  setAccentColor: (color: string) => void;
  setTextSize: (size: string) => void;
  setDensity: (density: string) => void;
  setReduceMotion: (reduce: boolean) => void;
  setHighContrast: (high: boolean) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      accentColor: 'lime',
      textSize: 'md',
      density: 'standard',
      reduceMotion: false,
      highContrast: false,
      setAccentColor: (accentColor) => set({ accentColor }),
      setTextSize: (textSize) => set({ textSize }),
      setDensity: (density) => set({ density }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),
    }),
    { name: 'bod-appearance-storage' },
  ),
);
