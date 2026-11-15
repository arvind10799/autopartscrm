const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({
  prisma,
  core,
  actions,
  queries,
  policy,
  reports,
  calendar,
  workspace,
  request,
  server,
  salesToken,
  adminToken,
  sales,
  shipping,
  other,
  admin,
}) => {
  const {
    attachTableFollowUps,
  } = require('../dist/src/modules/reminders/reminder-table');
  const { localParts } = require('../dist/src/modules/reminders/reminder-time');
  const {
    taskDateShift,
  } = require('../dist/src/modules/reminders/task-workspace-time');
  const {
    LeadsRepository,
  } = require('../dist/src/modules/leads/leads.repository');
  const {
    OrdersRepository,
  } = require('../dist/src/modules/orders/orders.repository');
  const {
    WebsiteLeadsRepository,
  } = require('../dist/src/modules/website-leads/website-leads.repository');
  const leads = new LeadsRepository(prisma),
    orders = new OrdersRepository(prisma),
    websites = new WebsiteLeadsRepository(prisma);
  const now = new Date(),
    hour = 3600000,
    day = localParts(now, 'America/Los_Angeles').slice(0, 10),
    from = day.slice(0, 4) + '-01-01',
    to = day.slice(0, 4) + '-12-31';
  const makeLead = (name, actor = sales) =>
    prisma.lead.create({
      data: {
        leadDate: now,
        adviserName: actor.name,
        cmpt: 'YES',
        customerPhone: '2025550199',
        customerName: 'Phase6 ' + name,
        state: 'NY',
        partDescription: 'Synthetic part',
        prospects: '',
        status: 'PROSPECT',
        createdById: actor.userId,
      },
    });
  const make = (context, recordId, extra = {}, actor = sales) =>
    core.create(
      {
        context,
        recordId,
        typeKey: 'CALL',
        title: 'Phase6 synthetic follow-up',
        localDueAt: localParts(
          new Date(now.getTime() + hour),
          'America/New_York',
        ),
        ...extra,
      },
      actor,
      now,
    );
  const [empty, late, future, otherLead] = await Promise.all([
    makeLead('no next'),
    makeLead('late only'),
    makeLead('scheduled'),
    makeLead('other owner', other),
  ]);
  const untouched = (
    await prisma.lead.findUniqueOrThrow({ where: { id: future.id } })
  ).updatedAt.toISOString();
  const lateTask = await make('LEAD', late.id),
    futureTask = await make('LEAD', future.id),
    privateTask = await make('LEAD', otherLead.id, {}, other);
  await prisma.reminder.update({
    where: { id: lateTask.id },
    data: {
      dueAt: new Date(now.getTime() - hour),
      localDueAt: localParts(
        new Date(now.getTime() - hour),
        'America/New_York',
      ),
    },
  });
  const summary = await attachTableFollowUps(
    prisma,
    [empty, late, future, otherLead],
    'LEAD',
    sales,
    now,
  );
  assert.equal(summary[0].followUp, null);
  assert.equal(summary[1].followUp.overdue, true);
  assert.equal(summary[2].followUp.id, futureTask.id);
  assert.equal(summary[3].followUp, null);
  assert.ok(
    !JSON.stringify(summary[2].followUp).includes('synthetic follow-up'),
    'table payload contains no private title or notes',
  );
  const filter = await leads.findAll(
    { page: 1, limit: 100, search: 'Phase6', noUpcoming: 'true' },
    sales,
  );
  assert.deepEqual(
    filter.items.map((r) => r.id).sort(),
    [empty.id, late.id].sort(),
  );
  assert.equal(filter.meta.total, 2);
  const second = await leads.findAll(
    { page: 2, limit: 1, search: 'Phase6', noUpcoming: 'true' },
    sales,
  );
  assert.equal(second.items.length, 1);
  assert.equal(second.meta.total, 2);
  const exported = await leads.findAllForExport(
    { page: 1, limit: 1, search: 'Phase6', noUpcoming: 'true' },
    sales,
  );
  assert.equal(exported.length, 2, 'export ignores table pagination');
  const adminList = await leads.findAll(
    { page: 1, limit: 100, search: 'Phase6' },
    admin,
  );
  assert.ok(adminList.items.find((r) => r.id === otherLead.id).followUp);
  await actions.mutate(
    futureTask.id,
    { action: 'SNOOZE', version: futureTask.version, snoozeMinutes: 60 },
    sales,
    now,
  );
  assert.equal(
    (
      await prisma.lead.findUniqueOrThrow({ where: { id: future.id } })
    ).updatedAt.toISOString(),
    untouched,
  );
  const web = await prisma.websiteLead.create({
    data: {
      source: 'TEST',
      sourceFormId: 'phase6',
      externalSubmissionId: randomUUID(),
      submittedAt: now,
      customerName: 'Phase6 website',
      state: 'NY',
      assignedToId: sales.userId,
    },
  });
  const webFilter = await websites.list(
    { page: 1, limit: 100, search: 'Phase6', noUpcoming: 'true' },
    sales,
  );
  assert.ok(webFilter.items.some((r) => r.id === web.id));
  console.log(
    'PASS Phase 6: batched table summaries, Sales privacy, overdue-only next-step filter, stable filtered pagination, full matching export, no lead activity changes.',
  );

  const report = (kind, extra = {}) =>
    reports.list({ kind, from, to, page: 1, limit: 100, ...extra }, admin, now);
  const missing = await report('LEADS_NO_NEXT', { ownerId: sales.userId });
  assert.ok(missing.rows.some((r) => r.id === empty.id));
  assert.ok(missing.rows.some((r) => r.id === late.id));
  assert.ok(!missing.rows.some((r) => r.id === future.id));
  assert.ok(
    (await report('WEBSITE_NO_NEXT')).rows.some((r) => r.id === web.id),
  );
  const order = await prisma.order.create({
    data: {
      orderNumber: 'P6-' + randomUUID(),
      customerName: 'Phase6 invoice order',
      partDescription: 'Synthetic',
      price: 100,
      quantity: 1,
      totalSaleAmount: 100,
      status: 'CONFIRMED',
      billingState: 'NY',
      createdById: sales.userId,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      orderId: order.id,
      invoiceNumber: 'P6-' + randomUUID(),
      invoiceDate: now,
      customerName: order.customerName,
      itemDescription: 'Synthetic',
      quantity: 1,
      saleAmount: 100,
      totalAmount: 100,
      signatureRequestedAt: now,
    },
  });
  let unsigned = await report('UNSIGNED');
  assert.ok(unsigned.rows.some((r) => r.id === invoice.id && !r.followUp));
  const signature = await make('ORDER', order.id, {
    typeKey: 'SIGNATURE_FOLLOW_UP',
  });
  const {OrdersService}=require('../dist/src/modules/orders/orders.service');
  let cachedPage=null,cacheLoads=0;
  const cachedService=new OrdersService(prisma,orders,{rememberList:async(_q,_u,load)=>{if(!cachedPage){cachedPage=await load();cacheLoads++;}return cachedPage;}},{},leads,{},{});
  const cachedQuery={page:1,limit:10,orderNumber:order.orderNumber};
  assert.equal((await cachedService.findAll(cachedQuery,sales)).items[0].followUp.id,signature.id);
  await actions.mutate(signature.id,{action:'COMPLETE',version:signature.version},sales,now);
  assert.equal((await cachedService.findAll(cachedQuery,sales)).items[0].followUp,null,'task summary refreshes even while the same base order page is cached');
  assert.equal(cacheLoads,1);assert.equal(cachedPage.items[0].followUp,undefined,'enrichment does not mutate the cached order rows');
  const newSignature=await make('ORDER',order.id,{typeKey:'SIGNATURE_FOLLOW_UP'});
  unsigned = await report('UNSIGNED');
  assert.equal(
    unsigned.rows.find((r) => r.id === invoice.id).followUp.id,
    newSignature.id,
  );
  const shipment = await prisma.shipment.create({
    data: { orderId: order.id, status: 'IN_TRANSIT', shippedAt: now },
  });
  assert.ok(
    (await report('UNCHECKED_SHIPMENTS')).rows.some(
      (r) => r.id === shipment.id,
    ),
  );
  const tracking = await make(
    'SHIPMENT',
    shipment.id,
    { typeKey: 'TRACKING_CHECK' },
    shipping,
  );
  assert.ok(
    !(await report('UNCHECKED_SHIPMENTS')).rows.some(
      (r) => r.id === shipment.id,
    ),
  );
  await actions.mutate(
    tracking.id,
    { action: 'COMPLETE', version: tracking.version },
    shipping,
    new Date(now.getTime() + 2 * hour),
  );
  const manual = await make('PERSONAL', undefined, {
    timeZone: 'America/New_York',
    note: 'Private note must never enter calendar export',
  });
  await actions.mutate(
    manual.id,
    { action: 'COMPLETE', version: manual.version },
    sales,
    now,
  );
  const performance = await report('PERFORMANCE', { ownerId: sales.userId });
  const call = performance.rows.find((r) => r.type === 'Call');
  assert.ok(call && call.completed >= 1 && call.onTimePercent > 0);
  const shippingPerformance = await report('PERFORMANCE', {
    ownerId: shipping.userId,
  });
  const track = shippingPerformance.rows.find(
    (r) => r.type === 'Tracking Check',
  );
  assert.equal(track.queueCount, 1);
  const expectedDelay =
    (now.getTime() + 2 * hour - tracking.dueAt.getTime()) / 60000;
  assert.ok(
    Math.abs(track.queueDelayMinutes - expectedDelay) < 0.1,
    'queue delay uses the stored due instant, including minute rounding',
  );
  const raw = await reports.export(
    { kind: 'UNSIGNED', from, to, page: 99, limit: 1 },
    admin,
  );
  assert.equal(raw.subarray(0, 2).toString(), 'PK');
  await assert.rejects(
    () => reports.list({ kind: 'PERFORMANCE' }, sales, now),
    /Admin/,
  );
  console.log(
    'PASS Phase 6: missing next-step, unsigned invoice, next-48-hour tracking and manual completion/queue-delay reports, Excel export and Admin guards.',
  );

  const personal = await make('PERSONAL', undefined, {
    timeZone: 'America/New_York',
    title: 'Phase6 Unicode 🚗; calendar, task',
    note: 'PRIVATE_PHASE6_NOTE',
  });
  await assert.rejects(
    () =>
      calendar.export(
        { scope: 'MINE', from: '2030-01-01', to: '2030-12-31' },
        sales,
        now,
      ),
    /62 days/,
  );
  // Calendar ranges deliberately remain bounded to 62 days; use an explicit short range.
  const text = (
    await calendar.export(
      {
        scope: 'MINE',
        from: taskDateShift(day, -1),
        to: taskDateShift(day, 2),
        search: 'Phase6',
        page: 1,
        limit: 1,
      },
      sales,
      now,
    )
  ).toString('utf8');
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(text.includes(personal.id + '@mee-crm'));
  assert.ok(!text.includes(privateTask.id));
  assert.ok(!text.includes('PRIVATE_PHASE6_NOTE'));
  assert.ok(!text.includes('RRULE:'));
  for (const line of text.split('\r\n'))
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  await assert.rejects(
    () => calendar.export({ scope: 'TEAM', from: day, to: day }, sales, now),
    /Admin/,
  );
  await request(server)
    .get(`/reminders/calendar-export.ics?from=${day}&to=${day}`)
    .set('Authorization', `Bearer ${salesToken}`)
    .expect('Content-Type', /text\/calendar/)
    .expect(200);
  await request(server)
    .get('/reminders/reports?kind=PERFORMANCE')
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(403);
  await request(server)
    .get('/reminders/reports/export.xlsx?kind=UNSIGNED')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect('Content-Type', /spreadsheetml/)
    .expect(200);
  console.log(
    'PASS Phase 6: authenticated .ics download, stable task UID, UTF-8 folding, notes/other-owner redaction, current occurrences only and export content types.',
  );

  const original = await policy.get(admin),
    { defaultStateTimeZones, ...base } = original;
  const saved = await policy.update(
    {
      ...base,
      snoozeMinutes: [15, 60, 90],
      defaultDisplayTimeZone: 'America/Chicago',
      stateTimeZones: { NY: 'America/Chicago' },
    },
    admin,
  );
  const newAccount = await prisma.user.create({
    data: {
      name: 'Phase6 new account',
      email: `phase6-${randomUUID()}@example.test`,
      passwordHash: 'synthetic-no-login',
      role: 'SALES',
    },
  });
  const newActor = {
    userId: newAccount.id,
    name: newAccount.name,
    email: newAccount.email,
    role: 'SALES',
  };
  const {
    ReminderPreferencesService,
  } = require('../dist/src/modules/reminders/reminder-preferences.service');
  assert.equal(
    (
      await new ReminderPreferencesService(prisma).get(
        newActor.userId,
        newActor,
      )
    ).displayTimeZone,
    'America/Chicago',
  );
  await workspace.seen(newActor, now.toISOString(), now);
  assert.equal(
    (
      await prisma.reminderUserPreference.findUniqueOrThrow({
        where: { userId: newActor.userId },
      })
    ).displayTimeZone,
    'America/Chicago',
    'first inbox acknowledgement preserves the configured default zone',
  );
  await assert.rejects(
    () => policy.update({ ...base, snoozeMinutes: [15] }, admin),
    /changed/,
  );
  await assert.rejects(
    () =>
      policy.update(
        { ...saved, stateTimeZones: { XX: 'America/Chicago' } },
        admin,
      ),
    /Invalid state/,
  );
  const configured = await make('LEAD', empty.id, {
    title: 'Phase6 mapped time',
    acknowledgeDuplicate: true,
  });
  assert.equal(configured.timeZone, 'America/Chicago');
  const pendingPolicy = await queries.record(
    { context: 'LEAD', recordId: empty.id, page: 1, limit: 20 },
    sales,
    now,
  );
  assert.deepEqual(pendingPolicy.policy.snoozeMinutes, [15, 60, 90]);
  const changed = await actions.mutate(
    configured.id,
    { action: 'SNOOZE', version: configured.version, snoozeMinutes: 90 },
    sales,
    now,
  );
  assert.equal(changed.snoozedUntil.getTime(), now.getTime() + 90 * 60000);
  await assert.rejects(
    () =>
      actions.mutate(
        personal.id,
        { action: 'SNOOZE', version: personal.version, snoozeMinutes: 123 },
        sales,
        now,
      ),
    /choice changed/,
  );
  await request(server)
    .patch('/reminders/policy')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ ...base, policyVersion: saved.policyVersion })
    .expect(403);
  await request(server)
    .patch('/reminders/policy')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...base, policyVersion: saved.policyVersion, snoozeMinutes: [0] })
    .expect(400);
  const before = (
    await prisma.reminder.findUniqueOrThrow({ where: { id: futureTask.id } })
  ).dueAt.toISOString();
  await policy.update({ ...base, policyVersion: saved.policyVersion }, admin);
  assert.equal(
    (
      await prisma.reminder.findUniqueOrThrow({ where: { id: futureTask.id } })
    ).dueAt.toISOString(),
    before,
    'policy changes do not bulk-rewrite existing schedules',
  );
  assert.ok(
    await prisma.reminderAutomationAudit.findFirst({
      where: { action: 'POLICY_UPDATED', actorId: admin.userId },
    }),
  );
  console.log(
    'PASS Phase 6: policy validation/CAS/audits, configured snooze, state overrides, no bulk schedule rewrite and guarded settings API.',
  );
};
