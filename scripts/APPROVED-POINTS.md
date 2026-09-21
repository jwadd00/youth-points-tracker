# Approved scoring — September 21, 2026

Attendance 2; Bible 5; Prayer 5; Read Aloud 4; Insight 5; Questions 3;
Notes 5; Brought a Friend 10. The source defaults are in `lib/point-scoring.js`.

Historical Participation keeps its original points and is archived. Previously
verified friend visits are identified by their recorded `Brought a Friend` ledger
description and moved to the separate `bring_friend` category. No visits are
inferred from Participation points alone.

The one-time database script defaults to a read-only preview:

```powershell
node --preserve-symlinks --preserve-symlinks-main --env-file=.env.local scripts/apply-approved-points.mjs
```

Append `--apply` to apply these approved rules and recalculate recorded session
awards in one PostgreSQL transaction. It saves the original rows before writes,
rejects inconsistent action/ledger matches, removes exact duplicate credits,
and validates both preserved records and idempotency before commit. It includes
deleted sessions in repricing but continues to exclude them from balances.
Manual adjustments, rewards, and existing redemptions remain unchanged.

Timestamped before/after JSON, exact changes, per-youth calculations, and commit
status are stored only in the ignored `out/approved-points/` directory. They are
not exposed through app pages or public assets. Do not rerun this historical
migration for routine future rule edits: it would apply this approved schedule
again to all recorded awards.

The Point rules page controls new awards. Session saves use a transaction, leave
existing checked awards at their recorded values, preserve archived categories
and inactive youths' history, and store category keys with new ledger entries.
This prevents a historical Participation award from becoming a friend award
when an old meeting is saved. The Rewards page links to Point rules; reward
catalog prices are configured separately.

Run `npm test` and `npm run lint` to validate changes.
