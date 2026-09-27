# Keys checklist — every secret, where it goes, where to get it, which PR needs it

Legend: `[stubbed]` = placeholder in place, boot-safe. `[needs-real]` = you must paste a real value before that PR.

## Backend (`backend/.env`)

| Key | Get it | Needed for | Status |
|-----|--------|-----------|--------|
| `JWT_SECRET` / `COOKIE_SECRET` | Generated (done) | Boot / admin sessions | stubbed (dev-only, rotate for prod) |
| `DATABASE_URL` | `docker compose up -d` or Railway Postgres | Everything | local default set |
| `MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` | You choose | First admin login | change before deploy |
| `STRIPE_API_KEY` (`sk_test_…`) | Stripe Dashboard → Developers → API keys (test mode) | PR-09 preorder (manual capture) | [needs-real] |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | Stripe Dashboard → Developers → Webhooks → test endpoint | PR-09 (fulfillment capture) | [needs-real, PR-09 only] |
| `RESEND_API_KEY` (`re_…`) | resend.com/api-keys | PR-02/03/07 flows + all transactional mail | [needs-real] |
| `RESEND_FROM_EMAIL` | Verified sending domain (SPF/DKIM first) | Same as above | [needs-real] |
| `MEILISEARCH_HOST` / `MEILISEARCH_MASTER_KEY` | docker-compose defaults (already set) | Search indexing | set for local |
| `S3_*` (MinIO values) | docker-compose defaults (already set) | Product image uploads locally | set for local |
| `POSTHOG_KEY` / `POSTHOG_HOST` | eu.posthog.com → project settings | PR-05/PR-08 server events | [needs-real, PR-05] |

## Storefront (`storefront/.env.local`)

| Key | Get it | Needed for | Status |
|-----|--------|-----------|--------|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Admin → Settings → Publishable API Keys (or `pnpm ib` auto-share) | Boot (refuses to start without it) | [needs-real, first] |
| `NEXT_PUBLIC_STRIPE_KEY` (`pk_test_…`) | Same Stripe test-mode page as above | PR-09 card form | [needs-real, PR-09] |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | Same PostHog project as above | PR-05 tracking | [needs-real, PR-05] |
| `NEXT_PUBLIC_SEARCH_*` / `MEILISEARCH_API_KEY` | Local defaults (already set) | Search box | set for local |

## Order to fill them in
1. `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` — first, unblocks everything.
2. Resend pair — unblocks PR-02/03/07 + order confirmations.
3. PostHog pair — unblocks PR-05.
4. Stripe trio (`sk_test`, `whsec`, `pk_test`) — unblocks PR-09.
5. Everything else is already defaulted for local docker-compose.
