import { plainToInstance } from 'class-transformer';
import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateReminderPreferenceDto } from './dto/update-reminder-preference.dto';
import { ReminderPreferencesService } from './reminder-preferences.service';

describe('reminder preference boundaries', () => {
  const actor = {
    userId: 'sales',
    role: Role.SALES,
    name: 'Sales',
    email: 'sales@example.test',
  };
  const prisma = {
    reminderSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn() },
    reminderUserPreference: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const service = new ReminderPreferencesService(
    prisma as unknown as PrismaService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'sales' });
    prisma.reminderUserPreference.findUnique.mockResolvedValue(null);
    prisma.reminderUserPreference.upsert.mockResolvedValue({
      userId: 'sales',
      displayTimeZone: 'America/New_York',
    });
  });
  it('returns Pacific defaults without writing a row or touching the User record', async () => {
    expect(await service.get('sales', actor)).toMatchObject({
      displayTimeZone: 'America/Los_Angeles',
      dailyDigestEnabled: true,
    });
    expect(prisma.reminderUserPreference.upsert).not.toHaveBeenCalled();
  });
  it('accepts transformed partial DTOs and ignores their undefined class fields', async () => {
    await service.update(
      'sales',
      plainToInstance(UpdateReminderPreferenceDto, {
        displayTimeZone: 'America/New_York',
      }),
      actor,
    );
    expect(prisma.reminderUserPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'sales' },
      create: { userId: 'sales', displayTimeZone: 'America/New_York' },
      update: { displayTimeZone: 'America/New_York' },
    });
  });
  it.each([
    {},
    { displayTimeZone: 'UTC' },
    { workingStartMinute: -1 },
    { workingEndMinute: 1440 },
    { workingStartMinute: 1.5 },
    { dailyDigestEnabled: 'true' },
    { displayTimeZone: null },
    { unknown: true },
    { workingStartMinute: 1020 },
  ])('rejects invalid preference data %j', async (input) => {
    await expect(
      service.update('sales', input as UpdateReminderPreferenceDto, actor),
    ).rejects.toThrow();
    expect(prisma.reminderUserPreference.upsert).not.toHaveBeenCalled();
  });
  it('denies another user before any database read or write', async () => {
    await expect(service.get('other', actor)).rejects.toThrow('only your own');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
  it('allows Admin to set another user preference and supports overnight shifts', async () => {
    await service.update(
      'sales',
      { workingStartMinute: 1200, workingEndMinute: 360 },
      { ...actor, userId: 'admin', role: Role.ADMIN },
    );
    expect(prisma.reminderUserPreference.upsert).toHaveBeenCalled();
  });
});
