export const ORDERS_QUEUE_NAME = 'orders';
export const ORDER_LIFECYCLE_JOB_NAME = 'order.lifecycle';

export type OrderLifecycleAction = 'created' | 'updated';

export interface OrderLifecycleJobPayload {
  orderId: string;
  action: OrderLifecycleAction;
  occurredAt: string;
}
