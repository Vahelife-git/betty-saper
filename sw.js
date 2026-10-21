// Офлайн-режим игры «Бэтти Питухунд ищет бомбочки».
// Всё берётся из сети, если она есть: новая версия с GitHub Pages видна при первом же запуске.
// Без сети (или если сеть не ответила за NET_TIMEOUT) — из сохранённой копии.
// Для обновления игры этот файл менять не нужно: достаточно заменить index.html в репозитории
"use strict";
const CACHE = "betty-v2";                      // Сменить имя — значит удалить все старые копии
const CORE = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png"];
const NET_TIMEOUT = 4000;                      // Мс: дольше ждать сеть нет смысла, берётся копия

self.addEventListener("install", e => {
  self.skipWaiting();                          // Новый обработчик включается сразу, без второго запуска
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))   // Отсутствующий файл не мешает остальным
  )));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);   // Копии прошлых версий обработчика
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fresh(e, req));
});

async function fresh(e, req) {
  const cache = await caches.open(CACHE);
  const nav = req.mode === "navigate";
  // Сначала сеть. no-cache: браузер обязан спросить сервер, а не брать свою копию
  // (GitHub Pages разрешает браузеру хранить файлы 10 минут). Если файл не менялся, сервер отвечает коротким 304
  const net = fetch(nav ? req.url : req, { cache: "no-cache" }).then(r => {
    if (r.ok) e.waitUntil(cache.put(req, r.clone()));
    return r;
  });
  net.catch(() => {});                         // Ошибка сети обрабатывается ниже, в консоль не пишется
  try {
    const r = await Promise.race([net, new Promise(ok => setTimeout(ok, NET_TIMEOUT, null))]);
    if (r) return r;
  } catch (err) {}
  const hit = await cache.match(req, { ignoreSearch: true })
    || (nav ? (await cache.match("index.html")) || (await cache.match("./")) : null);
  return hit || net;                           // Копии нет — ждём сеть до конца
}
