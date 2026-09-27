# Backend QA — how a PR earns `master`

Goal, agreed 2026-09-27: **when a PR lands on `master` it is already QA'd.**
CI gates what machines can check; humans check the rest; branch protection
makes both mandatory. Manual post-merge verification with one-click Railway
rollback (no staging environment). Storefront QA suite untouched by this
spec. Backend eslint deferred (no eslint configured; tsc + tests + scan
are the gates for now).

## 1. Machine gates (CI, blocking)

Workflow: `.github/workflows/ci.yml`, runs on every PR and push to
`master`/`staging`.

| Job | What | Why |
|-----|------|-----|
| `Secrets scan` | gitleaks over full history | Keys/tokens/passwords live in Railway variables only. Any hit must be a placeholder or the PR stops. |
| `Backend typecheck` | `tsc --noEmit` in `backend/` | Catches the exact class of breakage that killed three Railway deploys during the promo work (service method names, DTO shapes). |
| `Backend unit tests` | `pnpm test` (vitest) in `backend/` | Pure-logic tests, milliseconds, no DB. Pilot: `src/lib/topup-math` (layered books, order-independence, removal, guards). New pure logic must ship with tests; Medusa API-level tests (jest + `@medusajs/test-utils`, already a devDep) are the documented next step, not this spec. |
| `Storefront typecheck and lint` | existing | Unchanged. |

## 2. Branch protection (`master`)

- Require pull request (no direct pushes).
- Require the four CI jobs green before merge.
- Set via API; re-apply if ever reset. Rationale: advisory CI already
  existed and still let red code near `master` — only blocking counts.

## 3. Human ritual (PR template enforces, human verifies)

Per PR, before merge:
1. Deploy the branch to Railway (`railway up`), note the deployment ID
   **and the previous SUCCESS deployment ID** (rollback target).
2. Run the **live verification matrix** — the checklist used for every
   change in this repo's history:
   - happy path on the touched surface (create/apply/remove round-trip),
   - stacked + exclusion + top-up totals where promos are touched
     (€3+€1 pattern on €10 items),
   - add-after-code durability, code removal re-expansion,
   - invalid-input errors keep native shape,
   - deploy logs show no error loops or unexpected warnings.
   N/A with reason where a surface is untouched.
3. Clean up test data: delete test promos/cards; anything undeletable
   (no admin delete route) gets expired-neutralized; no guessable live
   codes left behind.
4. Update `completion.md` (what deployed, IDs/URLs, what was verified).
5. Fill the PR template, including the rollback deployment ID.

## 4. Rollback (one-click)

If production misbehaves after merge: `railway redeploy --service
<name> --yes` on the recorded previous SUCCESS deployment, or pick it in
the Railway dashboard. No migration to reverse (migrations are
forward-only and additive by convention here); code rollback restores
behavior while data stays intact. Record the incident in `completion.md`.

## 5. Explicitly out of scope

- Staging/preview environments (rejected: doubles deploys per PR; rollback
  covers a pre-launch shop).
- Automated matrix in CI (rejected: needs staging + prod-like secrets in
  Actions; manual ritual until that trade changes).
- Backend eslint (deferred, not rejected).
- Storefront QA automation (untouched per decision).
