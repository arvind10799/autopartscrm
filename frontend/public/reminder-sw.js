/* Push only: no fetch handler and no caching of authenticated pages, API responses, or documents. */
function binding(write) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("crm-reminder-device", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("binding");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction(
          "binding",
          write !== undefined ? "readwrite" : "readonly",
        );
      const op =
        write !== undefined
          ? tx.objectStore("binding").put(write, "user")
          : tx.objectStore("binding").get("user");
      let value;
      op.onsuccess = () => {
        value = op.result;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "crm:bind-reminders")
    event.waitUntil(
      (async () => {
        const previous = await binding();
        const next = event.data.userId || "";
        await binding(next);
        if (previous !== next)
          for (const notification of await self.registration.getNotifications())
            notification.close();
      })(),
    );
});
self.addEventListener("push", (event) =>
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data?.json();
      } catch {
        return;
      }
      if (!payload) return;
      const userId = await binding().catch(() => null),
        matches = userId && userId === payload.userId;
      const href =
        matches && /^\/my-tasks(?:\?|$)/.test(payload.href)
          ? payload.href
          : "/my-tasks";
      await self.registration.showNotification(
        matches ? payload.title : "CRM reminder",
        {
          body: matches ? payload.body : "Open CRM to view your tasks.",
          tag: `crm-reminder-${payload.reminderId}`,
          renotify: false,
          data: { href, userId: matches ? userId : null },
          icon: "/icons/icon-192.png",
        },
      );
      if (matches)
        for (const client of await self.clients.matchAll({ type: "window" }))
          client.postMessage({ type: "crm:reminder-arrived" });
    })(),
  ),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const userId = await binding().catch(() => null);
      const href =
        userId && userId === event.notification.data?.userId
          ? event.notification.data.href
          : "/my-tasks";
      const target = new URL(href, self.location.origin).href;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients)
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target);
          await client.focus();
          return;
        }
      await self.clients.openWindow(target);
    })(),
  );
});
