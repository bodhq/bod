import { describe, expect, it } from "vitest";

import { cyclePhases, cyclePreview, cycleWeek } from "../../apps/web/src/modules/timetable/cycle";

const phases = [
  { key: "a", weekId: "A", duration: 2 },
  { key: "b", weekId: "B", duration: 1 },
];
describe("cycle preview", () => {
  it("repeats durations from the anchor without shifting at month or year boundaries", () => {
    expect(cyclePreview("2026-12-21", phases, 6).map((row) => [row.date, row.weekId])).toEqual([
      ["2026-12-21", "A"],
      ["2026-12-28", "A"],
      ["2027-01-04", "B"],
      ["2027-01-11", "A"],
      ["2027-01-18", "A"],
      ["2027-01-25", "B"],
    ]);
  });
  it("resolves negative offsets and every day of a week consistently", () => {
    expect(cycleWeek("2026-11-02", "2026-10-26", phases)).toBe("B");
    expect(cycleWeek("2026-11-02", "2026-11-15", phases)).toBe("A");
    expect(cycleWeek("2026-11-02", "2026-11-16", phases)).toBe("B");
  });
  it("does not invent a type for incomplete or invalid configuration", () => {
    expect(cycleWeek("2026-11-02", "2026-11-02", [])).toBeNull();
    expect(
      cycleWeek("2026-11-02", "2026-11-02", [{ key: "a", weekId: "A", duration: 0 }]),
    ).toBeNull();
    expect(
      cycleWeek("2026-11-02", "2026-11-02", [{ key: "a", weekId: "A", duration: 1.5 }]),
    ).toBeNull();
    expect(cyclePreview("", phases)).toEqual([]);
  });
  it("orders persisted phases by position", () => {
    expect(
      cyclePhases([
        { id: "second", position: 2, cycle_week_id: "B", duration_weeks: 1 },
        { id: "first", position: 1, cycle_week_id: "A", duration_weeks: 2 },
      ]),
    ).toEqual([
      { key: "first", weekId: "A", duration: 2 },
      { key: "second", weekId: "B", duration: 1 },
    ]);
  });
});
