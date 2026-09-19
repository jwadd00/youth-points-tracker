import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.resolve('out/points-simulation');
const source = JSON.parse(fs.readFileSync(path.join(dir, 'source-snapshot.json'), 'utf8'));
const weeks = 45;
const rules = [
  ['attendance', 'Attendance', 2], ['bible', 'Brought Bible', 5],
  ['praying', 'Prayed', 5], ['reading_aloud', 'Read Aloud', 4],
  ['sharing_insights', 'Shared Insight', 5], ['asking_questions', 'Asked Question', 3],
  ['taking_notes', 'Took Notes', 5], ['bring_friend', 'Bring a friend', 10]
];
const sessions = source.sessions.filter(s => !s.deleted_at && s.session_date <= source.retrievedAt.slice(0, 10));
const localDate = value => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));
const refreshed = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
}).format(new Date(source.retrievedAt));
const dataWindow = `${sessions[0]?.session_date ?? 'N/A'} to ${sessions.at(-1)?.session_date ?? 'N/A'}`;
const round = n => n == null ? 'N/A' : Math.round(n).toLocaleString('en-US');
const dec = n => n == null ? 'N/A' : n.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct = n => n == null ? 'N/A' : `${dec(n * 100).replace('.0', '')}%`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const rows = source.attendees.map(y => {
  const ownActions = source.actions.filter(a => a.attendee_id === y.id);
  const firstAction = sessions.filter(s => ownActions.some(a => a.session_id === s.id)).map(s => s.session_date).sort()[0];
  const joined = localDate(y.created_at);
  // Include historical evidence entered before roster creation, if present.
  const start = firstAction && firstAction < joined ? firstAction : joined;
  const eligible = sessions.filter(s => s.session_date >= start);
  const actions = ownActions.filter(a => eligible.some(s => s.id === a.session_id));
  const count = Object.fromEntries(rules.map(([key]) => [key, key === 'bring_friend' ? null : actions.filter(a => a.category_key === key).length]));
  const hasEvidence = actions.some(a => rules.some(([key]) => key === a.category_key));
  const rates = Object.fromEntries(rules.map(([key]) => [key, hasEvidence && count[key] != null && eligible.length ? count[key] / eligible.length : null]));
  const rescored = rules.reduce((sum, [key, , points]) => sum + (count[key] ?? 0) * points, 0);
  const annual = hasEvidence && eligible.length ? rescored / eligible.length * weeks : null;
  const balance = Number(source.balances.find(b => b.attendee_id === y.id)?.balance || 0);
  const tier = annual == null ? 'N/A' : annual >= 500 ? '500' : annual >= 150 ? '150' : annual >= 70 ? '70' : 'Below 70';
  const tierWeeks = [70, 150, 500].map(t => annual > 0 && Math.ceil(t / (annual / weeks)) <= weeks ? Math.ceil(t / (annual / weeks)) : null);
  return { id: y.id, name: `${y.first_name} ${y.last_name}`, first: y.first_name, last: y.last_name,
    status: y.status, start, n: eligible.length, count, rates, rescored, annual, balance,
    futureBalance: annual == null ? null : balance + annual, tier, tierWeeks,
    expectedAttendance: rates.attendance == null ? null : rates.attendance * weeks,
    friendAwardsTo500: annual == null ? null : Math.max(0, Math.ceil((500 - annual) / 10)),
    legacyExcluded: actions.filter(a => a.category_key === 'participation').length,
    eligibleSessionIds: eligible.map(s => s.id)
  };
});

