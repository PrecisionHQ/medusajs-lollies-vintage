# Staff roles — rollout runbook (Phase 5)

Native Medusa RBAC, not custom code: roles + `{resource, operation}`
policies, enforcement declared per route (core) and in
`backend/src/api/middlewares.ts` (ours), custom resources registered in
`backend/src/policies/shop.ts`. The `rbac` feature flag defaults OFF
(`MEDUSA_FF_RBAC`) — everything below assumes you are turning it on
deliberately, once.

## 0. Preconditions (do not skip)

1. Deploy the R1 backend (policies file + middlewares map) first.
2. Confirm `role_super_admin` exists and the owner holds it: with the flag
   still OFF, open the dashboard Staff page after R2 deploys — if the page
   shows roles, the flag is already on somewhere; if it shows the
   flag-off state, proceed.
3. The migration script `create-super-admin-role` ran at boot and assigns
   the wildcard role to **all existing users** — verify in Staff > role
   detail that the owner is listed before touching the flag.

## 1. Create scoped roles (Staff page, flag still OFF)

Suggested starters (owner finalizes names/scopes in the UI):

- **fulfillment** — order/product/return/inventory read+write, payment read.
  No refunds, no codes, no settings.
- **support** — customer read, question/review write, order read,
  payment read. No fulfill, no refund, no codes.
- **marketing** — marketing/affiliate/bundle/promotion read+write,
  product read. No orders, no refunds.

Attach policies per role (resource:operation picker), assign a test user
or invite one with the role attached.

## 2. Test scoped login (incognito window)

Sign in as the scoped user on the dashboard: permitted screens work,
everything else 403s with "Insufficient permissions". Open `/app` with
the same login: only permitted tabs render (Status + Alerts always show;
everything else hides without its `resource:read`). Fix role gaps here,
not after the flag matters.

## 3. Flip the flag

Set `MEDUSA_FF_RBAC=true` on the Railway backend (redeploys). Re-verify:
owner full access (super_admin wildcard), scoped user restricted, PWA
tabs gated. The PWA login gate rejects nothing new — a login with zero
permissions sees Status + Alerts only.

## 4. Break-glass

Unset `MEDUSA_FF_RBAC` (or set false) and redeploy: everything opens
again instantly. Enforcement is a flag, not a migration — there is
nothing to roll back in the database. Heartbeat: the hub's jobs section
is unaffected (jobs use the container, not a login).

## 5. Ongoing

- New custom admin routes MUST add matchers to `src/api/middlewares.ts` —
  the coverage test (`src/api/__tests__/middlewares.test.ts`) fails the
  build otherwise.
- New custom resources go in `src/policies/shop.ts` (synced at boot).
- Review role membership quarterly (Staff page shows users per role).
- Never share the owner login "temporarily" again — invite with the
  narrowest fitting role instead.
