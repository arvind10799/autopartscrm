/* Isolated PostgreSQL test. Never reads .env, connects to RDS, or uses CRM seed data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const migrationName = '20261114090000_add_reminders_foundation';
const pgBin =
  process.env.REMINDERS_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name) =>
  path.join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''));
const tempRoot = path.join(root, 'tmp');
fs.mkdirSync(tempRoot, { recursive: true });
const work = fs.mkdtempSync(path.join(tempRoot, 'reminders-phase1-pg-'));
const data = path.join(work, 'data');
const ids = Object.fromEntries(
  [
    'admin',
    'sales',
    'other',
    'shipping',
    'shipping2',
    'inactive',
    'lead',
    'website',
    'order',
    'shipment',
    'replacement',
    'invoice',
    'note',
  ].map((key) => [key, randomUUID()]),
);
let started = false;
let prisma;
let port;
const run = (file, args, options = {}) =>
  execFileSync(file, args, {
    cwd: backend,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
function psql(sql, database = 'reminders_phase1') {
  return run(executable('psql'), [
    '-X',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'reminder_phase1',
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-c',
    sql,
  ]).trim();
}
function sqlFile(file) {
  run(executable('psql'), [
    '-X',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'reminder_phase1',
    '-d',
    'reminders_phase1',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    file,
  ]);
}
function snapshot(tables) {
  return Object.fromEntries(
    tables.map((table) => {
      assert.match(table, /^[A-Za-z_]+$/);
      const row =
        table === 'Order'
          ? "to_jsonb(t) - 'billingState'"
          : table === 'Notification'
            ? "to_jsonb(t) - 'reminderId' - 'reminderDeliveryId'"
            : 'to_jsonb(t)';
      return [
        table,
        psql(
          `SELECT COALESCE(jsonb_agg(row ORDER BY row::text), '[]'::jsonb)::text FROM (SELECT ${row} AS row FROM "${table}" t) s`,
        ),
      ];
    }),
  );
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve),
  );
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
async function main() {
  console.log('Initializing a new disposable loopback PostgreSQL cluster.');
  for (const name of ['initdb', 'pg_ctl', 'psql'])
    assert.ok(
      fs.existsSync(executable(name)),
      `Set REMINDERS_TEST_PG_BIN to PostgreSQL binaries; missing ${name}`,
    );
  port = await freePort();
  run(executable('initdb'), [
    '-D',
    data,
    '-U',
    'reminder_phase1',
    '--auth=trust',
    '--encoding=UTF8',
    '--no-locale',
  ]);
  run(
    executable('pg_ctl'),
    [
      '-D',
      data,
      '-l',
      path.join(work, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -F`,
      '-w',
      '-t',
      '30',
      'start',
    ],
    { stdio: 'ignore', timeout: 45000 },
  );
  started = true;
  console.log('Local cluster ready; applying historical migrations.');
  psql('CREATE DATABASE reminders_phase1', 'postgres');
  const migrations = path.join(backend, 'prisma/migrations');
  const previous = fs
    .readdirSync(migrations)
    .filter(
      (name) =>
        name < migrationName &&
        fs.existsSync(path.join(migrations, name, 'migration.sql')),
    )
    .sort();
  assert.ok(previous.length > 0);
  for (const name of previous)
    sqlFile(path.join(migrations, name, 'migration.sql'));

  const users = [
    ['admin', 'ADMIN'],
    ['sales', 'SALES'],
    ['other', 'SALES'],
    ['shipping', 'SHIPPING'],
    ['shipping2', 'SHIPPING'],
    ['inactive', 'SALES'],
  ];
  for (const [key, role] of users)
    psql(
      `INSERT INTO "User" (id,name,email,"passwordHash",role,"isActive","updatedAt") VALUES ('${ids[key]}','Synthetic ${key}','${key}@example.test','synthetic-not-a-login','${role}',${key !== 'inactive'},CURRENT_TIMESTAMP)`,
    );
  psql(`
    INSERT INTO "Lead" (id,"leadDate","adviserName",cmpt,"customerPhone","customerName",state,"partDescription",prospects,"createdById","updatedAt") VALUES ('${ids.lead}',CURRENT_TIMESTAMP,'Synthetic adviser','YES','5550000000','Synthetic Lead','NY','Synthetic part','Synthetic','${ids.sales}',CURRENT_TIMESTAMP);
    INSERT INTO "WebsiteLead" (id,source,"sourceFormId","externalSubmissionId","submittedAt","customerName",state,"assignedToId","updatedAt") VALUES ('${ids.website}','TEST','test-form','test-submission',CURRENT_TIMESTAMP,'Synthetic Inquiry','TX','${ids.sales}',CURRENT_TIMESTAMP);
    INSERT INTO "Order" (id,"orderNumber","customerName","partDescription",price,quantity,"totalSaleAmount",status,"createdById","intakeDetails","updatedAt") VALUES ('${ids.order}','TEST-PHASE1','Synthetic Order','Synthetic part',100,1,100,'CONFIRMED','${ids.sales}','{"billingAddress":"Synthetic original address"}',CURRENT_TIMESTAMP);
    INSERT INTO "Shipment" (id,"orderId",status,"updatedAt") VALUES ('${ids.shipment}','${ids.order}','IN_TRANSIT',CURRENT_TIMESTAMP);
    INSERT INTO "ReplacementRequest" (id,"orderId","shipmentId","customerReason","createdById","updatedAt") VALUES ('${ids.replacement}','${ids.order}','${ids.shipment}','Synthetic reason','${ids.shipping}',CURRENT_TIMESTAMP);
    INSERT INTO "Invoice" (id,"orderId","invoiceNumber","invoiceDate","customerName","itemDescription",quantity,"saleAmount","totalAmount","warrantyPartsOnly","updatedAt") VALUES ('${ids.invoice}','${ids.order}','TEST-INVOICE',CURRENT_TIMESTAMP,'Synthetic Customer','Synthetic part',1,100,100,'Original synthetic warranty text',CURRENT_TIMESTAMP);
    INSERT INTO "Note" (id,content,"entityType","authorId","leadId","updatedAt") VALUES ('${ids.note}','Original synthetic note','LEAD','${ids.sales}','${ids.lead}',CURRENT_TIMESTAMP);
  `);
  const tables = psql(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  )
    .split('\n')
    .map((s) => s.trim());
  const before = snapshot(tables);
  sqlFile(path.join(migrations, migrationName, 'migration.sql'));
  for (const name of fs
    .readdirSync(migrations)
    .filter(
      (name) =>
        name > migrationName &&
        fs.existsSync(path.join(migrations, name, 'migration.sql')),
    )
    .sort()) {
    let reminderSnapshot;
    const fixtureId = randomUUID();
    const snapshotReminders = () =>
      psql(
        `SELECT jsonb_build_object('tasks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM "Reminder" t),'history',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM "ReminderHistory" t),'rules',(SELECT jsonb_agg(to_jsonb(t) ORDER BY key) FROM "ReminderSuggestionRule" t),'settings',(SELECT to_jsonb(t)-ARRAY['callingWindowEnabled','snoozeMinutes','defaultDisplayTimeZone','stateTimeZones','policyVersion'] FROM "ReminderSettings" t WHERE id='default'))`,
      );
    if (name === '20261115140000_finish_reminder_settings') {
      psql(
        `INSERT INTO "Reminder" (id,title,"typeKey",context,"ownerKind","ownerUserId","createdById","dueAt","localDueAt","timeZone","updatedAt") VALUES ('${fixtureId}','Existing reminder preservation fixture','CUSTOM','PERSONAL','USER','${ids.sales}','${ids.sales}','2035-01-01T15:00Z','2035-01-01T10:00','America/New_York',CURRENT_TIMESTAMP)`,
      );
      reminderSnapshot = snapshotReminders();
    }
    sqlFile(path.join(migrations, name, 'migration.sql'));
    if (reminderSnapshot) {
      assert.equal(
        snapshotReminders(),
        reminderSnapshot,
        'Phase 6 changed pre-existing reminder/settings values',
      );
      psql(`DELETE FROM "Reminder" WHERE id='${fixtureId}'`);
      console.log(
        'PASS: Phase 6 preserved existing reminder values, history, rules and prior settings.',
      );
    }
  }
  assert.deepEqual(
    snapshot(tables),
    before,
    'Existing records changed during migration',
  );
  assert.equal(
    psql(`SELECT COUNT(*) FROM "Order" WHERE "billingState" IS NULL`),
    '1',
  );
  console.log(
    `PASS: ${previous.length} historical migrations applied; all ${tables.length} original tables preserved after additive migration.`,
  );

  const url = `postgresql://reminder_phase1@127.0.0.1:${port}/reminders_phase1?schema=public`;
  const parsed = new URL(url);
  assert.equal(parsed.hostname, '127.0.0.1');
  assert.equal(parsed.pathname, '/reminders_phase1');
  const {
    PrismaService,
  } = require('../dist/src/database/prisma/prisma.service');
  const {
    RemindersRepository,
  } = require('../dist/src/modules/reminders/reminders.repository');
  const {
    RemindersService,
  } = require('../dist/src/modules/reminders/reminders.service');
  const {
    ReminderPreferencesService,
  } = require('../dist/src/modules/reminders/reminder-preferences.service');
  prisma = new PrismaService({ datasourceUrl: url });
  await prisma.$connect();
  const repository = new RemindersRepository(prisma);
  const service = new RemindersService(repository);
  const preferences = new ReminderPreferencesService(prisma);
  const actor = (key, role) => ({
    userId: ids[key],
    name: `Synthetic ${key}`,
    email: `${key}@example.test`,
    role,
  });
  const sales = actor('sales', 'SALES'),
    other = actor('other', 'SALES'),
    admin = actor('admin', 'ADMIN');
  const shipping = actor('shipping', 'SHIPPING'),
    shipping2 = actor('shipping2', 'SHIPPING');
  const now = new Date('2026-01-01T00:00Z');
  const input = {
    acknowledgeDuplicate: true,
    title: 'Synthetic follow-up',
    typeKey: 'CALL',
    context: 'LEAD',
    recordId: ids.lead,
    localDueAt: '2026-07-01T16:00',
  };
  const reminder = await service.create(input, sales, now);
  assert.equal(reminder.ownerUserId, ids.sales);
  assert.equal(reminder.dueAt.toISOString(), '2026-07-01T20:00:00.000Z');
  assert.equal(
    await prisma.reminderHistory.count({ where: { reminderId: reminder.id } }),
    1,
  );
  assert.equal(
    snapshot(['Lead']).Lead,
    before.Lead,
    'Reminder creation touched lead activity',
  );
  await assert.rejects(() => service.get(reminder.id, other), /cannot access/);
  await assert.rejects(
    () => service.get(reminder.id, shipping),
    /cannot access/,
  );
  await assert.rejects(
    () => service.create({ ...input, ownerUserId: ids.other }, sales, now),
    /Invalid reminder/,
  );
  await assert.rejects(
    () => service.create({ ...input, typeKey: 'TRACKING_CHECK' }, sales, now),
    /not available/,
  );
  await assert.rejects(
    () => service.create({ ...input, timeZone: 'America/Chicago' }, sales, now),
    /linked record/,
  );
  await assert.rejects(
    () => service.create(input, actor('inactive', 'SALES'), now),
    /inactive/,
  );

  const queue = await service.create(
    {
      ...input,
      context: 'SHIPMENT_ORDER',
      recordId: ids.order,
      typeKey: 'TRACKING_CHECK',
    },
    shipping,
    now,
  );
  assert.equal(queue.ownerKind, 'SHIPPING_QUEUE');
  assert.equal(queue.ownerUserId, null);
  await service.get(queue.id, shipping2);
  const raced = await Promise.allSettled([
    service.markWorking(queue.id, queue.version, shipping, now),
    service.markWorking(queue.id, queue.version, shipping2, now),
  ]);
  assert.equal(
    raced.filter((r) => r.status === 'fulfilled').length,
    1,
    'Two Shipping users acquired the marker',
  );
  const working = await prisma.reminder.findUniqueOrThrow({
    where: { id: queue.id },
  });
  assert.equal(
    working.scheduleVersion,
    1,
    'Marker changes should not invalidate scheduled alerts',
  );
  assert.equal(
    await prisma.reminderHistory.count({
      where: { reminderId: queue.id, action: 'WORK_STARTED' },
    }),
    1,
  );
  const nextWorker =
    working.workingById === shipping.userId ? shipping2 : shipping;
  await service.markWorking(
    queue.id,
    working.version,
    nextWorker,
    new Date(now.getTime() + 3 * 3600000),
  );
  const handoff = await service.create(
    {
      ...input,
      context: 'ORDER',
      recordId: ids.order,
      assignment: 'SHIPPING_QUEUE',
    },
    sales,
    now,
  );
  assert.equal(handoff.context, 'SHIPMENT_ORDER');
  assert.equal(handoff.notifyCreatorOnCompletion, true);
  await service.get(handoff.id, sales);
  await assert.rejects(
    () => service.markWorking(handoff.id, handoff.version, sales, now),
    /cannot access/,
  );
  const toSales = await service.create(
    {
      ...input,
      typeKey: 'CUSTOM',
      context: 'SHIPMENT',
      recordId: ids.shipment,
      assignment: 'SALES_AGENT',
    },
    shipping,
    now,
  );
  assert.equal(toSales.context, 'ORDER');
  assert.equal(toSales.ownerUserId, ids.sales);
  await service.get(toSales.id, sales);
  await service.get(toSales.id, shipping);
  await assert.rejects(
    () =>
      service.create(
        { ...input, context: 'ORDER', recordId: ids.order },
        other,
        now,
      ),
    /own Sales/,
  );
  await assert.rejects(
    () =>
      service.create(
        { ...input, context: 'ORDER', recordId: ids.order },
        shipping,
        now,
      ),
    /Shipping records/,
  );
  await assert.rejects(
    () =>
      service.create(
        {
          ...input,
          context: 'PERSONAL',
          recordId: undefined,
          assignment: 'RECORD_OWNER',
        },
        sales,
        now,
      ),
    /creator/,
  );

  await prisma.websiteLead.update({
    where: { id: ids.website },
    data: { assignedToId: null },
  });
  await assert.rejects(
    () =>
      service.create(
        { ...input, context: 'WEBSITE_LEAD', recordId: ids.website },
        admin,
        now,
      ),
    /Assign the website/,
  );
  const adminTask = await service.create(
    {
      ...input,
      context: 'WEBSITE_LEAD',
      recordId: ids.website,
      assignment: 'SELF',
    },
    admin,
    now,
  );
  assert.equal(adminTask.ownerUserId, ids.admin);
  await prisma.websiteLead.update({
    where: { id: ids.website },
    data: { assignedToId: ids.sales },
  });
  const inquiryTask = await service.create(
    { ...input, context: 'WEBSITE_LEAD', recordId: ids.website },
    sales,
    now,
  );
  await prisma.websiteLead.update({
    where: { id: ids.website },
    data: { assignedToId: ids.other },
  });
  await assert.rejects(
    () => service.get(inquiryTask.id, sales),
    /cannot access/,
  );
  await prisma.order.update({
    where: { id: ids.order },
    data: { status: 'REFUNDED' },
  });
  await assert.rejects(
    () =>
      service.create(
        {
          ...input,
          context: 'SHIPMENT',
          recordId: ids.shipment,
          typeKey: 'CUSTOM',
        },
        shipping,
        now,
      ),
    /closed/,
  );
  await prisma.order.update({
    where: { id: ids.order },
    data: { status: 'CONFIRMED' },
  });

  assert.equal(
    (await preferences.get(ids.sales, sales)).displayTimeZone,
    'America/Los_Angeles',
  );
  assert.equal(
    await prisma.reminderUserPreference.count(),
    0,
    'Reading defaults should not create preference rows',
  );
  await assert.rejects(
    () =>
      preferences.update(
        ids.other,
        { displayTimeZone: 'America/New_York' },
        sales,
      ),
    /only your own/,
  );
  await preferences.update(
    ids.sales,
    { displayTimeZone: 'America/New_York' },
    admin,
  );
  const personal = await service.create(
    { ...input, context: 'PERSONAL', recordId: undefined },
    sales,
    now,
  );
  assert.equal(personal.timeZone, 'America/New_York');

  const delivery = {
    reminderId: reminder.id,
    recipientUserId: ids.sales,
    reminderVersion: 1,
    kind: 'DUE',
    channel: 'BELL',
    availableAt: reminder.dueAt,
  };
  await prisma.reminderDelivery.create({ data: delivery });
  await assert.rejects(
    () => prisma.reminderDelivery.create({ data: delivery }),
    (error) => error.code === 'P2002',
  );
  await assert.rejects(() =>
    prisma.reminder.create({
      data: {
        title: 'Invalid',
        typeKey: 'CALL',
        context: 'LEAD',
        leadId: ids.lead,
        orderId: ids.order,
        ownerKind: 'USER',
        ownerUserId: ids.sales,
        createdById: ids.sales,
        dueAt: reminder.dueAt,
        localDueAt: reminder.localDueAt,
        timeZone: reminder.timeZone,
      },
    }),
  );
  const protectedLead = await prisma.lead.create({
    data: {
      leadDate: now,
      adviserName: 'Synthetic Sales',
      cmpt: 'YES',
      customerPhone: '5550000001',
      customerName: 'Synthetic protected lead',
      partDescription: 'Synthetic part',
      prospects: '',
      createdById: ids.sales,
    },
  });
  await service.create({ ...input, recordId: protectedLead.id }, sales, now);
  await assert.rejects(
    () => prisma.lead.delete({ where: { id: protectedLead.id } }),
    (error) =>
      error.code === 'P2003' || /Reminder_leadId_fkey/.test(error.message),
  );
  const original = await prisma.reminder.findUniqueOrThrow({
    where: { id: reminder.id },
  });
  await assert.rejects(
    () =>
      repository.transaction(async (tx) => {
        await repository.updateWithHistory(
          tx,
          reminder.id,
          original.version,
          { title: 'Must roll back' },
          ids.sales,
          'EDITED',
          {},
        );
        throw new Error('synthetic transaction failure');
      }),
    /synthetic/,
  );
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } }))
      .title,
    original.title,
  );
  assert.equal(
    await prisma.reminderHistory.count({ where: { reminderId: reminder.id } }),
    1,
  );
  console.log(
    'PASS: ownership, handoffs, closed records, preferences, concurrent markers, audit rollback, delivery deduplication, and database constraints.',
  );

  const { Test } = require('@nestjs/testing');
  const { ValidationPipe } = require('@nestjs/common');
  const { ConfigService } = require('@nestjs/config');
  const { JwtService } = require('@nestjs/jwt');
  const { AuthService } = require('../dist/src/modules/auth/auth.service');
  const {
    RemindersModule,
  } = require('../dist/src/modules/reminders/reminders.module');
  const request = require('supertest');
  const moduleRef = await Test.createTestingModule({
    imports: [RemindersModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(ConfigService)
    .useValue({
      get: (key, fallback) =>
        key === 'JWT_SECRET' ? 'synthetic-phase1-test-secret' :
          key === 'REDIS_CACHE_ENABLED' ? 'false' : fallback,
    })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  try {
    await app.init();
    const jwt = moduleRef.get(JwtService);
    const salesToken = await jwt.signAsync({ sub: ids.sales });
    const adminToken = await jwt.signAsync({ sub: ids.admin });
    const inactiveToken = await jwt.signAsync({ sub: ids.inactive });
    const server = app.getHttpServer();
    await request(server).get('/reminders/preferences/me').expect(401);
    await request(server)
      .get(`/reminders/preferences/users/${ids.other}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
    await request(server)
      .get('/reminders/preferences/me')
      .set('Authorization', `Bearer ${inactiveToken}`)
      .expect(401);
    await request(server)
      .patch('/reminders/preferences/me')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ displayTimeZone: 'America/Chicago' })
      .expect(200);
    await request(server)
      .patch('/reminders/preferences/me')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ role: 'ADMIN' })
      .expect(400);
    await request(server)
      .patch('/reminders/preferences/me')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ displayTimeZone: 'UTC' })
      .expect(400);
    await request(server)
      .patch(`/reminders/preferences/users/${ids.sales}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ displayTimeZone: 'America/New_York' })
      .expect(200);
    assert.equal(
      (
        await prisma.reminder.findUniqueOrThrow({ where: { id: personal.id } })
      ).dueAt.toISOString(),
      personal.dueAt.toISOString(),
      'Changing display preferences changed a task instant',
    );
    await service.create(
      { ...input, context: 'PERSONAL', recordId: undefined },
      other,
      now,
    );
    await assert.rejects(
      () => moduleRef.get(AuthService).deleteUser(ids.other),
      /audit history/,
    );
    console.log(
      'PASS: authenticated preference routes, Admin guards, disabled accounts, DTO validation, and reminder-history user deletion protection.',
    );
    await require('./reminders-phase2.checks.cjs')({
      prisma,
      repository,
      core: service,
      actions: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-actions.service')
          .ReminderActionsService,
      ),
      queries: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-queries.service')
          .ReminderQueriesService,
      ),
      request,
      server,
      salesToken,
      adminToken,
      sales,
      shipping,
      shipping2,
      other,
      admin,
      ids,
    });
    await require('./reminders-phase3.checks.cjs')({
      prisma,
      core: service,
      workspace: moduleRef.get(
        require('../dist/src/modules/reminders/task-workspace.service')
          .TaskWorkspaceService,
      ),
      actions: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-actions.service')
          .ReminderActionsService,
      ),
      queries: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-queries.service')
          .ReminderQueriesService,
      ),
      request,
      server,
      salesToken,
      adminToken,
      sales,
      shipping,
      other,
      admin,
    });
    await require('./reminders-phase4.checks.cjs')({
      prisma,
      repository,
      core: service,
      actions: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-actions.service')
          .ReminderActionsService,
      ),
      request,
      server,
      salesToken,
      adminToken,
      sales,
      shipping,
      admin,
    });
    await require('./reminders-phase5.checks.cjs')({
      prisma,
      repository,
      core: service,
      actions: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-actions.service')
          .ReminderActionsService,
      ),
      queries: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-queries.service')
          .ReminderQueriesService,
      ),
      automation: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-automation.service')
          .ReminderAutomationService,
      ),
      request,
      server,
      salesToken,
      adminToken,
      sales,
      shipping,
      shipping2,
      other,
      admin,
    });
    await require('./reminders-phase6.checks.cjs')({
      prisma,
      core: service,
      actions: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-actions.service')
          .ReminderActionsService,
      ),
      queries: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-queries.service')
          .ReminderQueriesService,
      ),
      policy: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-policy-settings.service')
          .ReminderPolicySettingsService,
      ),
      reports: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-reports.service')
          .ReminderReportsService,
      ),
      calendar: moduleRef.get(
        require('../dist/src/modules/reminders/reminder-calendar-export.service')
          .ReminderCalendarExportService,
      ),
      workspace: moduleRef.get(
        require('../dist/src/modules/reminders/task-workspace.service')
          .TaskWorkspaceService,
      ),
      request,
      server,
      salesToken,
      adminToken,
      sales,
      shipping,
      other,
      admin,
    });
  } finally {
    await app.close();
  }

  psql('CREATE DATABASE reminders_phase1_fresh', 'postgres');
  // Package migration files into a directory with no .env or unrelated local folders.
  // Git does not deploy empty untracked directories; keep that same boundary here.
  const stagedPrisma = path.join(work, 'prisma');
  fs.mkdirSync(path.join(stagedPrisma, 'migrations'), { recursive: true });
  fs.copyFileSync(
    path.join(backend, 'prisma/schema.prisma'),
    path.join(stagedPrisma, 'schema.prisma'),
  );
  fs.copyFileSync(
    path.join(migrations, 'migration_lock.toml'),
    path.join(stagedPrisma, 'migrations/migration_lock.toml'),
  );
  for (const name of fs.readdirSync(migrations)) {
    if (!fs.statSync(path.join(migrations, name)).isDirectory()) continue;
    const file = path.join(migrations, name, 'migration.sql');
    if (!fs.existsSync(file)) {
      assert.equal(
        fs.readdirSync(path.join(migrations, name)).length,
        0,
        'Incomplete nonempty migration folder',
      );
      assert.equal(
        run('git', ['ls-files', '--', `prisma/migrations/${name}`]).trim(),
        '',
        'Missing SQL in a tracked migration',
      );
      console.log(
        `Ignoring existing empty untracked migration directory: ${name}`,
      );
      continue;
    }
    fs.mkdirSync(path.join(stagedPrisma, 'migrations', name));
    fs.copyFileSync(
      file,
      path.join(stagedPrisma, 'migrations', name, 'migration.sql'),
    );
  }
  const prismaCli = path.join(backend, 'node_modules/prisma/build/index.js');
  const env = {
    ...process.env,
    DATABASE_URL: url.replace('/reminders_phase1?', '/reminders_phase1_fresh?'),
  };
  run(
    process.execPath,
    [
      prismaCli,
      'migrate',
      'deploy',
      '--schema',
      path.join(stagedPrisma, 'schema.prisma'),
    ],
    { env, cwd: work },
  );
  run(
    process.execPath,
    [
      prismaCli,
      'migrate',
      'deploy',
      '--schema',
      path.join(stagedPrisma, 'schema.prisma'),
    ],
    { env, cwd: work },
  );
  assert.equal(
    psql('SELECT COUNT(*) FROM "Reminder"', 'reminders_phase1_fresh'),
    '0',
  );
  console.log(
    'PASS: complete Prisma migration deployment and repeat deployment on a second isolated empty database.',
  );
}
main()
  .catch((error) => {
    console.error(error.stack || error.message);
    if (error.stderr) console.error(String(error.stderr));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
    if (started) {
      try {
        run(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], {
          stdio: 'ignore',
          timeout: 45000,
        });
      } catch {
        console.error(`Test cluster could not stop; inspect ${work}`);
        process.exitCode = 1;
        return;
      }
    }
    // Only delete this run's verified temporary directory; never existing project or PostgreSQL data.
    const resolved = fs.realpathSync(work);
    assert.ok(
      resolved.startsWith(fs.realpathSync(tempRoot) + path.sep) &&
        path.basename(resolved).startsWith('reminders-phase1-pg-'),
    );
    fs.rmSync(resolved, { recursive: true, force: true });
  });
