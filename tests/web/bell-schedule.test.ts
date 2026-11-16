import { expect, it } from "vitest";

import { buildBellDay, clockMinutes } from "@/modules/timetable/bell-schedule";

it("previews the whole school day with the long break after the selected lesson", () => {
  const day = buildBellDay("08:00", 6, 45, 10, 20, 2);
  expect(day[0]).toEqual({ position: 1, start_time: "08:00:00", end_time: "08:45:00" });
  expect(day[2]?.start_time).toBe("10:00:00");
  expect(day[5]?.end_time).toBe("13:30:00");
});
it("rejects invalid clocks and a school day that would run past midnight", () => {
  expect(() => clockMinutes("25:00")).toThrow();
  expect(() => buildBellDay("23:30", 2, 45, 10, 20, 1)).toThrow();
  expect(() => buildBellDay("08:00", 0, 45, 10, 20, 2)).toThrow();
});
