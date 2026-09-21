# September 14, 2026 points simulation

This is an analysis deliverable, not an app scoring migration. Proposed rules live only in `points-simulation.mjs`. Database access in `simulation-snapshot.mjs` uses a read-only, repeatable-read transaction and bypasses app initialization.

Generated reports and the source snapshot are in `out/points-simulation/`, which is covered by the repository's existing `out` ignore rule. Youth narratives, timestamps, award counts and data-quality notes are generated from the snapshot; application code is unchanged.

## Reproduce the report from its saved snapshot

```powershell
node --preserve-symlinks --preserve-symlinks-main scripts/points-simulation.mjs
```

The renderer uses the installed `sharp` package. It verifies point totals independently by aggregating awards per meeting, checks action-rate bounds and duplicate awards, and writes PNGs, SVGs, HTML, Markdown, and structured results. The symlink flags avoid Windows profile path resolution restrictions in this workspace.

## Refresh the source data

```powershell
node --preserve-symlinks --preserve-symlinks-main --env-file=.env.local scripts/simulation-snapshot.mjs
```

After refreshing, rerun the renderer and rebuild the sharing ZIP. Review whether the reused participation field represents legacy participation or verified friend visits; the baseline continues to exclude it unless its historical meaning is confirmed. No credentials are written to the source snapshot.

## Deliverables

- `report.html`: readable report, colored matrix, reward timing, assumptions, and image download links; opens locally.
- `report.md`: full text report and matrix.
- `engagement-matrix.png`: all youth as columns, actions as rows, formatted on a common 0–100% color scale.
- `engagement-matrix-1.png` / `engagement-matrix-2.png`: the same matrix split for easier sharing.
- `youth-report.png`: all youth with 1–2 sentence explanations.
- `youth-report-1.png` / `youth-report-2.png`: report split into two images.
- `projection-results.json`: full-precision rates, counts, projections, and threshold calculations.
- `source-snapshot.json`: source evidence for local audit.

The baseline starts at zero for 45 scheduled meetings; the report also shows existing balance plus the next 45 meetings. Annual earning rates exclude legacy participation, add no unmeasured friend awards, and exclude deleted meetings and meetings before joining. Existing balances retain all ledger entries. Corrected records are used as entered; no extra attendance is inferred. Youth without any recorded action history receive N/A projections. The previous snapshot, results and share archive are preserved in `out/points-simulation/previous/` for comparison.
