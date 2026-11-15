import { localInput } from "./RemindersPanel";
export function shiftTaskDate(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function calendarDays(day: string, view: string) {
  if (view === "day") return [day];
  const first = view === "month" ? `${day.slice(0, 7)}-01` : day;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = shiftTaskDate(first, -((weekday + 6) % 7));
  return Array.from({ length: view === "month" ? 42 : 7 }, (_, i) =>
    shiftTaskDate(start, i),
  );
}
export function shiftCalendarMonth(day: string, months: number) {
  const date = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
export function displayClockToUtc(local: string, zone: string) {
  const wall = Date.parse(`${local}:00Z`);
  const matches = [-480, -420, -360, -300, -240]
    .map((offset) => new Date(wall - offset * 60000))
    .filter((date) => localInput(date, zone) === local);
  if (matches.length !== 1)
    throw Error(
      "This time is unavailable or occurs twice because of daylight saving. Use Edit to select an explicit time.",
    );
  return matches[0].toISOString();
}
export function taskDayLabel(day: string, today: string) {
  return day < today
    ? "Overdue"
    : day === today
      ? "Today"
      : day === shiftTaskDate(today, 1)
        ? "Tomorrow"
        : "Later";
}
