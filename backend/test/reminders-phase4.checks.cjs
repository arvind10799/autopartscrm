/* Real PostgreSQL, synthetic fixtures, mocked transports: no external delivery. */
const assert = require('node:assert/strict');
module.exports = async ({
  prisma,
  repository,
  core,
  actions,
  sales,
  shipping,
  admin,
  request,
  server,
  salesToken,
  adminToken,
}) => {
  const {
    ReminderDeliveryService,
  } = require('../dist/src/modules/reminders/reminder-delivery.service');
  const {
    NotificationsService,
  } = require('../dist/src/modules/notifications/notifications.service');
  const now = new Date('2030-06-10T18:00Z');
  await prisma.reminderSettings.update({
    where: { id: 'default' },
    data: {
      deliveryEnabled: true,
      secondAlertMinutes: 30,
      escalationMinutes: 120,
    },
  });
  const deliveries = [],
    emails = [];
  let failPush = false,
    emailOn = false;
  const transport = {
    pushConfigured: () => true,
    emailConfigured: () => emailOn,
    push: async (id, userId, payload) => {
      if (failPush) throw Error('simulated private provider error');
      deliveries.push({ id, userId, payload });
      return false;
    },
    email: async (to, subject, text, id) => {
      emails.push({ to, subject, text, id });
    },
  };
  const config = {
    get: (key, fallback) =>
      key === 'REMINDERS_DELIVERY_ENABLED'
        ? 'true'
        : key === 'APP_URL'
          ? 'https://crm.example.test'
          : fallback,
  };
  const worker = new ReminderDeliveryService(
    prisma,
    repository,
    core,
    transport,
    config,
  );
  const otherWorker = new ReminderDeliveryService(
    prisma,
    repository,
    core,
    transport,
    config,
  );
  const notifications = new NotificationsService(prisma);
  const personal = async (title, priority = 'HIGH') =>
    core.create(
      {
        context: 'PERSONAL',
        typeKey: 'CALL',
        title,
        localDueAt: '2030-06-10T11:00',
        timeZone: 'America/Los_Angeles',
        priority,
        acknowledgeDuplicate: true,
      },
      sales,
      new Date('2030-06-10T15:00Z'),
    );
  const find = (id, kind, channel = 'BELL') =>
    prisma.reminderDelivery.findFirstOrThrow({
      where: { reminderId: id, kind, channel },
    });
  const run = async (d, time = now) => {
    const token = require('node:crypto').randomUUID();
    await prisma.reminderDelivery.update({
      where: { id: d.id },
      data: {
        status: 'PROCESSING',
        lockToken: token,
        lockedUntil: new Date(time.getTime() + 120000),
        attempts: { increment: 1 },
      },
    });
    await worker.deliver(
      { ...d, lockToken: token, attempts: d.attempts + 1 },
      time,
    );
  };
  const due = await personal('Phase 4 due task');
  await worker.plan(now);
  const bell = await find(due.id, 'DUE');
  await run(bell);
  await run(bell);
  assert.equal(
    await prisma.notification.count({ where: { reminderDeliveryId: bell.id } }),
    1,
    'retries produce one bell item',
  );
  const list = await notifications.findForUser(sales, {
    category: 'REMINDERS',
    limit: 100,
  });
  assert.ok(list.some((n) => n.reminderId === due.id));
  const stale = await find(due.id, 'DUE', 'PUSH');
  await actions.mutate(
    due.id,
    { action: 'SNOOZE', version: due.version, snoozeMinutes: 60 },
    sales,
    now,
  );
  await run(stale);
  assert.equal(
    (
      await prisma.reminderDelivery.findUniqueOrThrow({
        where: { id: stale.id },
      })
    ).status,
    'CANCELLED',
  );
  assert.equal(
    deliveries.filter((d) => d.payload.reminderId === due.id).length,
    0,
  );

  const overdue = await personal('Phase 4 overdue task');
  await worker.plan(new Date('2030-06-10T21:00Z'));
  const escalation = await find(overdue.id, 'ESCALATION');
  await run(escalation, new Date('2030-06-10T21:00Z'));
  assert.ok((await notifications.findForUser(admin,{category:'REMINDERS',limit:100})).some(n=>n.reminderDeliveryId===escalation.id),'Admin can read team escalation notifications');
  assert.ok(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: overdue.id } }))
      .escalatedAt,
  );
  assert.equal(
    await prisma.reminderHistory.count({
      where: { reminderId: overdue.id, action: 'ESCALATED' },
    }),
    1,
  );
  assert.equal(
    await prisma.reminderDelivery.count({
      where: { reminderId: overdue.id, kind: 'DUE' },
    }),
    0,
    'restart catch-up coalesces due/second alert',
  );

  const medium = await personal('Phase 4 quiet-hours task', 'MEDIUM');
  await prisma.reminderUserPreference.upsert({
    where: { userId: sales.userId },
    create: {
      userId: sales.userId,
      displayTimeZone: 'America/Los_Angeles',
      workingStartMinute: 1200,
      workingEndMinute: 360,
    },
    update: {
      displayTimeZone: 'America/Los_Angeles',
      workingStartMinute: 1200,
      workingEndMinute: 360,
    },
  });
  await worker.plan(now);
  const held = await find(medium.id, 'DUE');
  await run(held);
  const heldRow = await prisma.reminderDelivery.findUniqueOrThrow({
    where: { id: held.id },
  });
  assert.equal(heldRow.status, 'PENDING');
  assert.equal(heldRow.availableAt.toISOString(), '2030-06-11T03:00:00.000Z');
  await prisma.reminderUserPreference.update({
    where: { userId: sales.userId },
    data: { workingStartMinute: 540, workingEndMinute: 1020 },
  });

  const retry = await personal('Phase 4 retry task');
  await worker.plan(now);
  const push = await find(retry.id, 'DUE', 'PUSH');
  failPush = true;
  await run(push);
  failPush = false;
  const retryRow = await prisma.reminderDelivery.findUniqueOrThrow({
    where: { id: push.id },
  });
  assert.equal(retryRow.status, 'PENDING');
  assert.ok(!retryRow.lastError.includes('private'));
  // Expired claims are recoverable; a previous worker cannot acknowledge the new lease.
  await prisma.reminderDelivery.updateMany({
    where: { status: 'PENDING' },
    data: { availableAt: new Date('2040-01-01Z') },
  });
  await prisma.reminderDelivery.update({
    where: { id: push.id },
    data: {
      status: 'PROCESSING',
      lockToken: require('node:crypto').randomUUID(),
      lockedUntil: new Date(now.getTime() - 1),
    },
  });
  const [claim1, claim2] = await Promise.all([
    worker.claim(now),
    otherWorker.claim(now),
  ]);
  assert.equal(
    [claim1, claim2].filter((c) => c?.id === push.id).length,
    1,
    'only one concurrent worker claims a delivery',
  );
  const claimed = [claim1, claim2].find((c) => c?.id === push.id);
  await worker.deliver(
    { ...claimed, lockToken: require('node:crypto').randomUUID() },
    now,
  );
  assert.equal(
    (
      await prisma.reminderDelivery.findUniqueOrThrow({
        where: { id: push.id },
      })
    ).lockToken,
    claimed.lockToken,
  );
  await worker.deliver(claimed, now);

  const queue = await prisma.reminder.findFirstOrThrow({
    where: { ownerKind: 'SHIPPING_QUEUE', status: 'OPEN', deletedAt: null },
  });
  await prisma.reminder.update({
    where: { id: queue.id },
    data: { dueAt: new Date(now.getTime() - 1000), priority: 'HIGH' },
  });
  await worker.plan(now);
  const queueRecipients = await prisma.reminderDelivery.findMany({
    where: { reminderId: queue.id, kind: 'DUE', channel: 'BELL' },
  });
  const activeShipping = await prisma.user.findMany({
    where: { role: 'SHIPPING', isActive: true },
  });
  assert.deepEqual(
    new Set(queueRecipients.map((d) => d.recipientUserId)),
    new Set(activeShipping.map((u) => u.id)),
  );

  // Email fallback and digest are mocked, scoped to actual staff emails and idempotent.
  emailOn = true;
  const fallback = await personal('Phase 4 fallback task');
  await worker.plan(now);
  await run(await find(fallback.id, 'DUE', 'PUSH'));
  await run(await find(fallback.id, 'DUE', 'EMAIL'));
  assert.ok(
    emails.some((e) => e.subject === 'Reminder due' && e.to === sales.email),
  );
  await worker.digest(now);
  const digestCount = emails.filter((e) =>
    e.subject.startsWith('CRM daily tasks'),
  ).length;
  await worker.digest(now);
  assert.equal(
    emails.filter((e) => e.subject.startsWith('CRM daily tasks')).length,
    digestCount,
  );

  const {
    ReminderTransportService,
  } = require('../dist/src/modules/reminders/reminder-transport.service');
  const deviceTransport = new ReminderTransportService(
    { get: () => 'synthetic-value' },
    prisma,
  );
  const suffix = require('node:crypto').randomUUID();
  const device1 = await prisma.reminderPushSubscription.create({
    data: {
      userId: sales.userId,
      endpoint: `https://fcm.googleapis.com/wp/device1-${suffix}`,
      p256dh: 'A'.repeat(87),
      auth: 'A'.repeat(22),
    },
  });
  const device2 = await prisma.reminderPushSubscription.create({
    data: {
      userId: sales.userId,
      endpoint: `https://fcm.googleapis.com/wp/device2-${suffix}`,
      p256dh: 'A'.repeat(87),
      auth: 'A'.repeat(22),
    },
  });
  const deviceCalls = new Map();
  let broken = true;
  deviceTransport.sendPush = async (s) => {
    deviceCalls.set(s.id, (deviceCalls.get(s.id) || 0) + 1);
    if (s.id === device2.id && broken)
      throw Error('simulated transient failure');
  };
  const payload = {
    title: 'Local test',
    body: 'Synthetic task only',
    href: '/my-tasks',
    reminderId: fallback.id,
    userId: sales.userId,
  };
  const deviceDelivery = await find(fallback.id, 'DUE', 'PUSH');
  await assert.rejects(() =>
    deviceTransport.push(deviceDelivery.id, sales.userId, payload),
  );
  broken = false;
  await deviceTransport.push(deviceDelivery.id, sales.userId, payload);
  assert.equal(
    deviceCalls.get(device1.id),
    1,
    'accepted device is not sent again during a partial retry',
  );
  assert.equal(deviceCalls.get(device2.id), 2);
  const expired = await prisma.reminderPushSubscription.create({
    data: {
      userId: sales.userId,
      endpoint: `https://web.push.apple.com/expired-${suffix}`,
      p256dh: 'A'.repeat(87),
      auth: 'A'.repeat(22),
    },
  });
  deviceTransport.sendPush = async () => {
    throw Object.assign(Error('expired'), { statusCode: 410 });
  };
  await deviceTransport.push(deviceDelivery.id, sales.userId, payload);
  assert.equal(
    await prisma.reminderPushSubscription.findUnique({
      where: { id: expired.id },
    }),
    null,
  );

  const inquiry = await prisma.websiteLead.create({
    data: {
      source: 'PART_REQUEST',
      sourceFormId: 'synthetic-phase4',
      externalSubmissionId: suffix,
      submittedAt: now,
      customerName: 'Private synthetic inquiry',
      assignedToId: sales.userId,
    },
  });
  const inquiryTask = await core.create(
    {
      context: 'WEBSITE_LEAD',
      recordId: inquiry.id,
      typeKey: 'CALL',
      title: 'Private task',
      localDueAt: '2030-06-10T11:00',
      priority: 'HIGH',
      note: 'Receiver only note',
    },
    sales,
    new Date('2030-06-10T15:00Z'),
  );
  await worker.plan(now);
  await run(await find(inquiryTask.id, 'DUE'));
  assert.ok(
    (
      await notifications.findForUser(sales, {
        category: 'REMINDERS',
        limit: 100,
      })
    ).some((n) => n.reminderId === inquiryTask.id),
  );
  await prisma.websiteLead.update({
    where: { id: inquiry.id },
    data: { assignedToId: admin.userId },
  });
  await repository.transaction((tx) =>
    require('../dist/src/modules/reminders/reminder-lifecycle').reconcileReminders(
      tx,
      { websiteLeadId: inquiry.id },
      admin.userId,
    ),
  );
  assert.ok(
    !(
      await notifications.findForUser(sales, {
        category: 'REMINDERS',
        limit: 100,
      })
    ).some((n) => n.reminderId === inquiryTask.id),
    'former assignee cannot read previous private alert content',
  );
  const moved = await find(inquiryTask.id, 'REASSIGNED');
  await run(moved);
  const movedNotice = (
    await notifications.findForUser(sales, {
      category: 'REMINDERS',
      limit: 100,
    })
  ).find(
    (n) => n.type === 'REMINDER_REASSIGNED' && n.reminderId === inquiryTask.id,
  );
  assert.ok(
    movedNotice &&
      !movedNotice.message.includes('Receiver only note') &&
      !movedNotice.message.includes('Private synthetic inquiry'),
  );

  await request(server)
    .get('/reminders/notifications/settings')
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(403);
  await request(server)
    .get('/reminders/notifications/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  await request(server)
    .patch('/reminders/notifications/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ escalationMinutes: 1 })
    .expect(400);
  await request(server)
    .post('/reminders/notifications/subscribe')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({
      endpoint: 'https://127.0.0.1/secret',
      keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
    })
    .expect(400);
  await request(server)
    .get(`/reminders/notifications/alerts/${fallback.id}`)
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(200);
  await prisma.reminderSettings.update({
    where: { id: 'default' },
    data: { deliveryEnabled: false },
  });
  const before = await prisma.notification.count();
  await worker.tick(now);
  assert.equal(await prisma.notification.count(), before);
  console.log(
    'PASS: Phase 4 durable alerts, bell deduplication, schedule cancellation, escalation audit, quiet hours, retry recovery, claim fencing, queue recipients, mocked fallback/digests, and authenticated settings/alert routes.',
  );
};