const shortLabels = { bible: 'Bible', praying: 'prayer', reading_aloud: 'reading', sharing_insights: 'insight', asking_questions: 'questions', taking_notes: 'notes' };
const joinList = items => new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' }).format(items);
for (const row of rows) {
  if (row.annual == null) {
    row.explanation = `No awards are recorded across ${row.n} eligible meetings, so there is no engagement history to extrapolate. The projection remains N/A rather than assuming future earnings will be zero.`;
    continue;
  }
  const common = rules.filter(([key]) => key !== 'attendance' && row.count[key] > 0)
    .sort(([a], [b]) => row.count[b] - row.count[a]).slice(0, 3);
  const habits = common.length ? `, with ${joinList(common.map(([key]) => `${shortLabels[key]} in ${row.count[key]}`))}` : ' and no other established action awards';
  const first = `Attendance appears in ${row.count.attendance}/${row.n} meetings${habits}.`;
  let second = `This projects about ${round(row.annual)} points, reaching the ${row.tier}-point tier at the same pace.`;
  if (row.annual >= 500) second = `This projects about ${round(row.annual)} points, reaching 500 around meeting ${row.tierWeeks[2]} at a steady pace.`;
  else if (row.annual < 70) second = `This projects ${round(row.annual)} points, below 70; the estimate uses only ${row.n} eligible meetings.`;
  else if (row.annual < 150 && 150 - row.annual <= 5) second = `This projects about ${round(row.annual)} points; one additional 5-point action over the year would clear 150.`;
  else if (row.annual - 70 < 10) second = `This projects about ${round(row.annual)} points, only ${dec(row.annual - 70)} above 70${row.n < 8 ? `, based on just ${row.n} eligible meetings` : ''}.`;
  row.explanation = `${first} ${second}`;
}
const noHistory = rows.filter(r => r.annual == null);
const includedActions = source.actions.filter(a => sessions.some(s => s.id === a.session_id));
const unmatchedAttendance = includedActions.filter(a => a.category_key !== 'attendance' && !includedActions.some(b => b.session_id === a.session_id && b.attendee_id === a.attendee_id && b.category_key === 'attendance'));
const attendanceNote = unmatchedAttendance.length
  ? `${unmatchedAttendance.length} action awards lack an attendance award in the same meeting; records are left as entered.`
  : 'All recorded engagement awards now have an attendance award in the same meeting.';
const legacyAwards = includedActions.filter(a => a.category_key === 'participation');
const legacyValues = [...new Set(legacyAwards.map(a => a.points))].sort((a, b) => a - b).map(value => `${legacyAwards.filter(a => a.points === value).length} at ${value} points`).join(', ');
const friendNote = `Bring a friend remains unmeasured in the baseline. The reused participation field contains ${legacyAwards.length} awards (${legacyValues}); saving old checkboxes can apply the current 10-point value. Without confirmation that these were actual friend visits, all are excluded from future earning rates, as in the original simulation. Current balances retain all ledger entries, including those awards. Each additional future friend award adds 10 points.`;

// Verify the estimates against an independent per-session weighted aggregation.
for (const row of rows) {
  const sessionTotals = row.eligibleSessionIds.map(id => source.actions.filter(a => a.attendee_id === row.id && a.session_id === id)
    .reduce((sum, a) => sum + (rules.find(([key]) => key === a.category_key)?.[2] || 0), 0));
  if (row.annual != null) assert.ok(Math.abs(sessionTotals.reduce((a, b) => a + b, 0) * weeks / row.n - row.annual) < 1e-9);
  for (const value of Object.values(row.rates)) assert.ok(value == null || (value >= 0 && value <= 1));
  assert.equal(row.rates.bring_friend, null);
  assert.ok(row.eligibleSessionIds.every(id => sessions.some(s => s.id === id)));
}
assert.equal(new Set(source.actions.map(a => `${a.session_id}/${a.attendee_id}/${a.category_key}`)).size, source.actions.length);
const projected = rows.filter(r => r.annual != null);
const reach = [70, 150, 500].map(t => projected.filter(r => r.annual >= t).length);
const meta = { weeks, retrievedAt: source.retrievedAt, meetings: sessions.map(s => s.session_date),
  excludedDeletedMeetings: source.sessions.filter(s => s.deleted_at).map(s => s.session_date), rules,
  tierReachCounts: reach, projectableYouth: projected.length, totalYouth: rows.length };
fs.writeFileSync(path.join(dir, 'projection-results.json'), JSON.stringify({meta, rows}, null, 2));

