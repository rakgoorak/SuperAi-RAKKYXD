// Anonymous usage counter for SuperAi & RAKKYXD (Cloudflare Worker + D1).
// The app sends a random per-install id, its version and OS. Nothing else is stored: no IP,
// no account, no project data. The country comes from Cloudflare's edge and is kept as a
// two-letter code only.
const ONLINE_MS = 15 * 60_000; // the app pings every 10 minutes
const DAY_MS = 86_400_000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...headers } });

export function parsePing(body) {
  if (!body || typeof body !== "object") return null;
  const id = String(body.id || "").toLowerCase();
  const os = String(body.os || "");
  const version = String(body.version || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) return null;
  if (!["win32", "darwin", "linux"].includes(os)) return null;
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(version)) return null;
  return { id, os, version };
}

async function ping(request, env) {
  if (Number(request.headers.get("content-length") || 0) > 512) return json({ error: "too large" }, 413);
  let body;
  try { body = JSON.parse((await request.text()).slice(0, 512)); } catch { return json({ error: "bad json" }, 400); }
  const p = parsePing(body);
  if (!p) return json({ error: "bad ping" }, 400);
  const country = /^[A-Z]{2}$/.test(request.cf?.country || "") ? request.cf.country : "";
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO devices (id, os, version, country, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(id) DO UPDATE SET os = ?2, version = ?3, country = ?4, last_seen = ?5`,
  ).bind(p.id, p.os, p.version, country, now).run();
  return new Response(null, { status: 204, headers: CORS });
}

async function stats(env) {
  const now = Date.now();
  const month = now - 30 * DAY_MS;
  const [totals, byOs, byCountry, onlineByCountry] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(last_seen >= ?1) AS online, SUM(last_seen >= ?2) AS today,
              SUM(last_seen >= ?3) AS week, SUM(last_seen >= ?4) AS month
       FROM devices`,
    ).bind(now - ONLINE_MS, now - DAY_MS, now - 7 * DAY_MS, month),
    env.DB.prepare(`SELECT os, COUNT(*) AS users FROM devices WHERE last_seen >= ?1 GROUP BY os`).bind(month),
    env.DB.prepare(
      `SELECT country, COUNT(*) AS users FROM devices WHERE last_seen >= ?1 AND country != ''
       GROUP BY country ORDER BY users DESC, country LIMIT 12`,
    ).bind(month),
    env.DB.prepare(
      `SELECT country, COUNT(*) AS users FROM devices WHERE last_seen >= ?1 AND country != ''
       GROUP BY country ORDER BY users DESC, country`,
    ).bind(now - ONLINE_MS),
  ]);
  const t = totals.results[0] || {};
  const os = { win32: 0, darwin: 0, linux: 0 };
  for (const row of byOs.results) os[row.os] = row.users;
  return json({
    online: t.online || 0, today: t.today || 0, week: t.week || 0, month: t.month || 0, total: t.total || 0,
    os, countries: byCountry.results, onlineCountries: onlineByCountry.results, updatedAt: now,
  }, 200, { "Cache-Control": "public, max-age=60" });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      if (request.method === "POST" && url.pathname === "/ping") return await ping(request, env);
      if (request.method === "GET" && url.pathname === "/stats") {
        // One D1 read per minute at most, however many people open the website.
        const cache = caches.default, key = new Request(url.origin + "/stats");
        const hit = await cache.match(key);
        if (hit) return hit;
        const fresh = await stats(env);
        ctx.waitUntil(cache.put(key, fresh.clone()));
        return fresh;
      }
      return json({ error: "not found" }, 404);
    } catch (error) {
      return json({ error: "server error" }, 500);
    }
  },
};
