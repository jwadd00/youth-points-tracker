// Approved September 21, 2026. Historical Participation remains archived separately.
export const approvedCategories = [
  ["attendance", "Attendance", 2, 1],
  ["bible", "Brought Bible", 5, 2],
  ["praying", "Prayed", 5, 3],
  ["reading_aloud", "Read Aloud", 4, 4],
  ["sharing_insights", "Shared Insight", 5, 5],
  ["asking_questions", "Asked Question", 3, 6],
  ["taking_notes", "Took Notes", 5, 7],
  ["bring_friend", "Brought a Friend", 10, 8]
];

const historicalLabels = {
  ...Object.fromEntries(approvedCategories.map(([key, label]) => [key, [label]])),
  participation: ["Participation", "Brought a Friend"]
};

export function matchingAwardLedger(action, ledger, category) {
  const labels = new Set([...(historicalLabels[action.category_key] || []), category?.label].filter(Boolean));
  return ledger.filter(row => row.source_type === "session"
    && Number(row.source_id) === Number(action.session_id)
    && Number(row.attendee_id) === Number(action.attendee_id)
    && (row.category_key ? row.category_key === action.category_key
      : [...labels].some(label => row.description.startsWith(`${label} - `))));
}

export function planApprovedScoring(data) {
  const rates = new Map(approvedCategories.map(([key, , points]) => [key, points]));
  const actionUpdates = [];
  const ledgerUpdates = [];
  const duplicateLedgerIds = [];
  const claimedLedger = new Set();
  const seenActions = new Set();
  for (const action of data.actions) {
    const category = data.categories.find(c => c.category_key === action.category_key);
    const matches = matchingAwardLedger(action, data.ledger, category).sort((a, b) => a.id - b.id);
    if (!matches.length) throw new Error(`Action ${action.id} has no matching ledger credit`);
    const first = matches[0];
    if (matches.some(row => row.entry_type !== "earn" || Number(row.points) !== Number(action.points)
      || row.description !== first.description || row.occurred_on !== first.occurred_on)) {
      throw new Error(`Action ${action.id} has inconsistent ledger credits; manual review required`);
    }
    for (const row of matches) {
      if (claimedLedger.has(row.id)) throw new Error(`Ledger ${row.id} matches multiple actions`);
      claimedLedger.add(row.id);
    }
    let targetKey = action.category_key;
    if (targetKey === "participation" && first.description.startsWith("Brought a Friend - ")) targetKey = "bring_friend";
    if (!rates.has(targetKey) && targetKey !== "participation") throw new Error(`Unknown category ${targetKey}`);
    const targetPoints = targetKey === "participation" ? Number(action.points) : rates.get(targetKey);
    const identity = `${action.session_id}:${action.attendee_id}:${targetKey}`;
    if (seenActions.has(identity)) throw new Error(`Multiple actions would become ${identity}`);
    seenActions.add(identity);
    if (targetKey !== action.category_key || targetPoints !== Number(action.points)) {
      actionUpdates.push({ id: action.id, category_key: targetKey, points: targetPoints });
    }
    if (first.category_key !== targetKey || Number(first.points) !== targetPoints) {
      ledgerUpdates.push({ id: first.id, category_key: targetKey, points: targetPoints });
    }
    duplicateLedgerIds.push(...matches.slice(1).map(row => row.id));
  }
  const unclaimed = data.ledger.filter(row => row.source_type === "session" && !claimedLedger.has(row.id));
  if (unclaimed.length) throw new Error(`Session ledger entries without actions: ${unclaimed.map(r => r.id).join(", ")}`);
  const categories = approvedCategories.map(([category_key, label, points, sort_order]) => ({ category_key, label, points, sort_order, enabled: 1 }));
  if (data.categories.some(c => c.category_key === "participation")) {
    categories.push({ category_key: "participation", label: "Participation", points: 4, sort_order: 9, enabled: 0 });
  }
  const categoryUpdates = categories.filter(target => {
    const current = data.categories.find(c => c.category_key === target.category_key);
    return !current || ["label", "points", "sort_order", "enabled"].some(key => current[key] !== target[key]);
  });
  return { actionUpdates, ledgerUpdates, duplicateLedgerIds, categories, categoryUpdates };
}

export function approvedScoringStatements(plan) {
  return [
    ...plan.categoryUpdates.map(c => [
      `INSERT INTO point_categories (category_key, label, points, sort_order, enabled)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT (category_key) DO UPDATE SET
       label = excluded.label, points = excluded.points, sort_order = excluded.sort_order,
       enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP`,
      [c.category_key, c.label, c.points, c.sort_order, c.enabled]
    ]),
    ...plan.actionUpdates.map(a => ["UPDATE session_points SET category_key = ?, points = ? WHERE id = ?", [a.category_key, a.points, a.id]]),
    ...plan.ledgerUpdates.map(l => ["UPDATE point_ledger SET category_key = ?, points = ? WHERE id = ?", [l.category_key, l.points, l.id]]),
    ...plan.duplicateLedgerIds.map(id => ["DELETE FROM point_ledger WHERE id = ?", [id]])
  ];
}

// Only change checkboxes represented in the current form. Existing checked awards
// keep their recorded value, and archived categories/inactive youth stay intact.
export function planSessionAwards({ session, categories, attendees, actions, ledger }, selected) {
  const statements = [];
  for (const attendee of attendees.filter(row => row.status === "active")) {
    for (const category of categories.filter(row => Number(row.enabled) === 1)) {
      const existing = actions.find(row => Number(row.attendee_id) === Number(attendee.id) && row.category_key === category.category_key);
      const isChecked = selected.has(`${attendee.id}:${category.category_key}`);
      if (existing) {
        if (isChecked) continue;
        const matches = matchingAwardLedger(existing, ledger, category);
        if (!matches.length) throw new Error(`Missing ledger credit for action ${existing.id}`);
        statements.push(["DELETE FROM session_points WHERE id = ?", [existing.id]]);
        for (const row of matches) statements.push(["DELETE FROM point_ledger WHERE id = ?", [row.id]]);
      } else if (isChecked) {
        statements.push([
          "INSERT INTO session_points (session_id, attendee_id, category_key, points) VALUES (?, ?, ?, ?)",
          [session.id, attendee.id, category.category_key, category.points]
        ]);
        statements.push([
          "INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, source_id, occurred_on, category_key) VALUES (?, 'earn', ?, ?, 'session', ?, ?, ?)",
          [attendee.id, category.points, `${category.label} - ${session.title || "Youth group session"}`, session.id, session.session_date, category.category_key]
        ]);
      }
    }
  }
  return statements;
}
