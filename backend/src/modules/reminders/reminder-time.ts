import { BadRequestException } from '@nestjs/common';

export const DISPLAY_TIME_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
] as const;
export const CUSTOMER_TIME_ZONES = [
  ...DISPLAY_TIME_ZONES,
  'America/Phoenix',
] as const;
export const DEFAULT_REMINDER_TIME_ZONE = DISPLAY_TIME_ZONES[0];

const stateNames =
  'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming';
const states = stateNames.split('|').map((entry) => entry.split(':'));
export const US_STATE_CODES = states.map(([code]) => code);

export function normalizeUsState(value?: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  return (
    states.find(
      ([code, name]) =>
        code === normalized || name.toUpperCase() === normalized,
    )?.[0] ?? null
  );
}

export function customerTimeZone(state?: string | null): string {
  const code = normalizeUsState(state);
  if (code === 'AZ') return 'America/Phoenix';
  if (['CO', 'ID', 'MT', 'NM', 'UT', 'WY'].includes(code ?? ''))
    return 'America/Denver';
  if (
    [
      'AL',
      'AR',
      'IL',
      'IA',
      'KS',
      'LA',
      'MN',
      'MS',
      'MO',
      'NE',
      'ND',
      'OK',
      'SD',
      'TN',
      'TX',
      'WI',
    ].includes(code ?? '')
  )
    return 'America/Chicago';
  if (
    [
      'CT',
      'DE',
      'DC',
      'FL',
      'GA',
      'IN',
      'KY',
      'ME',
      'MD',
      'MA',
      'MI',
      'NH',
      'NJ',
      'NY',
      'NC',
      'OH',
      'PA',
      'RI',
      'SC',
      'VT',
      'VA',
      'WV',
    ].includes(code ?? '')
  )
    return 'America/New_York';
  return DEFAULT_REMINDER_TIME_ZONE;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
export function localParts(date: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

/** A wall clock and zone must resolve to exactly one instant; never silently shift a DST gap. */
export function resolveReminderTime(
  localDueAt: string,
  timeZone: string,
  now = new Date(),
  utcOffsetMinutes?: number,
) {
  if (!(CUSTOMER_TIME_ZONES as readonly string[]).includes(timeZone))
    throw new BadRequestException('Unsupported reminder time zone.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDueAt))
    throw new BadRequestException('Due time must use YYYY-MM-DDTHH:mm.');
  const nominal = Date.parse(`${localDueAt}:00.000Z`);
  if (
    !Number.isFinite(nominal) ||
    new Date(nominal).toISOString().slice(0, 16) !== localDueAt
  )
    throw new BadRequestException('Invalid due date or time.');
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const instant = nominal + hours * 3600000;
    const wallClock = Date.parse(
      `${localParts(new Date(instant), timeZone)}:00Z`,
    );
    offsets.add((wallClock - instant) / 60000);
  }
  const candidates = [...offsets]
    .filter(
      (offset) => utcOffsetMinutes === undefined || offset === utcOffsetMinutes,
    )
    .map((offset) => new Date(nominal - offset * 60000))
    .filter((date) => localParts(date, timeZone) === localDueAt);
  if (candidates.length === 0)
    throw new BadRequestException(
      'This local time does not exist in the selected time zone, or its UTC offset is invalid.',
    );
  if (candidates.length !== 1)
    throw new BadRequestException(
      'This local time occurs twice during daylight saving change. Choose its UTC offset.',
    );
  if (candidates[0] <= now)
    throw new BadRequestException('Reminder due time must be in the future.');
  return { dueAt: candidates[0], localDueAt, timeZone };
}
