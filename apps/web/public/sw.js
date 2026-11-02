// Flacon service worker: offline fallback only. The app is online-only by design, so it never
// caches API responses, Supabase requests or signed-in pages. Bump VERSION to refresh the cache.
// Kill switch: to remove a bad worker, deploy a sw.js that unregisters itself and deletes the caches:
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('flacon-')).map((k) => caches.delete(k)))).then(() => self.registration.unregister())));
// Keep /sw.js served with Cache-Control: no-cache (next.config headers) or it won't reach clients.
// Bump VERSION whenever /offline or the CSS it uses changes, so clients re-precache.
const VERSION = 'v1';
const CACHE = `flacon-${VERSION}`;
const OFFLINE_URL = '/offline';
const ICONS = ['/icon.png', '/apple-icon.png'];

/** Fetches the offline page and the CSS and fonts it needs, so it renders styled with no network. */
async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch(OFFLINE_URL, { cache: 'reload' });
  if (!res.ok) throw new Error(`offline page ${res.status}`);
  const html = await res.clone().text();
  await cache.put(OFFLINE_URL, res);
  const assets = new Set(ICONS);
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+\.(?:css|woff2))"/g)) assets.add(m[1]);
  for (const href of [...assets].filter((a) => a.endsWith('.css'))) {
    const css = await (await fetch(href)).text();
    // Font urls in the CSS are relative to the stylesheet (../media/x.woff2).
    for (const m of css.matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) assets.add(new URL(m[1], self.location.origin + href).pathname);
  }
  await cache.addAll([...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('flacon-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and other origins go straight to the network

  // Pages: network first; only when the network fails, show the offline page. Responses are never stored.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()));
    return;
  }

  // Precached icons and the offline page's own hashed CSS/fonts; everything else is untouched.
  if (ICONS.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
  }
});
