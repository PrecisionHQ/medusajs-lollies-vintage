# QA checklist (backend)

Every PR merging to `master` must be QA'd before landing. Check each box
with evidence (CI link, command output, or a one-line note). See
`docs/qa-backend.md` for the full ritual.

- [ ] CI green: typecheck, unit tests, secrets scan (`Backend typecheck`,
      `Backend unit tests`, `Secrets scan`)
- [ ] No real secrets in the diff (keys, tokens, passwords live in Railway
      variables only — the secrets scan enforces this, confirm any hit is a
      placeholder)
- [ ] Deployed to Railway from this branch (`railway up`) and the deploy
      reached SUCCESS
- [ ] Live verification matrix run against the deploy (or N/A with reason):
      happy path, stacking/exclusion/top-up totals where promos are touched,
      add-after-code, code removal, invalid-input errors, no error loops in
      deploy logs
- [ ] Test data cleaned up (test promos/cards/orders deleted or
      expired-neutralized; no guessable live codes left behind)
- [ ] `completion.md` updated (what deployed, what was verified, IDs/URLs)
- [ ] Rollback known: previous Railway deployment ID noted below; one-click
      redeploy restores it

Rollback deployment ID (previous SUCCESS before this change): ______
