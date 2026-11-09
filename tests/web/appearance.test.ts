import { beforeEach, expect, it } from "vitest";

import {
  appearanceDefaults,
  normalizeAppearance,
  useAppearanceStore,
} from "@/core/appearance/preferences";

beforeEach(() => {
  useAppearanceStore.getState().reset();
  localStorage.clear();
});
it("keeps supported old preferences and supplies defaults for new settings", () => {
  expect(
    normalizeAppearance({
      density: "compact",
      accentColor: "purple",
      textSize: "sm",
      reduceMotion: true,
    }),
  ).toEqual({
    ...appearanceDefaults,
    density: "compact",
    accentColor: "purple",
    textSize: "sm",
    reduceMotion: true,
  });
});
it("rejects malformed persisted values instead of applying broken CSS settings", () => {
  expect(
    normalizeAppearance({
      density: "dense",
      textSize: 99,
      contentWidth: "100000px",
      corners: "none",
      highContrast: "true",
      accentColor: "url(bad)",
    }),
  ).toEqual(appearanceDefaults);
});
it("migrates old storage and keeps working setters after hydration", async () => {
  localStorage.setItem(
    "bod-appearance-storage",
    JSON.stringify({
      version: 0,
      state: { density: "compact", accentColor: "cyan", highContrast: true },
    }),
  );
  await useAppearanceStore.persist.rehydrate();
  expect(useAppearanceStore.getState()).toMatchObject({
    ...appearanceDefaults,
    density: "compact",
    accentColor: "cyan",
    highContrast: true,
  });
  useAppearanceStore.getState().setContentWidth("focused");
  expect(JSON.parse(localStorage.getItem("bod-appearance-storage") ?? "{}").state).toMatchObject({
    density: "compact",
    contentWidth: "focused",
  });
});
it("resets every preference without removing store actions", () => {
  const store = useAppearanceStore.getState();
  store.setDensity("relaxed");
  store.setCorners("round");
  store.setFontFamily("system");
  store.setSidebarCollapsed(true);
  store.setStripedRows(true);
  store.reset();
  expect(normalizeAppearance(useAppearanceStore.getState())).toEqual(appearanceDefaults);
  expect(typeof useAppearanceStore.getState().setDensity).toBe("function");
});
