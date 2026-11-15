const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({
  prisma,
  core,
  workspace,
  actions,
  queries,
  request,
  server,
  salesToken,
  adminToken,
  sales,
  shipping,
  other,
  admin,
}) => {
  const now = new Date('2030-01-02T07:30:00Z');
  await prisma.reminderUserPreference.upsert({
    where: { userId: sales.userId },
    create: { userId: sales.userId, displayTimeZone: 'America/Los_Angeles' },
    update: { displayTimeZone: 'America/Los_Angeles', handoffsSeenAt: null },
  });
  const makeLead = (owner) =>
    prisma.lead.create({
      data: {
        leadDate: now,
        adviserName: 'Permanent adviser',
        cmpt: 'YES',
        customerName: `Phase3-${randomUUID()}`,
        customerPhone: '2025550111',
        state: 'NY',
        partDescription: 'Synthetic engine',
        prospects: '',
        createdById: owner,
      },
    });
  const lead = await makeLead(sales.userId),
    hiddenLead = await makeLead(other.userId);
  const before = await workspace.summary(sales, now);
  const make = (recordId, owner, time = '2030-01-02T10:00') =>
    core.create(
      {
        context: 'LEAD',
        recordId,
        title: 'Phase3-scope-check',
        typeKey: 'CALL',
        localDueAt: time,
      },
      owner,
      now,
    );
  const late = await make(lead.id, sales),
    today = await make(lead.id, sales, '2030-01-02T02:45'),
    future = await make(lead.id, sales, '2030-01-02T13:00');
  await prisma.reminder.update({
    where: { id: late.id },
    data: {
      dueAt: new Date('2030-01-02T04:00Z'),
      localDueAt: '2030-01-01T23:00',
    },
  });
  const hidden = await make(hiddenLead.id, other);
  const after = await workspace.summary(sales, now);
  assert.equal(
    after.badge - before.badge,
    2,
    'Overdue today must not count twice in the badge',
  );
  assert.equal(after.today - before.today, 2);
  assert.equal(after.overdue - before.overdue, 1);
  assert.equal(after.upcoming - before.upcoming, 1);
  let list = await workspace.list(
    { scope: 'MINE', tab: 'ALL', search: 'Phase3-', page: 1, limit: 1 },
    sales,
    now,
  );
  assert.equal(list.total, 3);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, late.id);
  const second = await workspace.list(
    { scope: 'MINE', tab: 'ALL', search: 'Phase3-', page: 2, limit: 1 },
    sales,
    now,
  );
  assert.equal(second.items[0].id, today.id);
  assert.ok(!JSON.stringify(list).includes(hidden.id));
  assert.equal(list.items[0].record.customerName, lead.customerName);
  assert.ok(list.items[0].record.href.endsWith('#reminders'));
  assert.ok(
    !('lead' in list.items[0]),
    'Do not serialize raw relation objects',
  );
  assert.equal(
    (
      await workspace.list(
        {
          scope: 'MINE',
          tab: 'TODAY',
          search: 'Phase3-',
          displayTimeZone: 'America/New_York',
        },
        sales,
        now,
      )
    ).items
      .map((r) => r.id)
      .sort()
      .join(','),
    [today.id, future.id].sort().join(','),
  );
  const month = await workspace.list(
    {
      scope: 'MINE',
      tab: 'ALL',
      search: 'Phase3-',
      from: '2030-01-01',
      to: '2030-01-31',
      calendar: true,
      limit: 1,
    },
    sales,
    now,
  );
  assert.equal(month.dayCounts['2030-01-01'], 2);
  assert.equal(month.dayCounts['2030-01-02'], 1);
  await assert.rejects(
    () => workspace.list({ scope: 'TEAM' }, sales, now),
    /Admin/,
  );
  await assert.rejects(
    () => workspace.list({ ownerId: other.userId }, sales, now),
    /Admin/,
  );
  await assert.rejects(
    () => workspace.list({ calendar: true }, sales, now),
    /range/,
  );
  await assert.rejects(
    () => workspace.list({ from: '2030-01-01', to: '2030-12-31' }, sales, now),
    /62 days/,
  );
  await assert.rejects(
    () => workspace.records({ context: 'LEAD', search: '' }, shipping),
    /workspace/,
  );
  const choices = await workspace.records(
    { context: 'LEAD', search: 'Phase3-' },
    sales,
  );
  assert.ok(choices.some((r) => r.id === lead.id));
  assert.ok(!choices.some((r) => r.id === hiddenLead.id));
  const order = await prisma.order.create({
    data: {
      orderNumber: `PHASE3-${randomUUID()}`,
      salesNumber: 'Phase3-Sale',
      customerName: 'Phase3-Order',
      customerPhone: '2025550123',
      partDescription: 'Engine',
      totalSaleAmount: 1000,
      price: 1000,
      quantity: 1,
      status: 'CONFIRMED',
      billingState: 'NY',
      createdById: sales.userId,
    },
  });
  const queue = await core.create(
    {
      context: 'ORDER',
      recordId: order.id,
      title: 'Phase3-shared-queue',
      typeKey: 'CUSTOM',
      assignment: 'SHIPPING_QUEUE',
      note: 'Private yard note',
      localDueAt: '2030-01-03T10:00',
    },
    sales,
    now,
  );
  await prisma.reminder.update({
    where: { id: queue.id },
    data: { createdAt: now },
  });
  const shippingList = await workspace.list(
    { scope: 'MINE', search: 'Phase3-' },
    shipping,
    now,
  );
  assert.ok(shippingList.items.some((r) => r.id === queue.id));
  const shippingItem = shippingList.items.find((r) => r.id === queue.id);
  assert.equal(shippingItem.record.phone, null);
  assert.equal(shippingItem.record.amount, null);
  assert.equal(shippingItem.actions.work, true);
  const sent = await workspace.list(
    { scope: 'SENT', search: 'Phase3-' },
    sales,
    now,
  );
  const sentItem = sent.items.find((r) => r.id === queue.id);
  assert.ok(sentItem);
  assert.equal(sentItem.note, null);
  assert.equal(sentItem.statusOnly, true);
  assert.ok(Object.values(sentItem.actions).every((v) => v === false));
  assert.ok(sentItem.record.href.startsWith('/orders/'));
  const receivedBefore = await workspace.summary(shipping, now);
  const backHandoff = await core.create(
    {
      context: 'SHIPMENT_ORDER',
      recordId: order.id,
      title: 'Phase3-update-customer',
      typeKey: 'CUSTOM',
      assignment: 'SALES_AGENT',
      localDueAt: '2030-01-03T13:00',
    },
    shipping,
    now,
  );
  await actions.mutate(
    backHandoff.id,
    {
      action: 'COMPLETE',
      version: backHandoff.version,
      completionNote: 'Private Sales outcome',
    },
    sales,
    now,
  );
  const senderHistory = await queries.history(backHandoff.id, shipping);
  assert.ok(
    senderHistory.length > 0 &&
      senderHistory.every((entry) => entry.changes === null),
    'Shipping sender history must redact private Sales outcome text',
  );
  const sentBack = await workspace.list(
    { scope: 'SENT', tab: 'DONE', search: 'Phase3-update-customer' },
    shipping,
    now,
  );
  assert.equal(sentBack.items[0].completionNote, null);
  assert.ok(receivedBefore.newHandoffs >= 1);
  await workspace.seen(shipping, now.toISOString(), now);
  assert.equal((await workspace.summary(shipping, now)).newHandoffs, 0);
  await workspace.seen(
    shipping,
    new Date(now.getTime() - 60000).toISOString(),
    now,
  );
  assert.equal(
    (
      await prisma.reminderUserPreference.findUniqueOrThrow({
        where: { userId: shipping.userId },
      })
    ).handoffsSeenAt.toISOString(),
    now.toISOString(),
  );
  await assert.rejects(
    () => workspace.seen(shipping, '2030-01-03T00:00Z', now),
    /future/,
  );
  const personal = await core.create(
    {
      context: 'PERSONAL',
      title: 'Phase3-personal',
      typeKey: 'CUSTOM',
      localDueAt: '2030-01-03T10:00',
      timeZone: 'America/Denver',
    },
    shipping,
    now,
  );
  const personalList = await workspace.list(
    { scope: 'MINE', search: 'Phase3-personal' },
    shipping,
    now,
  );
  assert.equal(personalList.items[0].id, personal.id);
  assert.equal(personalList.items[0].needsAdmin, false);
  assert.equal(personalList.items[0].record.href, null);
  const disabled = await prisma.user.create({
    data: {
      name: 'Phase3-inactive',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'synthetic-not-a-login',
      role: 'SALES',
    },
  });
  const disabledLead = await makeLead(disabled.id);
  const assigned = await core.create(
    {
      context: 'LEAD',
      recordId: disabledLead.id,
      title: 'Phase3-inactive-task',
      typeKey: 'CUSTOM',
      localDueAt: '2030-01-03T10:00',
    },
    admin,
    now,
  );
  await prisma.user.update({
    where: { id: disabled.id },
    data: { isActive: false },
  });
  const recovery = await workspace.list(
    { scope: 'UNASSIGNED', search: 'Phase3-' },
    admin,
    now,
  );
  assert.ok(recovery.items.some((r) => r.id === assigned.id));
  assert.ok(recovery.items.every((r) => r.id !== personal.id));
  assert.equal(
    (await prisma.lead.findUniqueOrThrow({ where: { id: disabledLead.id } }))
      .createdById,
    disabled.id,
  );
  const report = await workspace.followUps({}, admin, now);
  assert.ok(report.unassigned >= 1);
  assert.ok(report.rows.some((r) => r.id === 'QUEUE'));
  await assert.rejects(() => workspace.followUps({}, sales, now), /Admin/);
  const reschedule = await core.create(
    {
      context: 'ORDER',
      recordId: order.id,
      title: 'Phase3-reschedule',
      typeKey: 'CUSTOM',
      localDueAt: '2030-11-04T10:00',
    },
    sales,
    now,
  );
  const moved = await workspace.reschedule(
    reschedule.id,
    reschedule.version,
    '2030-11-03T06:30:00Z',
    sales,
    now,
  );
  assert.equal(moved.localDueAt, '2030-11-03T01:30');
  assert.equal(moved.dueAt.toISOString(), '2030-11-03T06:30:00.000Z');
  await assert.rejects(
    () =>
      workspace.reschedule(
        reschedule.id,
        reschedule.version,
        '2030-11-04T06:30Z',
        sales,
        now,
      ),
    /changed/,
  );
  const unchanged = await prisma.lead.findUniqueOrThrow({
    where: { id: lead.id },
  });
  assert.equal(
    unchanged.updatedAt.getTime(),
    lead.updatedAt.getTime(),
    'Workspace activity must not touch leads',
  );
  await request(server).get('/reminders/summary').expect(401);
  await request(server)
    .get('/reminders/workspace')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ scope: 'TEAM' })
    .expect(403);
  await request(server)
    .get('/reminders/workspace')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ limit: 501 })
    .expect(400);
  await request(server)
    .get('/reminders/workspace')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ calendar: 'banana' })
    .expect(400);
  await request(server)
    .get('/reminders/records')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ context: 'SHIPMENT' })
    .expect(403);
  await request(server)
    .get('/reminders/summary')
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(200)
    .then((r) => assert.equal(typeof r.body.badge, 'number'));
  await request(server)
    .get('/reminders/follow-ups')
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(403);
  await request(server)
    .get('/reminders/follow-ups')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  await request(server)
    .post('/reminders/inbox/seen')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ seenThrough: new Date().toISOString() })
    .expect(201);
  console.log(
    'PASS: Phase 3 role-scoped workspaces, pagination, display-zone counts, calendar totals, private-field redaction, personal tasks, inactive-owner recovery, inbox acknowledgements, rescheduling/DST, and guarded APIs.',
  );
};
