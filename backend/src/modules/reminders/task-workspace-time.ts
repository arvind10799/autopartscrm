import { BadRequestException } from '@nestjs/common';
import { localParts, resolveReminderTime } from './reminder-time';

export function taskDateShift(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid calendar date.');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function taskDayStart(value: string, zone: string) {
  taskDateShift(value, 0);
  return resolveReminderTime(
    `${value}T00:00`,
    zone,
    new Date('1900-01-01T00:00Z'),
  ).dueAt;
}
export function taskDayBounds(now: Date, zone: string) {
  const today = localParts(now, zone).slice(0, 10);
  return {
    today,
    start: taskDayStart(today, zone),
    end: taskDayStart(taskDateShift(today, 1), zone),
    nextEnd: taskDayStart(taskDateShift(today, 8), zone),
  };
}