const ink = '#173345', muted = '#516774', teal = '#126c72', paper = '#f7fafb';
const text = (x, y, value, size = 22, fill = ink, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(value)}</text>`;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const wrap = (value, max) => {
  const lines = [''];
  for (const word of value.split(' ')) {
    if ((lines.at(-1) + ' ' + word).trim().length > max && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = `${lines.at(-1)} ${word}`.trim();
  }
  return lines;
};
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>text{font-family:Arial,Helvetica,sans-serif}</style>${rect(0,0,w,h,paper)}${body}</svg>`;
async function saveImage(name, markup) {
  fs.writeFileSync(path.join(dir, `${name}.svg`), markup);
  await sharp(Buffer.from(markup)).png().toFile(path.join(dir, `${name}.png`));
}
function cellColor(rate) {
  if (rate == null) return '#e4e8ed';
  const a = [246, 249, 247], b = [15, 115, 113];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * rate)).join(',')})`;
}
function matrix(subset, titleSuffix = '') {
  const left = 274, col = 124, width = left + subset.length * col + 38, height = 1100;
  let body = text(36, 60, `45-week engagement outlook${titleSuffix}`, 36, ink, 'font-weight="700"');
  body += text(36, 98, 'Expected share of ALL scheduled meetings with each award • proposed points in row labels', 22, muted);
  body += text(36, 132, `${sessions.length} recorded meetings • ${dataWindow} • refreshed ${refreshed}`, 20, muted);
  for (let i = 0; i < subset.length; i++) {
    const row = subset[i], x = left + i * col + col / 2;
    body += text(x, 190, row.first, 20, ink, 'text-anchor="middle" font-weight="700"');
    body += text(x, 215, row.last, 16, muted, 'text-anchor="middle"');
    body += text(x, 244, `n = ${row.n}${row.n < 8 ? '*' : ''}`, 19, muted, 'text-anchor="middle"');
  }
  rules.forEach(([key, label, points], j) => {
    const y = 265 + j * 64;
    body += text(36, y + 39, `${label} (${points})`, 22, ink, 'font-weight="700"');
    subset.forEach((r, i) => {
      const rate = r.rates[key], x = left + i * col;
      body += rect(x + 2, y + 2, col - 4, 60, cellColor(rate), 'rx="4"');
      body += text(x + col / 2, y + 39, pct(rate), 23, rate != null && rate >= .65 ? '#ffffff' : ink, 'text-anchor="middle" font-weight="700"');
    });
  });
  for (const [j, label, fn] of [[0, '45-week points', r => round(r.annual)], [1, 'Highest tier', r => r.tier]]) {
    const y = 793 + j * 50;
    body += text(36, y + 31, label, 21, ink, 'font-weight="700"');
    subset.forEach((r, i) => { body += text(left + i * col + col / 2, y + 31, fn(r), 22, teal, 'text-anchor="middle" font-weight="700"'); });
  }
  for (let i = 0; i <= 4; i++) {
    const x = 36 + i * 140;
    body += rect(x, 910, 44, 28, cellColor(i / 4), 'rx="3"') + text(x + 54, 932, `${i * 25}%`, 20);
  }
  body += rect(766, 910, 44, 28, cellColor(null), 'rx="3"') + text(820, 932, 'N/A: unmeasured', 20);
  body += text(36, 974, 'Rate = recorded awards ÷ eligible recorded meetings; annual events = rate × 45. Absences count in the denominator.', 20, muted);
  body += text(36, 1007, 'Friend awards are unmeasured; baseline adds 0 friend points. Old participation is excluded. N/A youth have no award history.', 20, muted);
  body += text(36, 1040, '*Short history. Meetings before joining are excluded. Corrected awards are included; no attendance awards are inferred.', 20, muted);
  body += text(36, 1073, 'Totals start at zero; no spending. Rates describe recorded awards, not ability; percentages do not sum to 100%.', 20, muted);
  return svg(width, height, body);
}
await saveImage('engagement-matrix', matrix(rows));
await saveImage('engagement-matrix-1', matrix(rows.slice(0, 10), ' • 1 of 2'));
await saveImage('engagement-matrix-2', matrix(rows.slice(10), ' • 2 of 2'));

function reportImage(subset, page) {
  const width = 1800, rowHeight = 144, height = 348 + subset.length * rowHeight + 155;
  let body = text(44, 62, `Youth points • one-year simulation${page ? ` • ${page}` : ''}`, 38, ink, 'font-weight="700"');
  body += text(44, 104, '45 meetings • proposed scoring • steady recorded habits • no future reward spending', 24, muted);
  body += text(44, 153, `${reach[0]} of ${projected.length} reach 70   |   ${reach[1]} reach 150   |   ${reach[2]} reach 500   |   ${rows.length - projected.length} have insufficient history`, 27, teal, 'font-weight="700"');
  body += text(44, 197, 'Year points start at zero. Balance + year carries forward the existing app balance under its original scoring.', 22, muted);
  body += text(44, 231, 'Thresholds are assessed separately; reaching 500 does not pay for all three rewards (70 + 150 + 500 = 720).', 22, muted);
  body += rect(30, 265, width - 60, 58, ink);
  body += text(44, 302, 'Youth / history', 23, '#ffffff', 'font-weight="700"');
  body += text(380, 302, 'Year pts', 23, '#ffffff', 'font-weight="700"');
  body += text(521, 302, 'Balance + year', 23, '#ffffff', 'font-weight="700"');
  body += text(750, 302, 'Tier', 23, '#ffffff', 'font-weight="700"');
  body += text(900, 302, 'Reasoning', 23, '#ffffff', 'font-weight="700"');
  subset.forEach((r, i) => {
    const y = 336 + i * rowHeight;
    if (i % 2 === 0) body += rect(30, y, width - 60, rowHeight - 5, '#edf3f5', 'rx="5"');
    body += text(44, y + 43, r.name, 24, ink, 'font-weight="700"');
    body += text(44, y + 79, `${r.count.attendance}/${r.n} attendance awards${r.n < 8 ? '*' : ''}`, 20, muted);
    body += text(380, y + 49, round(r.annual), 29, teal, 'font-weight="700"');
    body += text(544, y + 49, round(r.futureBalance), 27, ink);
    body += text(750, y + 49, r.tier, 24, ink, 'font-weight="700"');
    const lines = wrap(r.explanation, 76);
    assert.ok(lines.length <= 4, `Explanation too long: ${r.name}`);
    lines.forEach((line, j) => { body += text(900, y + 29 + j * 28, line, 21); });
  });
  const foot = 348 + subset.length * rowHeight;
  body += text(44, foot + 27, `Refreshed ${refreshed} • ${sessions.length} non-deleted meetings • ${dataWindow} • corrected tracker data.`, 21, muted);
  body += text(44, foot + 61, `Each youth uses eligible meetings since joining. *Short history; estimates remain provisional with ${Math.min(...rows.map(r => r.n))}–${Math.max(...rows.map(r => r.n))} observations.`, 21, muted);
  body += text(44, foot + 95, 'Bring a friend: +10 per future award, 0 assumed in baseline. Legacy participation removed. Points rounded only for display.', 21, muted);
  body += text(44, foot + 129, 'Projections describe recorded awards; missing or uneven entry can understate engagement. App scoring and records were not changed.', 21, muted);
  return svg(width, height, body);
}
await saveImage('youth-report', reportImage(rows, ''));
await saveImage('youth-report-1', reportImage(rows.slice(0, 10), '1 of 2'));
await saveImage('youth-report-2', reportImage(rows.slice(10), '2 of 2'));

const methods = [
  `This is a steady-habit scenario for a fresh ${weeks}-meeting year, not a probability forecast. The alternative total adds current app balance to the same future ${weeks} meetings, with no future spending or adjustments. It is not a December 31 projection.`,
  `Source: ${source.source}, read-only snapshot ${source.retrievedAt}. Included dates: ${sessions.map(s => s.session_date).join(', ')}. Deleted meetings on ${meta.excludedDeletedMeetings.join(' and ')} are excluded. Unrecorded calendar weeks are not assumed to be absences.`,
  'For each youth, count non-deleted recorded meetings on or after roster creation (America/Chicago date), including the creation date. Earlier activity, if any, takes precedence. Roster creation is a proxy for joining because the app has no membership start/end history. Nonattendance after joining remains in the denominator.',
  'For each established action: rate = action-award count / eligible meeting count. Projected annual occurrences = 45 × rate. Projected annual points = 45 × sum(action count × proposed point value) / eligible meeting count. Count recorded actions, not historical point totals. Each action can earn once per meeting, matching the app; fractions are expected values.',
  'The matrix shows the expected percentage of all 45 scheduled meetings receiving each award, not the percentage of attended meetings and not the share of points. Holding tendencies constant leaves percentages unchanged over time; the annual event counts and point totals grow. Percentages across actions do not sum to 100%.',
  friendNote,
  `No-award histories (${noHistory.map(r => `${r.name}: ${r.n} eligible meetings`).join('; ') || 'none'}) are marked N/A, not predicted to remain at zero. Other zero percentages mean no award recorded for that action in the available sample; they do not imply inability or permanent non-engagement.`,
  attendanceNote,
  'Thresholds 70, 150 and 500 are compared independently against unrounded fresh-year totals. Approximate threshold meeting = ceiling(threshold / average points per scheduled meeting). This assumes evenly spread earning; it is not a promised date. Buying one of each reward costs 720 points, and spending would reduce redeemable balance.',
  `Only ${sessions.length} usable group meetings are available. There is no reliable basis here for seasonality, attendance growth, effects of the new incentives, friend behavior, or statistical confidence claims. Missing award checkboxes may reflect incomplete entry. These are provisional recorded-behavior scenarios.`
];
let md = `# Youth points: 45-week simulation\n\nRefreshed: ${refreshed}. **${reach[0]} of ${projected.length} projectable youth reach 70, ${reach[1]} reach 150, and ${reach[2]} reach 500.** ${noHistory.length} youth have insufficient history.\n\n`;
md += '## Proposed values\n\n' + rules.map(([, label, points]) => `- ${label}: ${points}`).join('\n') + '\n\nParticipation is removed; no app labels or values were edited.\n\n';
md += '## Each youth\n\nYear points start at zero. Balance + year includes current app balance, then 45 future meetings with no spending. Figures are rounded to the nearest point; thresholds use unrounded totals.\n\n';
md += '| Youth | Attendance / eligible | Year points | Current balance | Balance + year | Highest fresh-year tier | Reasoning |\n|---|---:|---:|---:|---:|---|---|\n';
md += rows.map(r => `| ${r.name} | ${r.count.attendance}/${r.n} | ${round(r.annual)} | ${r.balance} | ${round(r.futureBalance)} | ${r.tier} | ${r.explanation} |`).join('\n');
md += '\n\n## Reward timing and friend sensitivity\n\nMeeting estimates below assume steady earning from zero; a dash means the threshold is not reached in 45 meetings. Friend awards are additional to baseline.\n\n';
md += '| Youth | 70 meeting | 150 meeting | 500 meeting | Extra friend awards to 500 |\n|---|---:|---:|---:|---:|\n';
md += rows.map(r => `| ${r.name} | ${r.tierWeeks.map(n => n ?? '—').join(' | ')} | ${r.friendAwardsTo500 ?? 'N/A'} |`).join('\n');
md += '\n\n## Percentage matrix\n\n![Color-coded engagement matrix](engagement-matrix.png)\n\n';
md += '| Action | ' + rows.map(r => r.name).join(' | ') + ' |\n|---|' + rows.map(() => '---:').join('|') + '|\n';
md += rules.map(([key, label, points]) => `| ${label} (${points}) | ${rows.map(r => pct(r.rates[key])).join(' | ')} |`).join('\n');
md += '\n\n## Method and limitations\n\n' + methods.map((s, i) => `${i + 1}. ${s}`).join('\n\n') + '\n';
fs.writeFileSync(path.join(dir, 'report.md'), md);

