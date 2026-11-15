import { localParts, resolveReminderTime } from './reminder-time';
import { taskDateShift } from './task-workspace-time';

export type Shift = {
  displayTimeZone: string;
  workingStartMinute: number;
  workingEndMinute: number;
};
export const defaultShift: Shift = {
  displayTimeZone: 'America/Los_Angeles',
  workingStartMinute: 540,
  workingEndMinute: 1020,
};
export function withinShift(now: Date, p: Shift) {
  const clock = localParts(now, p.displayTimeZone).slice(11);
  const minute = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  return p.workingStartMinute < p.workingEndMinute
    ? minute >= p.workingStartMinute && minute < p.workingEndMinute
    : minute >= p.workingStartMinute || minute < p.workingEndMinute;
}
/** First actual minute at/after a wall clock, including DST gaps and repeated hours. */
export function shiftInstant(day: string, minute: number, zone: string) {
  for (let delta = 0; delta <= 180; delta++) {
    const clock = new Date(`${day}T00:00Z`);
    clock.setUTCMinutes(minute + delta);
    const local = clock.toISOString().slice(0, 16);
    const matches: Date[] = [];
    for (const offset of [-240, -300, -360, -420, -480]) {
      try {
        matches.push(
          resolveReminderTime(local, zone, new Date('1900-01-01Z'), offset)
            .dueAt,
        );
      } catch {
        /* Try the zone's other offset. */
      }
    }
    if (matches.length)
      return new Date(Math.min(...matches.map((d) => d.getTime())));
  }
  throw new Error('Unable to resolve shift start.');
}
export function nextShift(now: Date, p: Shift) {
  if (withinShift(now, p)) return now;
  const day = localParts(now, p.displayTimeZone).slice(0, 10);
  const start = shiftInstant(day, p.workingStartMinute, p.displayTimeZone);
  return start > now
    ? start
    : shiftInstant(
        taskDateShift(day, 1),
        p.workingStartMinute,
        p.displayTimeZone,
      );
}
export function shiftDay(now: Date, p: Shift) {
  const day = localParts(now, p.displayTimeZone).slice(0, 10);
  return shiftInstant(day, p.workingStartMinute, p.displayTimeZone) <= now
    ? day
    : taskDateShift(day, -1);
}
