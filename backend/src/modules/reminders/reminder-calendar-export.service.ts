import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { QueryTaskWorkspaceDto } from './dto/query-task-workspace.dto';
import { TaskWorkspaceService } from './task-workspace.service';
export function icsText(text: string) {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
export function foldCalendarLine(line: string) {
  let result = '',
    current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > 75) {
      result += current + '\r\n';
      current = ' ';
    }
    current += ch;
  }
  return result + current;
}
const stamp = (value: Date | string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
@Injectable()
export class ReminderCalendarExportService {
  constructor(
    private readonly workspace: TaskWorkspaceService,
    private readonly config: ConfigService,
  ) {}
  async export(
    q: QueryTaskWorkspaceDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    if (!q.from || !q.to)
      throw new BadRequestException('Choose a date range for calendar export.');
    const data = await this.workspace.list(
      { ...q, calendar: true, page: 1 },
      user,
      now,
      true,
    );
    if (data.total > 5000)
      throw new BadRequestException(
        'More than 5,000 tasks. Narrow the dates or filters before exporting.',
      );
    let origin =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('CRM_BASE_URL') ||
      'https://crm.meeautoparts.com';
    try {
      const url = new URL(origin);
      if (
        url.username ||
        url.password ||
        !(
          url.protocol === 'https:' ||
          (url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname))
        )
      )
        throw Error();
      origin = url.origin;
    } catch {
      throw new BadRequestException(
        'CRM calendar link origin is not configured correctly.',
      );
    }
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MEE Auto Parts CRM//Tasks//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:MEE CRM tasks',
    ];
    for (const row of data.items)
      lines.push(
        'BEGIN:VEVENT',
        `UID:${row.id}@mee-crm`,
        `DTSTAMP:${stamp(now)}`,
        `LAST-MODIFIED:${stamp(row.updatedAt)}`,
        `DTSTART:${stamp(row.dueAt)}`,
        `DTEND:${stamp(new Date(new Date(row.dueAt).getTime() + 15 * 60000))}`,
        `SUMMARY:${icsText(`${row.status === 'COMPLETED' ? 'Done: ' : ''}${row.title}${row.record.reference ? ' · ' + row.record.reference : ''}`)}`,
        `DESCRIPTION:${icsText([row.record.customerName, `${row.timeZone} · ${row.status}`, row.seriesId ? 'Current scheduled occurrence only; future occurrences depend on completion.' : ''].filter(Boolean).join('\n'))}`,
        `URL:${origin}/my-tasks?task=${row.id}`,
        `STATUS:${row.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      );
    lines.push('END:VCALENDAR');
    return Buffer.from(
      lines.map(foldCalendarLine).join('\r\n') + '\r\n',
      'utf8',
    );
  }
}