const tableHead = '<tr><th>Youth</th><th>Attendance / eligible</th><th>Year points</th><th>Current balance</th><th>Balance + year</th><th>Highest tier</th><th>Reasoning</th></tr>';
const tableRows = rows.map(r => `<tr><th scope="row">${esc(r.name)}</th><td>${r.count.attendance}/${r.n}</td><td><b>${round(r.annual)}</b></td><td>${r.balance}</td><td>${round(r.futureBalance)}</td><td>${r.tier}</td><td>${esc(r.explanation)}</td></tr>`).join('');
const timingRows = rows.map(r => `<tr><th>${esc(r.name)}</th>${r.tierWeeks.map(n => `<td>${n ?? '—'}</td>`).join('')}<td>${r.friendAwardsTo500 ?? 'N/A'}</td></tr>`).join('');
const matrixRows = rules.map(([key, label, points]) => `<tr><th scope="row">${label} (${points})</th>${rows.map(r => `<td style="background:${cellColor(r.rates[key])};color:${r.rates[key] != null && r.rates[key] >= .65 ? 'white' : ink}">${pct(r.rates[key])}</td>`).join('')}</tr>`).join('');
fs.writeFileSync(path.join(dir, 'report.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Youth points — 45-week simulation</title><style>
body{font:16px/1.55 Arial,sans-serif;color:${ink};background:${paper};margin:0}main{max-width:1500px;margin:auto;padding:36px}h1{font-size:36px;margin-bottom:8px}h2{margin-top:40px}p{max-width:1100px}.lead{font-size:23px;color:${teal};font-weight:bold}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;padding:14px;border-bottom:1px solid #dce4e8;vertical-align:top}thead{background:${ink};color:white}tbody th{min-width:150px}td:last-child{min-width:320px}.matrix{font-size:14px}.matrix th{white-space:nowrap}.matrix td{min-width:88px;text-align:center;font-weight:bold}.matrix td:last-child{min-width:88px}a{color:${teal}}.links{display:flex;gap:20px;flex-wrap:wrap}.note{color:${muted}}button{font:inherit;padding:8px 15px;border:1px solid ${teal};background:white;color:${teal};cursor:pointer}li{margin-bottom:12px}@media print{main{padding:0}.links,button{display:none}.scroll{overflow:visible}.matrix{font-size:8px}.matrix th,.matrix td{min-width:0!important;padding:4px}th,td{padding:7px;font-size:11px}td:last-child{min-width:0}tr{break-inside:avoid}h2{break-after:avoid}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@page{size:landscape;margin:12mm}
</style></head><body><main><h1>Youth points: 45-week simulation</h1><p class="note">Refreshed ${esc(refreshed)} • ${rows.length} youth • ${sessions.length} usable meetings • ${dataWindow}</p><p class="lead">${reach[0]} of ${projected.length} projectable youth reach 70 · ${reach[1]} reach 150 · ${reach[2]} reach 500</p><p>${noHistory.length} youth have insufficient history. These are provisional estimates of recorded habits continuing across 45 meetings, starting at zero. Each additional friend award adds 10 points.</p><div class="links"><a href="engagement-matrix.png" download>Download full matrix PNG</a><a href="engagement-matrix-1.png" download>Matrix 1 of 2</a><a href="engagement-matrix-2.png" download>Matrix 2 of 2</a><a href="youth-report-1.png" download>Report PNG 1 of 2</a><a href="youth-report-2.png" download>Report PNG 2 of 2</a><button onclick="window.print()">Print report</button></div>
<h2>Proposed scoring</h2><p>${rules.map(([, label, points]) => `${label}: <b>${points}</b>`).join(' · ')}.</p><p>Participation is removed. App labels, point rules and records were not edited.</p>
<h2>Each youth</h2><p>Year points = a fresh 45-meeting year. Balance + year = current app balance + 45 future meetings, with no future spending. Rounded figures are for display; tier decisions use unrounded totals.</p><div class="scroll"><table><thead>${tableHead}</thead><tbody>${tableRows}</tbody></table></div>
<h2>Engagement percentage matrix</h2><p>Percent of <b>all scheduled meetings</b> expected to receive the award, including absences in the denominator. Darker teal = higher frequency (0–100%); gray N/A = unmeasured. Rates stay constant in this scenario; they do not sum to 100%.</p><div class="scroll"><table class="matrix"><thead><tr><th>Action / points</th>${rows.map(r => `<th>${esc(r.first)}<br>${esc(r.last)}<br>n = ${r.n}${r.n < 8 ? '*' : ''}</th>`).join('')}</tr></thead><tbody>${matrixRows}</tbody></table></div><p class="note">*Short history. Bring a friend is unmeasured; baseline adds zero friend points. ${esc(noHistory.map(r => r.name).join(' and '))} have no award history. ${esc(attendanceNote)}</p>
<h2>Reward timing and friend sensitivity</h2><p>Approximate meeting when each threshold is reached from zero at an even earning pace. A dash means not reached within 45 meetings. Buying one reward at each tier costs 720 points in total.</p><div class="scroll"><table><thead><tr><th>Youth</th><th>70 points: meeting</th><th>150 points: meeting</th><th>500 points: meeting</th><th>Extra friend awards to reach 500</th></tr></thead><tbody>${timingRows}</tbody></table></div>
<h2>Method and limitations</h2><ol>${methods.map(s => `<li>${esc(s)}</li>`).join('')}</ol></main></body></html>`);
console.log(JSON.stringify({ ...meta, results: rows.map(r => ({name:r.name,n:r.n,annual:r.annual,balance:r.balance,futureBalance:r.futureBalance,tier:r.tier,tierWeeks:r.tierWeeks})) }, null, 2));
