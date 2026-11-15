/* Isolated PostgreSQL only. All records synthetic; no transports or production credentials. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({
  prisma,
  repository,
  core,
  actions,
  queries,
  automation,
  sales,
  shipping,
  shipping2,
  other,
  admin,
  request,
  server,
  salesToken,
  adminToken,
}) => {
  const now = new Date('2031-06-10T12:00Z');
  const row = (id) => prisma.reminder.findUniqueOrThrow({ where: { id } });
  const series = (id) =>
    prisma.reminderSeries.findUniqueOrThrow({ where: { id } });
  const make = (context, recordId, extra = {}, actor = sales) =>
    core.create(
      {
        context,
        recordId,
        typeKey: 'CUSTOM',
        title: 'Synthetic Phase 5 task',
        localDueAt: '2031-06-10T10:00',
        ...(context === 'PERSONAL' ? { timeZone: 'America/New_York' } : {}),
        acknowledgeDuplicate: true,
        ...extra,
      },
      actor,
      now,
    );
  const complete = (r, extra = {}, actor = sales, time = now) =>
    actions.mutate(
      r.id,
      { action: 'COMPLETE', version: r.version, ...extra },
      actor,
      time,
    );
  const personal = await make('PERSONAL', undefined, {
    repeat: { frequency: 'DAILY', maxOccurrences: 3 },
  });
  const originalSeries = await series(personal.seriesId);
  await assert.rejects(
    () =>
      prisma.reminder.create({
        data: { ...personal, id: randomUUID(), occurrenceNumber: 99 },
      }),
    (e) => e.code === 'P2002',
    'database allows only one open occurrence',
  );
  await assert.rejects(
    () =>
      prisma.reminder.create({
        data: {
          ...personal,
          id: randomUUID(),
          status: 'CANCELLED',
          occurrenceNumber: null,
        },
      }),
    /Reminder_series_shape/,
    'database rejects missing occurrence ordinal even on a closed row',
  );
  const snoozed = await actions.mutate(
    personal.id,
    { action: 'SNOOZE', version: personal.version, snoozeMinutes: 4320 },
    sales,
    now,
  );
  assert.equal(
    (await series(personal.seriesId)).lastScheduledLocalAt,
    originalSeries.lastScheduledLocalAt,
  );
  assert.equal((await series(personal.seriesId)).completedCount, 0);
  assert.equal(
    await prisma.reminder.count({ where: { seriesId: personal.seriesId } }),
    1,
  );
  const raced = await Promise.allSettled([
    complete(snoozed),
    complete(snoozed),
  ]);
  assert.equal(raced.filter((r) => r.status === 'fulfilled').length, 1);
  let next = await prisma.reminder.findFirstOrThrow({
    where: { seriesId: personal.seriesId, status: 'OPEN' },
  });
  assert.equal(next.occurrenceNumber, 2);
  assert.equal(
    next.localDueAt,
    '2031-06-11T10:00',
    'snooze does not shift series clock',
  );
  assert.equal((await series(personal.seriesId)).completedCount, 1);
  const edit = await actions.mutate(
    next.id,
    {
      action: 'EDIT',
      version: next.version,
      repeatScope: 'THIS',
      title: 'Only this occurrence',
    },
    sales,
    now,
  );
  const done = await complete(edit);
  next = await row(done.nextOccurrenceId);
  assert.equal(
    next.title,
    personal.title,
    'current-only edit does not change future template',
  );
  assert.equal(next.occurrenceNumber, 3);
  const end = await complete(next);
  assert.equal(end.nextOccurrenceId, null);
  assert.equal(
    (await series(personal.seriesId)).stopReason,
    'Occurrence limit reached',
  );
  assert.equal((await series(personal.seriesId)).completedCount, 3);
  const future = await make('PERSONAL', undefined, {
    repeat: { frequency: 'DAILY' },
  });
  const edited = await actions.mutate(
    future.id,
    {
      action: 'EDIT',
      version: future.version,
      repeatScope: 'FUTURE',
      title: 'All future occurrences',
      repeat: { frequency: 'EVERY_N_DAYS', intervalDays: 3 },
    },
    sales,
    now,
  );
  next = await row((await complete(edited)).nextOccurrenceId);
  assert.equal(next.title, 'All future occurrences');
  assert.equal(next.localDueAt, '2031-06-13T10:00');
  assert.equal(
    (
      await prisma.reminderHistory.findFirstOrThrow({
        where: {
          reminderId: future.id,
          action: 'EDITED',
          changes: { path: ['repeatScope'], equals: 'FUTURE' },
        },
      })
    ).changes.repeatScope,
    'FUTURE',
  );
  const stopped = await actions.mutate(
    next.id,
    { action: 'CANCEL', version: next.version },
    sales,
    now,
  );
  assert.equal(stopped.status, 'CANCELLED');
  assert.equal((await series(future.seriesId)).isActive, false);
  const removed = await make('PERSONAL', undefined, {
    repeat: { frequency: 'DAILY' },
  });
  await actions.mutate(
    removed.id,
    {
      action: 'EDIT',
      version: removed.version,
      repeatScope: 'FUTURE',
      repeat: { frequency: 'NONE' },
    },
    sales,
    now,
  );
  assert.equal((await row(removed.id)).status, 'OPEN');
  assert.equal((await series(removed.seriesId)).isActive, false);
  const dateEnd = await make('PERSONAL', undefined, {
    repeat: { frequency: 'DAILY', untilDate: '2031-06-10' },
  });
  assert.equal((await complete(dateEnd)).nextOccurrenceId, null);
  assert.equal(
    (await series(dateEnd.seriesId)).stopReason,
    'Repeat end date reached',
  );
  console.log(
    'PASS Phase 5: concurrent completion, one open occurrence, snooze/base isolation, count/date limits, current/future edits, stop history.',
  );

  const {
    LeadsRepository,
  } = require('../dist/src/modules/leads/leads.repository');
  const {
    OrdersRepository,
  } = require('../dist/src/modules/orders/orders.repository');
  const {
    ShipmentsRepository,
  } = require('../dist/src/modules/shipments/shipments.repository');
  const {
    InvoicesRepository,
  } = require('../dist/src/modules/invoices/invoices.repository');
  const {
    WebsiteLeadsRepository,
  } = require('../dist/src/modules/website-leads/website-leads.repository');
  const {
    ReplacementsRepository,
  } = require('../dist/src/modules/replacements/replacements.repository');
  const leads = new LeadsRepository(prisma),
    orders = new OrdersRepository(prisma),
    shipments = new ShipmentsRepository(prisma),
    invoices = new InvoicesRepository(prisma),
    websites = new WebsiteLeadsRepository(prisma),
    replacements = new ReplacementsRepository(prisma);
  const lead = () =>
    leads.create(
      {
        leadDate: '2031-06-10',
        adviserName: 'Synthetic Sales',
        cmpt: 'YES',
        customerPhone: '5550000005',
        customerName: 'Synthetic Phase 5 lead',
        state: 'NY',
        partDescription: 'Synthetic part',
        vehicleYear: '2010',
        vehicleMake: 'Synthetic',
        vehicleModel: 'Test',
        prospects: '',
        status: 'PROSPECT',
      },
      sales,
    );
  const order = () =>
    orders.create(
      {
        orderNumber: `TEST-P5-${randomUUID()}`,
        customerName: 'Synthetic Phase 5 order',
        partDescription: 'Synthetic part',
        price: 100,
        quantity: 1,
        totalSaleAmount: 100,
        billingState: 'NY',
      },
      sales.userId,
    );
  const list = (context, id, actor = sales) =>
    queries.record({ context, recordId: id, page: 1, limit: 20 }, actor, now);
  const accept = (s, context, id, extra = {}, actor = sales) =>
    automation.accept(
      s.id,
      {
        version: s.version,
        ruleVersion: s.ruleVersion,
        context,
        recordId: id,
        typeKey: s.typeKey,
        title: s.label,
        assignment: s.assignment,
        localDueAt: '2031-06-11T10:00',
        repeat: s.repeat,
        ...extra,
      },
      actor,
      now,
    );
  const l = await lead();
  let suggestions = (await list('LEAD', l.id)).suggestions;
  assert.equal(
    suggestions.length,
    1,
    'new lead creates only its status suggestion',
  );
  await leads.update(l.id, { customerName: 'Synthetic ordinary edit' });
  assert.equal(
    (await list('LEAD', l.id)).suggestions[0].id,
    suggestions[0].id,
    'ordinary edit does not republish',
  );
  await assert.rejects(() => list('LEAD', l.id, other));
  await assert.rejects(() => accept(suggestions[0], 'LEAD', l.id, {}, other));
  await automation.dismiss(suggestions[0].id, suggestions[0].version, sales);
  assert.equal((await list('LEAD', l.id)).suggestions.length, 0);
  await leads.update(l.id, { customerName: 'Synthetic another edit' });
  assert.equal(
    (await list('LEAD', l.id)).suggestions.length,
    0,
    'dismissal persists across reload and ordinary edit',
  );
  await leads.update(l.id, { status: 'QUOTED' });
  suggestions = (await list('LEAD', l.id)).suggestions;
  assert.equal(suggestions.length, 1);
  const countBefore = await prisma.reminder.count();
  await assert.rejects(() =>
    accept(suggestions[0], 'LEAD', l.id, { localDueAt: 'invalid' }),
  );
  assert.equal(
    (
      await prisma.reminderSuggestion.findUniqueOrThrow({
        where: { id: suggestions[0].id },
      })
    ).status,
    'PENDING',
    'failed validation rolls back decision',
  );
  assert.equal(await prisma.reminder.count(), countBefore);
  const accepted = await Promise.allSettled([
    accept(suggestions[0], 'LEAD', l.id),
    accept(suggestions[0], 'LEAD', l.id),
  ]);
  assert.equal(accepted.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await prisma.reminder.count(), countBefore + 1);
  assert.equal((await list('LEAD', l.id)).suggestions.length, 0);
  await leads.update(l.id, { status: 'PROSPECT' });
  suggestions = (await list('LEAD', l.id)).suggestions;
  await make('LEAD', l.id, {
    typeKey: 'CALL',
    localDueAt: suggestions[0].localDueAt,
  });
  assert.equal(
    (await list('LEAD', l.id)).suggestions[0].alreadyScheduled,
    true,
  );
  await leads.update(l.id, { status: 'CALL_BACK_LATER' });
  const callback = (await list('LEAD', l.id)).suggestions[0];
  assert.equal(callback.requiresTime, true);
  assert.equal(callback.localDueAt, null);

  // Conversion keeps one-time tasks and stops lead recurrence; one note is atomic with completion.
  const repeat = await make('LEAD', l.id, { repeat: { frequency: 'DAILY' } });
  const oneTime = await make('LEAD', l.id);
  const withNote = await make('LEAD', l.id, { repeat: { frequency: 'DAILY' } });
  const noted = await Promise.allSettled([
    complete(withNote, { completionNote: 'Synthetic P5 outcome' }),
    complete(withNote, { completionNote: 'Synthetic P5 outcome' }),
  ]);
  assert.equal(noted.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    await prisma.note.count({
      where: { leadId: l.id, content: 'Synthetic P5 outcome' },
    }),
    1,
  );
  const o = await order();
  await prisma.$transaction((tx) =>
    leads.markAsConvertedWithTransaction(tx, l.id, o.id, true),
  );
  assert.equal((await row(repeat.id)).status, 'CANCELLED');
  assert.equal((await series(repeat.seriesId)).isActive, false);
  assert.equal((await row(oneTime.id)).context, 'ORDER');
  console.log(
    'PASS Phase 5: real lead creation/status hooks, durable dismiss/accept, ACL, duplicate warning, rollback, conversion and note exactly once.',
  );

  const inquiry = await prisma.websiteLead.create({
    data: {
      source: 'TEST',
      sourceFormId: 'phase5',
      externalSubmissionId: randomUUID(),
      submittedAt: now,
      state: 'NY',
    },
  });
  await websites.claim(inquiry.id, sales);
  assert.equal((await list('WEBSITE_LEAD', inquiry.id)).suggestions.length, 1);
  const webTask = await make('WEBSITE_LEAD', inquiry.id, {
    repeat: { frequency: 'DAILY' },
  });
  await websites.update(inquiry.id, { assignedToId: other.userId }, admin);
  assert.equal((await row(webTask.id)).ownerUserId, other.userId);
  const converted = await websites.convert(
    inquiry.id,
    {
      leadDate: '2031-06-10',
      cmpt: 'YES',
      customerPhone: '5550000006',
      customerName: 'Synthetic converted P5',
      state: 'AZ',
      vehicleYear: '2010',
      vehicleMake: 'Synthetic',
      vehicleModel: 'Test',
    },
    other,
  );
  const moved = await row(webTask.id);
  assert.equal(moved.context, 'LEAD');
  assert.equal(moved.leadId, converted.id);
  assert.equal(moved.ownerUserId, other.userId);
  assert.equal((await series(webTask.seriesId)).timeZone, 'America/Phoenix');
  assert.equal(
    (await row((await complete(moved, {}, other)).nextOccurrenceId)).context,
    'LEAD',
  );
  const closeWeb = await prisma.websiteLead.create({
    data: {
      source: 'TEST',
      sourceFormId: 'phase5',
      externalSubmissionId: randomUUID(),
      submittedAt: now,
      assignedToId: sales.userId,
    },
  });
  const closeTask = await make('WEBSITE_LEAD', closeWeb.id, {
    repeat: { frequency: 'DAILY' },
  });
  await websites.update(closeWeb.id, { status: 'CLOSED' }, admin);
  assert.equal((await series(closeTask.seriesId)).isActive, false);
  console.log(
    'PASS Phase 5: website assignment event, repeating ownership/conversion/time-zone follow-through, closed inquiry stop.',
  );

  const shippingOrder = await order();
  await orders.update(shippingOrder.id, { status: 'CONFIRMED' });
  assert.ok(
    (await list('SHIPMENT_ORDER', shippingOrder.id, shipping)).suggestions.some(
      (s) => s.typeKey === 'YARD_FOLLOW_UP',
    ),
  );
  const shipment = await shipments.create({
    orderId: shippingOrder.id,
    status: 'PENDING',
  });
  assert.equal(
    (await list('SHIPMENT_ORDER', shippingOrder.id, shipping)).suggestions
      .length,
    0,
    'locate rule only before shipment exists',
  );
  assert.equal(
    (await list('SHIPMENT', shipment.id, shipping)).suggestions[0].typeKey,
    'YARD_FOLLOW_UP',
  );
  await shipments.updateStatus(shipment.id, { status: 'PRE_PROCESSING' });
  assert.deepEqual(
    (await list('SHIPMENT', shipment.id, shipping)).suggestions
      .map((s) => s.typeKey)
      .sort(),
    ['COST_ENTRY', 'PURCHASE_CHECK'],
  );
  await prisma.shipmentCost.create({
    data: {
      shipmentId: shipment.id,
      purchaseAmount: 1,
      hasActualPurchaseAmount: true,
      grossProfit: 99,
    },
  });
  assert.deepEqual(
    (await list('SHIPMENT', shipment.id, shipping)).suggestions.map(
      (s) => s.typeKey,
    ),
    ['PURCHASE_CHECK'],
  );
  await shipments.updateStatus(shipment.id, { status: 'SHIPPED' });
  const trackingSuggestion = (await list('SHIPMENT', shipment.id, shipping))
    .suggestions[0];
  assert.equal(trackingSuggestion.repeat.intervalDays, 2);
  const tracking = await accept(
    trackingSuggestion,
    'SHIPMENT',
    shipment.id,
    {},
    shipping,
  );
  const queueRace = await Promise.allSettled([
    complete(tracking, {}, shipping),
    complete(tracking, {}, shipping2),
  ]);
  assert.equal(queueRace.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    await prisma.reminder.count({
      where: { seriesId: tracking.seriesId, status: 'OPEN' },
    }),
    1,
  );
  await shipments.updateStatus(shipment.id, { status: 'DELIVERED' });
  assert.equal((await series(tracking.seriesId)).isActive, false);
  const delivery = (
    await list('SHIPMENT', shipment.id, shipping)
  ).suggestions.find((s) => s.typeKey === 'CUSTOMER_DELIVERY_CHECK_IN');
  assert.ok(delivery);
  const handoff = await accept(delivery, 'SHIPMENT', shipment.id, {}, shipping);
  assert.equal(handoff.ownerUserId, sales.userId);
  assert.equal(handoff.isHandoff, true);
  const replacement = await replacements.create({
    orderId: shippingOrder.id,
    shipmentId: shipment.id,
    customerReason: 'Synthetic Phase5 replacement',
    replacementStatus: 'WAITING_YARD_RESPONSE',
    createdById: shipping.userId,
  });
  assert.ok(
    (await list('REPLACEMENT', replacement.id, shipping)).suggestions.length,
  );
  console.log(
    'PASS Phase 5: confirmed order and shipment/replacement events, actual-cost condition, concurrent queue completion, delivery stop and Sales handoff.',
  );

  const invoice = await prisma.invoice.create({
    data: {
      orderId: o.id,
      invoiceNumber: `TEST-P5-${randomUUID()}`,
      invoiceDate: now,
      customerName: 'Synthetic Invoice',
      itemDescription: 'Synthetic part',
      quantity: 1,
      saleAmount: 100,
      totalAmount: 100,
    },
  });
  await invoices.update(invoice.id, { signatureRequestedAt: now });
  const signature = (await list('ORDER', o.id)).suggestions.find(
    (s) => s.typeKey === 'SIGNATURE_FOLLOW_UP',
  );
  assert.ok(signature);
  await automation.dismiss(signature.id, signature.version, sales);
  await invoices.update(invoice.id, {
    signatureRequestedAt: new Date(now.getTime() + 60000),
  });
  assert.ok(
    !(await list('ORDER', o.id)).suggestions.some(
      (s) => s.typeKey === 'SIGNATURE_FOLLOW_UP',
    ),
    'resend does not create a new signature cycle',
  );
  await invoices.update(invoice.id, { signatureRequestedAt: null });
  await invoices.update(invoice.id, {
    signatureRequestedAt: new Date(now.getTime() + 120000),
  });
  const newSignature = (await list('ORDER', o.id)).suggestions.find(
    (s) => s.typeKey === 'SIGNATURE_FOLLOW_UP',
  );
  assert.ok(newSignature && newSignature.id !== signature.id);
  const signatureTask = await accept(newSignature, 'ORDER', o.id, {
    repeat: { frequency: 'DAILY', stopStatus: 'SIGNED' },
  });
  await invoices.update(invoice.id, {
    signedAt: new Date(now.getTime() + 180000),
  });
  assert.equal((await row(signatureTask.id)).status, 'COMPLETED');
  assert.equal((await series(signatureTask.seriesId)).isActive, false);
  assert.equal(
    await prisma.reminder.count({
      where: { seriesId: signatureTask.seriesId },
    }),
    1,
  );
  console.log(
    'PASS Phase 5: signature resend identity, fresh signing cycle and automatic signing completion without recurrence.',
  );

  await request(server)
    .get('/reminders/automation/settings')
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(403);
  await request(server)
    .patch('/reminders/automation/rules/LEAD_PROSPECT')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: 1, delayDays: -1 })
    .expect(400);
  await request(server)
    .post('/reminders/automation/types')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      key: 'CALL',
      label: 'Cannot replace built-in',
      allowedRoles: ['ADMIN'],
    })
    .expect(400);
  const custom = await automation.createType(
    {
      key: 'USER_PHASE5',
      label: 'Synthetic custom type',
      allowedRoles: ['ADMIN', 'SALES'],
    },
    admin,
  );
  const customTask = await make('PERSONAL', undefined, {
    typeKey: custom.key,
    repeat: { frequency: 'DAILY' },
  });
  await automation.updateType(
    custom.key,
    { label: 'Renamed synthetic type', isActive: false },
    admin,
  );
  assert.equal(
    (await row(customTask.id)).status,
    'OPEN',
    'disabling a type preserves existing tasks',
  );
  assert.equal((await complete(customTask)).nextOccurrenceId, null);
  assert.match((await series(customTask.seriesId)).stopReason, /type disabled/);
  const rules = await automation.settings(admin);
  const rule = rules.rules.find((r) => r.key === 'LEAD_PROSPECT');
  const newLead = await lead();
  const stale = (await list('LEAD', newLead.id)).suggestions[0];
  const callType = rules.types.find((t) => t.key === 'CALL');
  await automation.updateType('CALL', { allowedRoles: ['ADMIN'] }, admin);
  assert.equal(
    (await list('LEAD', newLead.id)).suggestions.length,
    0,
    'suggestions respect configured type role availability',
  );
  assert.equal((await list('LEAD', newLead.id, admin)).suggestions.length, 1);
  await automation.updateType(
    'CALL',
    { allowedRoles: callType.allowedRoles },
    admin,
  );
  await automation.updateRule(
    rule.key,
    { version: rule.version, delayDays: 2 },
    admin,
  );
  await assert.rejects(() => accept(stale, 'LEAD', newLead.id), /changed/);
  const latest = await prisma.reminderSuggestionRule.findUniqueOrThrow({
    where: { key: rule.key },
  });
  await automation.updateRule(
    rule.key,
    { version: latest.version, isActive: false },
    admin,
  );
  assert.equal((await list('LEAD', newLead.id)).suggestions.length, 0);
  const disabledLead = await lead();
  assert.equal(
    await prisma.reminderSuggestion.count({
      where: { context: 'LEAD', recordId: disabledLead.id },
    }),
    0,
  );
  assert.ok(
    (await prisma.reminderAutomationAudit.count({
      where: { actorId: admin.userId },
    })) >= 4,
  );
  assert.ok(
    (await list('PERSONAL', undefined)).items.every(
      (r) => !r.series || !('template' in r.series),
    ),
    'public series metadata excludes template note content',
  );
  console.log(
    'PASS Phase 5: guarded Admin settings, stable built-in keys, rename/disable preserves history, audited rule CAS and stale acceptance.',
  );
};
