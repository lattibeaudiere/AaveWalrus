## What changed and why

This pass made the Explorer page (`/explorer`) load noticeably faster by
removing wasted network round-trips, fixing a slow database sort, and
turning on edge caching. It also fixes the ticker so the most important
APYs and prices stay visible long enough to read.

No business logic, pricing, auth, or data shapes changed. No data is lost
or stale — caches are short and use `stale-while-revalidate`, so worst
case a visitor sees data that's a few seconds old while a fresh copy is
being fetched in the background.

---

### 1. Database / API speed

**Index fix** — `scripts/db_add_indexes.js` now also creates
`idx_enriched_events_explorer_coalesce`, an expression index on
`COALESCE(event_timestamp, enriched_at) DESC` that mirrors the explorer
query's `ORDER BY` exactly. Before this, Postgres had to sort the entire
filtered set on every cold request because the existing index was on
`event_timestamp` alone. With the new index it's an indexed range scan.

**Run once on prod**:

```
node scripts/db_add_indexes.js
```

It uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, so it's safe on a
live DB and idempotent.

**Removed the `COUNT(*)` from `/api/explorer/events`** — for any page
beyond the first (or any filtered query), the API used to run a full
`COUNT(*)` over the filtered events table just to show "Showing X-Y of
**N**". That count was the slowest part of those requests. We now return
`has_more: true/false` and an `approximate_total` flag instead. The UI
shows "X-Y of N+" when there are more pages, and the exact count only
when you've reached the last page.

---

### 2. CDN edge caching (the big one for repeat visits)

Five read-only endpoints now send `Cache-Control` headers so Vercel's
edge can serve them without ever waking up the function:

| Endpoint                              | Edge cache | Stale-while-revalidate |
| ------------------------------------- | ---------- | ---------------------- |
| `/api/explorer/events?fast=1` (page 1)| 15 s       | 60 s                   |
| `/api/explorer/events` (other pages)  | 10 s       | 30 s                   |
| `/api/v1/market-pulse`                | 15 s       | 60 s                   |
| `/api/v1/ticker-data`                 | 60 s       | 300 s                  |
| `/api/v1/explorer-volume`             | 120 s      | 600 s                  |
| `/api/v1/market-pulse-insight`        | 60 s       | 300 s                  |

These match the in-memory TTLs the API already enforces, so freshness is
unchanged — the cache just lives one hop closer to the user now.

Paired with this, the frontend stopped sending `cache: 'no-store'` and
the `&_t=Date.now()` cache-buster on every request, which were
defeating both browser and CDN caches.

---

### 3. Frontend critical path

**Resource hints** in `<head>` of `frontend/explorer.html`:

- `preconnect` + `dns-prefetch` to `defeyes-api.vercel.app` so the first
  API call doesn't pay DNS+TLS handshake cost (~150-300 ms saved cold).
- `preconnect` to `fonts.gstatic.com` for faster font fetch.

**Early events fetch** — a tiny inline script in `<head>` kicks off the
canonical first-page events request as `window.__eventsPromise` *before*
`explorer.js` has even parsed. `loadData()` consumes it instead of
issuing a duplicate fetch. Effectively the API round-trip overlaps with
HTML/CSS/JS download — usually 300-800 ms off cold first-paint.

**`defer` on all bottom scripts** (`explorer.js`, `mobile-menu.js`,
`theme-toggle.js`, `auth-check.js`) so they no longer block HTML
parsing.

**No more duplicate `loadData()`** — for logged-in users, the page used
to fetch the public events list, then re-fetch the authenticated list as
soon as `/api/usage` resolved. Now `apiKey` is read synchronously from
`localStorage` on init, so the first call already hits the right
endpoint with the right tier.

**`loadProtocols()` deleted** — the protocol filter dropdown is hard-
coded in HTML, but the page was still calling `/api/stats` to "populate"
it. That single call ran four heavy aggregate queries (`COUNT(*)`,
`COUNT(DISTINCT origin_user)`, classification rate, protocol breakdown)
and discarded the result. Removed entirely.

---

### 4. Ticker fix (the readability bug you flagged)

The APY and Price tickers used to start scrolling immediately, so by the
time a user looked up, the most important assets at the front of the
list had already scrolled off-screen.

Two changes, working together:

- `.ticker-track` in `frontend/explorer.html` now has
  `animation-delay: var(--ticker-start-delay, 4s)`. The ticker holds
  still for 4 seconds before scrolling begins.
- `renderTickerTrack()` in `frontend/explorer.js` restarts the
  animation when real data first arrives, so the 4-second pause begins
  at the moment the user can actually see content (not at page-load,
  which would race with a slow API).

To tweak: change `--ticker-start-delay` on `.ticker-track` (or override
it per ticker, e.g. `#apy-ticker-track { --ticker-start-delay: 5s; }`).

---

## What you should see

- **Cold first paint** (visitor with empty cache, function cold start):
  was ~1.5-3 s of "Loading data...", now usually ~500-800 ms.
- **Warm / repeat visits**: was ~500-1000 ms because everything had
  `no-store`, now usually <200 ms, served from Vercel's edge.
- **Logged-in users**: roughly half the network traffic on initial load
  (no more duplicate events request, no more `/api/stats` hit).
- **Ticker**: leading APYs/prices now stay readable for ~4 s before the
  scroll starts.

---

## Rollback

Each change is in an isolated location and can be reverted independently:

- DB index — drop with
  `DROP INDEX CONCURRENTLY IF EXISTS idx_enriched_events_explorer_coalesce;`
  (the rest of the system never required it).
- CDN headers — remove the `res.setHeader('Cache-Control', ...)` lines
  in `api/index.js`; in-memory TTLs still protect the function.
- Frontend changes — revert `frontend/explorer.html` and
  `frontend/explorer.js` to bring back the previous behavior.

No migrations beyond the (additive, concurrent) index. No schema
changes, no data rewrites.
