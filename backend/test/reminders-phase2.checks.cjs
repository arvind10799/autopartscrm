const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async function phase2({
  prisma,
  repository,
  core,
  actions,
  queries,
  request,
  server,
  salesToken,
  adminToken,
  sales,
  shipping,
  shipping2,
  other,
  admin,
}) {
  const now = new Date('2030-01-01T00:00Z');
  const lead = () =>
    prisma.lead.create({
      data: {
        leadDate: new Date(),
        adviserName: 'Synthetic phase2 Sales',
        cmpt: 'YES',
        customerPhone: '5550000002',
        customerName: 'Synthetic phase2 Lead',
        state: 'NY',
        partDescription: 'Synthetic part',
        prospects: '',
        createdById: sales.userId,
      },
    });
  const order = (owner = sales.userId) =>
    prisma.order.create({
      data: {
        orderNumber: `TEST-${randomUUID()}`,
        customerName: 'Synthetic phase2 Order',
        partDescription: 'Synthetic part',
        price: 100,
        quantity: 1,
        totalSaleAmount: 100,
        status: 'CONFIRMED',
        billingState: 'TX',
        createdById: owner,
      },
    });
  const make = (context, recordId, extra = {}) =>
    core.create(
      {
        context,
        recordId,
        typeKey: 'CUSTOM',
        title: 'Synthetic phase2 reminder',
        localDueAt: '2030-07-01T10:00',
        ...extra,
      },
      sales,
      now,
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
    ReplacementsRepository,
  } = require('../dist/src/modules/replacements/replacements.repository');
  const {
    WebsiteLeadsRepository,
  } = require('../dist/src/modules/website-leads/website-leads.repository');
  const {
    reconcileReminders,
  } = require('../dist/src/modules/reminders/reminder-lifecycle');
  const leads = new LeadsRepository(prisma),
    orders = new OrdersRepository(prisma),
    shipments = new ShipmentsRepository(prisma),
    invoices = new InvoicesRepository(prisma),
    replacements = new ReplacementsRepository(prisma),
    websites = new WebsiteLeadsRepository(prisma);
  const item = await lead();
  const initial = await make('LEAD', item.id);
  await assert.rejects(() => make('LEAD', item.id), /Save anyway/);
  const duplicate = await make('LEAD', item.id, { acknowledgeDuplicate: true });
  await assert.rejects(
    () =>
      actions.mutate(
        initial.id,
        { action: 'COMPLETE', version: initial.version },
        other,
        now,
      ),
    /cannot access/,
  );
  const untouched = await prisma.lead.findUniqueOrThrow({
    where: { id: item.id },
  });
  const snoozed = await actions.mutate(
    initial.id,
    { action: 'SNOOZE', version: initial.version, snoozeMinutes: 15 },
    sales,
    now,
  );
  assert.equal(snoozed.status, 'SNOOZED');
  assert.equal(snoozed.snoozeCount, 1);
  assert.equal(
    (
      await prisma.lead.findUniqueOrThrow({ where: { id: item.id } })
    ).updatedAt.toISOString(),
    untouched.updatedAt.toISOString(),
  );
  await assert.rejects(
    () =>
      actions.mutate(
        initial.id,
        { action: 'EDIT', version: initial.version, title: 'Stale edit' },
        sales,
        now,
      ),
    /changed/,
  );
  const notifications = await prisma.notification.count();
  const completed = await actions.mutate(
    snoozed.id,
    {
      action: 'COMPLETE',
      version: snoozed.version,
      completionNote: 'Synthetic phase2 completion outcome',
    },
    sales,
    now,
  );
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.completedById, sales.userId);
  assert.equal(
    await prisma.note.count({
      where: {
        leadId: item.id,
        content: 'Synthetic phase2 completion outcome',
        authorId: sales.userId,
      },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count(),
    notifications,
    'Lead completion notes must not send ordinary note notifications',
  );
  await assert.rejects(
    () =>
      actions.mutate(
        snoozed.id,
        {
          action: 'COMPLETE',
          version: snoozed.version,
          completionNote: 'Synthetic phase2 completion outcome',
        },
        sales,
        now,
      ),
    /closed/,
  );
  assert.equal(
    await prisma.note.count({
      where: {
        leadId: item.id,
        content: 'Synthetic phase2 completion outcome',
      },
    }),
    1,
  );
  const activityAfterComplete = (
    await prisma.lead.findUniqueOrThrow({ where: { id: item.id } })
  ).updatedAt.toISOString();
  const deleted = await actions.mutate(
    duplicate.id,
    { action: 'DELETE', version: duplicate.version },
    sales,
    now,
  );
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.status, 'CANCELLED');
  assert.equal(
    (
      await prisma.lead.findUniqueOrThrow({ where: { id: item.id } })
    ).updatedAt.toISOString(),
    activityAfterComplete,
  );
  const history = await queries.record(
    { context: 'LEAD', recordId: item.id, history: true, page: 1, limit: 20 },
    sales,
    now,
  );
  assert.ok(history.items.some((r) => r.id === duplicate.id));
  assert.ok(history.items.some((r) => r.id === initial.id));
  const assigned = await core.create(
    {
      context: 'LEAD',
      recordId: item.id,
      title: 'Admin assignment',
      typeKey: 'CUSTOM',
      localDueAt: '2030-07-02T10:00',
    },
    admin,
    now,
  );
  await assert.rejects(
    () =>
      actions.mutate(
        assigned.id,
        { action: 'EDIT', version: assigned.version, title: 'Not permitted' },
        sales,
        now,
      ),
    /edit only/,
  );
  await assert.rejects(
    () =>
      actions.mutate(
        assigned.id,
        { action: 'DELETE', version: assigned.version },
        sales,
        now,
      ),
    /creator/,
  );

  const rebound = await make('LEAD', item.id, {
    title: 'Customer time rebase',
    localDueAt: '2030-07-04T10:00',
  });
  await prisma.reminderDelivery.create({
    data: {
      reminderId: rebound.id,
      recipientUserId: sales.userId,
      reminderVersion: 1,
      kind: 'DUE',
      channel: 'BELL',
      availableAt: rebound.dueAt,
    },
  });
  await leads.update(item.id, { state: 'CA' }, sales.userId);
  const rebased = await prisma.reminder.findUniqueOrThrow({
    where: { id: rebound.id },
  });
  assert.equal(rebased.localDueAt, rebound.localDueAt);
  assert.equal(rebased.timeZone, 'America/Los_Angeles');
  assert.equal(rebased.dueAt.toISOString(), '2030-07-04T17:00:00.000Z');
  assert.equal(
    (
      await prisma.reminderDelivery.findFirstOrThrow({
        where: { reminderId: rebound.id },
      })
    ).status,
    'CANCELLED',
  );
  const spring = await lead();
  await prisma.lead.update({ where: { id: spring.id }, data: { state: 'AZ' } });
  const springTask = await make('LEAD', spring.id, {
    localDueAt: '2030-03-10T02:30',
  });
  await assert.rejects(
    () => leads.update(spring.id, { state: 'NY' }, sales.userId),
    /Reschedule/,
  );
  assert.equal(
    (await prisma.lead.findUniqueOrThrow({ where: { id: spring.id } })).state,
    'AZ',
    'State change must roll back if reminder rebase fails',
  );
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: springTask.id } }))
      .timeZone,
    'America/Phoenix',
  );

  const inquiry = await prisma.websiteLead.create({
    data: {
      source: 'TEST',
      sourceFormId: 'phase2',
      externalSubmissionId: randomUUID(),
      submittedAt: new Date(),
      customerName: 'Synthetic phase2 inquiry',
      state: 'NY',
      assignedToId: sales.userId,
    },
  });
  const inquiryTask = await make('WEBSITE_LEAD', inquiry.id);
  await websites.update(inquiry.id, { assignedToId: other.userId }, admin);
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: inquiryTask.id } }))
      .ownerUserId,
    other.userId,
  );
  await assert.rejects(() => core.get(inquiryTask.id, sales), /cannot access/);
  const converted = await websites.convert(
    inquiry.id,
    {
      leadDate: '2026-11-01',
      cmpt: 'YES',
      customerPhone: '5550000003',
      customerName: 'Synthetic converted inquiry',
      state: 'TX',
      vehicleYear: '2010',
      vehicleMake: 'Synthetic',
      vehicleModel: 'Test',
      prospects: '',
    },
    admin,
  );
  const movedInquiry = await prisma.reminder.findUniqueOrThrow({
    where: { id: inquiryTask.id },
  });
  assert.equal(movedInquiry.context, 'LEAD');
  assert.equal(movedInquiry.leadId, converted.id);
  assert.equal(movedInquiry.websiteLeadId, null);
  assert.equal(
    movedInquiry.ownerUserId,
    admin.userId,
    'Admin conversion must resolve the resulting record owner',
  );
  const sourceHistory = await queries.record(
    {
      context: 'WEBSITE_LEAD',
      recordId: inquiry.id,
      history: true,
      page: 1,
      limit: 20,
    },
    admin,
    now,
  );
  assert.ok(sourceHistory.items.some((r) => r.id === inquiryTask.id));
  const closedInquiry = await prisma.websiteLead.create({
    data: {
      source: 'TEST',
      sourceFormId: 'phase2',
      externalSubmissionId: randomUUID(),
      submittedAt: new Date(),
      assignedToId: sales.userId,
    },
  });
  const closedTask = await make('WEBSITE_LEAD', closedInquiry.id);
  await websites.update(closedInquiry.id, { status: 'CLOSED' }, admin);
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: closedTask.id } }))
      .status,
    'CANCELLED',
  );

  const convertLead = await lead(),
    targetOrder = await order(admin.userId);
  const convertTask = await make('LEAD', convertLead.id);
  await prisma.$transaction((tx) =>
    leads.markAsConvertedWithTransaction(
      tx,
      convertLead.id,
      targetOrder.id,
      true,
    ),
  );
  const movedLead = await prisma.reminder.findUniqueOrThrow({
    where: { id: convertTask.id },
  });
  assert.equal(movedLead.context, 'ORDER');
  assert.equal(movedLead.orderId, targetOrder.id);
  assert.equal(movedLead.ownerUserId, admin.userId);
  assert.equal(movedLead.originContext, 'LEAD');
  assert.equal(movedLead.originRecordId, convertLead.id);
  const declined = await lead(),
    declineOrder = await order();
  const declinedTask = await make('LEAD', declined.id);
  await prisma.$transaction((tx) =>
    leads.markAsConvertedWithTransaction(
      tx,
      declined.id,
      declineOrder.id,
      false,
    ),
  );
  assert.match(
    (
      await prisma.reminder.findUniqueOrThrow({
        where: { id: declinedTask.id },
      })
    ).cancelReason,
    /declined/,
  );

  const operationalOrder = await order();
  const salesTask = await make('ORDER', operationalOrder.id, {
    localDueAt: '2030-07-03T10:00',
  });
  const {
    OrdersService,
  } = require('../dist/src/modules/orders/orders.service');
  const orderService = new OrdersService(
    prisma,
    orders,
    { invalidateList: async () => {} },
    { enqueueLifecycleEvent: async () => {} },
    leads,
    {
      create: async (input, actor) =>
        prisma.note.create({
          data: {
            entityType: input.entityType,
            orderId: input.entityId,
            content: input.content,
            authorId: actor.userId,
          },
        }),
    },
    { notifyOrderUpdated: async () => {} },
  );
  await orderService.update(operationalOrder.id, { billingState: 'NY' }, admin);
  assert.ok(
    await prisma.note.findFirst({
      where: {
        orderId: operationalOrder.id,
        content: { contains: 'Billing state: TX -> NY' },
      },
    }),
    'A billing-state-only edit must persist and enter normal order history',
  );
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: salesTask.id } }))
      .timeZone,
    'America/New_York',
  );
  const shipment = await prisma.shipment.create({
    data: { orderId: operationalOrder.id, status: 'IN_TRANSIT' },
  });
  const queueTask = await core.create(
    {
      context: 'SHIPMENT',
      recordId: shipment.id,
      typeKey: 'CUSTOM',
      title: 'Shipping internal task',
      note: 'Internal Shipping detail',
      localDueAt: '2030-07-01T10:00',
    },
    shipping,
    now,
  );
  const visibleStrip = await queries.record(
    { context: 'ORDER', recordId: operationalOrder.id, page: 1, limit: 20 },
    sales,
    now,
  );
  const stripItem = visibleStrip.items.find((r) => r.id === queueTask.id);
  assert.ok(stripItem);
  assert.equal(stripItem.note, null);
  assert.ok(
    Object.values(stripItem.actions).every((value) => value === false),
    'Sales strip must be read-only',
  );
  await actions.mutate(
    queueTask.id,
    {
      action: 'COMPLETE',
      version: queueTask.version,
      completionNote: 'Synthetic Shipping outcome',
    },
    shipping2,
    now,
  );
  const doneStrip = await queries.record(
    { context: 'ORDER', recordId: operationalOrder.id, page: 1, limit: 20 },
    sales,
    now,
  );
  assert.ok(doneStrip.shippingDone.some((r) => r.id === queueTask.id));
  const track = await core.create(
    {
      context: 'SHIPMENT',
      recordId: shipment.id,
      typeKey: 'TRACKING_CHECK',
      title: 'Tracking check',
      localDueAt: '2030-07-02T10:00',
    },
    shipping,
    now,
  );
  await shipments.updateStatus(shipment.id, {
    status: 'DELIVERED',
    deliveredAt: now,
  });
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: track.id } }))
      .status,
    'CANCELLED',
  );
  const replacement = await prisma.replacementRequest.create({
    data: {
      orderId: operationalOrder.id,
      shipmentId: shipment.id,
      customerReason: 'Synthetic',
      createdById: shipping.userId,
    },
  });
  const replacementTask = await core.create(
    {
      context: 'REPLACEMENT',
      recordId: replacement.id,
      typeKey: 'CUSTOM',
      title: 'Replacement check',
      localDueAt: '2030-07-01T10:00',
    },
    shipping,
    now,
  );
  await replacements.update(replacement.id, {
    replacementStatus: 'DELIVERED',
    updatedById: shipping.userId,
    history: {
      action: 'STATUS_UPDATED',
      summary: 'Synthetic delivered',
      nextStatus: 'DELIVERED',
    },
  });
  assert.equal(
    (
      await prisma.reminder.findUniqueOrThrow({
        where: { id: replacementTask.id },
      })
    ).status,
    'CANCELLED',
  );
  const invoice = await prisma.invoice.create({
    data: {
      orderId: operationalOrder.id,
      invoiceNumber: `TEST-${randomUUID()}`,
      invoiceDate: now,
      customerName: 'Synthetic invoice',
      itemDescription: 'Synthetic',
      quantity: 1,
      saleAmount: 100,
      totalAmount: 100,
    },
  });
  const signature = await make('ORDER', operationalOrder.id, {
    typeKey: 'SIGNATURE_FOLLOW_UP',
    localDueAt: '2030-07-03T10:00',
  });
  await invoices.update(invoice.id, { status: 'SIGNED', signedAt: now });
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: signature.id } }))
      .status,
    'COMPLETED',
  );
  const beforeRollback = await prisma.reminder.findUniqueOrThrow({
    where: { id: salesTask.id },
  });
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: operationalOrder.id },
          data: { status: 'CANCELLED' },
        });
        await reconcileReminders(
          tx,
          { orderId: operationalOrder.id },
          admin.userId,
        );
        throw Error('Synthetic close rollback');
      }),
    /Synthetic close rollback/,
  );
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: salesTask.id } }))
      .status,
    beforeRollback.status,
  );
  assert.equal(
    (
      await prisma.order.findUniqueOrThrow({
        where: { id: operationalOrder.id },
      })
    ).status,
    'CONFIRMED',
  );
  // A completion committed after reconciliation reads must not be overwritten by closure.
  const raceOrder = await order();
  const raceTask = await make('ORDER', raceOrder.id);
  await assert.rejects(
    () =>
      prisma.$transaction(
        async (tx) => {
          await tx.order.update({
            where: { id: raceOrder.id },
            data: { status: 'CANCELLED' },
          });
          const client = new Proxy(tx, {
            get(target, key) {
              if (key !== 'reminder') return Reflect.get(target, key);
              return new Proxy(target.reminder, {
                get(delegate, method) {
                  if (method !== 'findMany')
                    return Reflect.get(delegate, method);
                  return async (args) => {
                    const rows = await delegate.findMany(args);
                    await actions.mutate(
                      raceTask.id,
                      { action: 'COMPLETE', version: raceTask.version },
                      sales,
                      now,
                    );
                    return rows;
                  };
                },
              });
            },
          });
          await reconcileReminders(
            client,
            { orderId: raceOrder.id },
            admin.userId,
          );
        },
        { timeout: 15000 },
      ),
    /linked reminder changed/,
  );
  assert.equal(
    (await prisma.order.findUniqueOrThrow({ where: { id: raceOrder.id } }))
      .status,
    'CONFIRMED',
  );
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: raceTask.id } }))
      .status,
    'COMPLETED',
  );
  await orders.update(operationalOrder.id, { status: 'REFUNDED' });
  assert.equal(
    (await prisma.reminder.findUniqueOrThrow({ where: { id: salesTask.id } }))
      .status,
    'CANCELLED',
  );

  const apiLead = await lead();
  const apiInput = {
    context: 'LEAD',
    recordId: apiLead.id,
    typeKey: 'CALL',
    title: 'Synthetic API task',
    localDueAt: '2030-07-01T10:00',
  };
  await request(server).post('/reminders').send(apiInput).expect(401);
  await request(server)
    .post('/reminders')
    .set('Authorization', `Bearer ${salesToken}`)
    .send({ ...apiInput, ownerUserId: other.userId })
    .expect(400);
  const response = await request(server)
    .post('/reminders')
    .set('Authorization', `Bearer ${salesToken}`)
    .send(apiInput)
    .expect(201);
  const apiTask = response.body;
  await request(server)
    .get('/reminders/record')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ context: 'LEAD', recordId: apiLead.id, history: 'false' })
    .expect(200)
    .then((r) => {
      assert.equal(r.body.items.length, 1);
      assert.equal(r.body.openCount, 1);
    });
  await request(server)
    .patch(`/reminders/${apiTask.id}`)
    .set('Authorization', `Bearer ${salesToken}`)
    .send({
      action: 'COMPLETE',
      version: apiTask.version,
      completionNote: 'Synthetic API note',
    })
    .expect(200);
  await request(server)
    .get(`/reminders/${apiTask.id}/history`)
    .set('Authorization', `Bearer ${salesToken}`)
    .expect(200)
    .then((r) => assert.ok(r.body.some((h) => h.action === 'COMPLETED')));
  await request(server)
    .get('/reminders/record')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ context: 'LEAD', recordId: apiLead.id, history: 'false' })
    .expect(200)
    .then((r) => assert.equal(r.body.items.length, 0));
  await request(server)
    .get('/reminders/record')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ context: 'LEAD', recordId: apiLead.id, history: 'true' })
    .expect(200)
    .then((r) => assert.equal(r.body.items.length, 1));
  await request(server)
    .get('/reminders/record')
    .set('Authorization', `Bearer ${salesToken}`)
    .query({ context: 'SHIPMENT', recordId: shipment.id })
    .expect(403);
  console.log(
    'PASS: Phase 2 actions, outcome notes, idempotency, duplicate warnings, lifecycle hooks, conversion history, state-change rollback, read-only Shipping status, and authenticated reminder APIs.',
  );
};
