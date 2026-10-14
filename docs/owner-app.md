# Owner PWA (`/app`) — private shop phone app

Installable, hidden, login-gated companion to the dashboard `/phone` board.
Shipped as three PRs: backend push infra (#99) → hidden shell + login (#100)
→ moderation + alerts UI (this PR, #101).
Same data (one `GET /admin/phone/summary` fetch), plus moderation
(questions/reviews) and Web Push alerts. Lives in the storefront at the
top-level `/app` route so it is installable on the shop domain without
touching the region-prefixed store.

## URLs

- App: `<storefront>/app` (canonical, no trailing slash)
- Manifest: `<storefront>/app/manifest.webmanifest`
- Service worker: `<storefront>/app/sw.js` (scope `/app`, registered only by the app page)

## Backend env (Railway + local `.env`)

| Var | What |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` (backend dir). Missing = push inert (404 on vapid-key, `sent: 0` on sends), never a 500. |
| `VAPID_SUBJECT` | `mailto:<shop-email>` |
| `ADMIN_CORS` | Must include the storefront origin or the app's `/admin/*` calls (login verify, summary, moderation, bind, send) fail CORS. |

Push needs the `web-push` package (already in `backend/package.json`).

## API surface

- `GET /store/push/vapid-key` → `{ publicKey }` (404 when unconfigured)
- `POST /store/push/subscriptions` → upsert by endpoint (accepts Web Push JS shape `{ endpoint, keys: { p256dh, auth }, device }`)
- `DELETE /store/push/subscriptions` → remove by endpoint
- `POST /admin/push/bind` → bind endpoint to the logged-in admin (`user_id`)
- `GET /admin/push/subscriptions` → `{ count, by_device }` (no endpoints/keys)
- `POST /admin/push/send` → `{ title, body, url?, device? }` broadcast/test

Auto-pings: new question / new review notify **bound (admin) installs only**
(`adminOnly`), so customer installs never see back-office activity. Manual
sends reach every install unless `device` filters. Stale endpoints (push
service 404/410) are deleted on send — no janitor.

## Distribute (owner devices only)

1. Deploy backend + storefront, set env above.
2. On the owner phone/desktop open `<storefront>/app`, sign in with an **admin**
   login (customer accounts are rejected with "owner account required").
3. Status tab: verify numbers match the dashboard `/phone` board.
4. Alerts tab: pick Phone/Desktop, "Turn on shop alerts", allow notifications.
5. Test: `POST /admin/push/send { "title": "Test", "body": "…" }` → notification arrives; tap opens the app.
6. Install: browser menu → "Add to Home Screen" / "Install".

## Hiding audit (re-run if the shell changes)

- [ ] No `<a href="/app">` anywhere outside `src/modules/app` (grep).
- [ ] `src/app/app/layout.tsx` keeps `robots: { index: false, follow: false }`.
- [ ] `src/app/robots.ts` still disallows `/app/`.
- [ ] `src/app/sitemap.ts` emits only region-prefixed URLs (no top-level routes).
- [ ] `src/middleware.ts` matcher still exempts `app` (else `/app` 307s to `/gb/app`).
- [ ] Unsigned visitors see only the sign-in form; every data call needs the admin JWT.
- [ ] SW registered only from `/app` (scope `/app`) — store pages unaffected.

## Known limits (v1)

- Admin JWT in `localStorage`: single-owner private-device assumption. On a
  shared phone use a private tab (closing it drops the token).
- No per-variant customer stock pushes — subscriptions are device-level, and
  moderation pings are admin-only by design.
- Offline: shell + last summary render; moderation actions need connectivity.
