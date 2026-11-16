export function clockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    throw new Error("Zadejte platný čas.");
  return Number(match[1]) * 60 + Number(match[2]);
}
export function clockTime(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440)
    throw new Error("Vyučování musí skončit v rámci jednoho dne.");
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
}
export function buildBellDay(
  start: string,
  count: number,
  duration: number,
  pause: number,
  longPause: number,
  longAfter: number,
) {
  if (
    ![count, duration, pause, longPause, longAfter].every(Number.isInteger) ||
    count < 1 ||
    count > 12 ||
    duration < 15 ||
    duration > 180 ||
    pause < 0 ||
    pause > 90 ||
    longPause < 0 ||
    longPause > 120 ||
    longAfter < 0 ||
    longAfter > 12
  )
    throw new Error("Zkontrolujte počet hodin a délku vyučování a přestávek.");
  let next = clockMinutes(start);
  return Array.from({ length: count }, (_, index) => {
    const row = {
      position: index + 1,
      start_time: clockTime(next),
      end_time: clockTime(next + duration),
    };
    next += duration + (index + 1 === longAfter ? longPause : pause);
    return row;
  });
}
