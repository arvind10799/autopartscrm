"use client";
import { reminderNotificationsApi } from "./reminder-notifications-api";
export async function bindReminderDevice(userId: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  registration?.active?.postMessage({ type: "crm:bind-reminders", userId });
}
export async function enableReminderPush(userId: string, publicKey: string) {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw Error(
      "Push is unavailable here. On iPhone, add CRM to the Home Screen and open it there.",
    );
  // Called directly from the Enable button, before any asynchronous configuration requests.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Notifications are blocked. You can enable them in your browser settings.",
    );
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const old = await registration.pushManager.getSubscription();
  // Do not reuse a subscription belonging to another signed-in user.
  if (old) {
    await reminderNotificationsApi.unsubscribe(old.endpoint);
    await old.unsubscribe();
  }
  const decoded = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
  const key = new Uint8Array(Array.from(decoded, (c) => c.charCodeAt(0)));
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  try {
    await reminderNotificationsApi.subscribe(subscription.toJSON());
    await bindReminderDevice(userId);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}
export async function detachReminderPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  registration?.active?.postMessage({ type: "crm:bind-reminders", userId: "" });
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    // Browser unsubscribe still runs when the backend is temporarily unreachable.
    try {
      await reminderNotificationsApi.unsubscribe(subscription.endpoint);
    } finally {
      await subscription.unsubscribe();
    }
  }
}
