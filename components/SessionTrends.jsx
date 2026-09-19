"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { chartTicks, filterSessionTrends } from "@/lib/reporting";

function dateLabel(date, compact = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", compact
    ? { month: "numeric", day: "numeric", year: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

export default function SessionTrends({ sessions, categories }) {
  const [category, setCategory] = useState(categories.some(c => c.category_key === "attendance") ? "attendance" : categories[0]?.category_key || "attendance");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [width, setWidth] = useState(640);
  const chartRef = useRef(null);
  const descriptionId = useId();
  const invalidRange = Boolean(from && through && from > through);
  const filtered = invalidRange ? [] : filterSessionTrends(sessions, from, through);
  const label = categories.find(c => c.category_key === category)?.label || "Attendance";
  const selected = filtered.find(s => s.id === selectedId) || filtered.at(-1);
  const focused = filtered.find(s => s.id === hoveredId) || selected;
  const selectedIndex = selected ? filtered.findIndex(s => s.id === selected.id) : -1;
  const values = filtered.map(s => s.counts[category] || 0);
  const ticks = chartTicks(Math.max(0, ...values));
  const height = 300, left = 42, right = width - 34, top = 38, bottom = height - 62;
  const x = i => filtered.length < 2 ? (left + right) / 2 : left + i / (filtered.length - 1) * (right - left);
  const y = value => bottom - value / ticks.at(-1) * (bottom - top);
  const path = values.map((value, i) => `${i ? "L" : "M"}${x(i)},${y(value)}`).join(" ");
  const tickCount = Math.min(filtered.length, Math.max(2, Math.floor((width - 60) / 105)));
  const dateIndices = new Set(Array.from({ length: tickCount }, (_, i) => tickCount === 1 ? 0 : Math.round(i * (filtered.length - 1) / (tickCount - 1))));

  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, Math.floor(entry.contentRect.width))));
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  function sessionAtPointer(event) {
    const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect();
    const position = (event.clientX - bounds.left) * width / bounds.width;
    const index = Math.max(0, Math.min(filtered.length - 1, Math.round((position - left) / (right - left) * (filtered.length - 1))));
    return filtered[index]?.id;
  }
  function selectSession(id) {
    setSelectedId(id);
    setHoveredId(null);
  }

  return (
    <section className="panel trendsPanel">
      <div className="trendFilters">
        <label className="field">Engagement action<select value={category} onChange={event => { setCategory(event.target.value); setHoveredId(null); }}>
          {categories.map(c => <option key={c.category_key} value={c.category_key}>{c.label}</option>)}
        </select></label>
        <label className="field">From<input type="date" value={from} onChange={event => { setFrom(event.target.value); setHoveredId(null); }} aria-invalid={invalidRange || undefined} aria-describedby={invalidRange ? "trend-range-error" : undefined} /></label>
        <label className="field">Through<input type="date" value={through} onChange={event => { setThrough(event.target.value); setHoveredId(null); }} aria-invalid={invalidRange || undefined} aria-describedby={invalidRange ? "trend-range-error" : undefined} /></label>
        <button type="button" className="btn secondary" disabled={!from && !through} onClick={() => { setFrom(""); setThrough(""); setHoveredId(null); }}>All dates</button>
      </div>
      {invalidRange && <p className="formError" id="trend-range-error" role="alert">Choose an end date on or after the start date.</p>}
      <div className="trendChartHeader">
        <h2>{label}</h2>
        <p aria-live="polite">{filtered.length} {filtered.length === 1 ? "session" : "sessions"}{filtered.length > 0 && ` · ${(values.reduce((sum, n) => sum + n, 0) / filtered.length).toLocaleString("en-US", { maximumFractionDigits: 1 })} youth per session on average`}</p>
      </div>
      <div ref={chartRef} className="trendChart">
        {filtered.length ? <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: number of youth by session date`} aria-describedby={descriptionId}>
          <text x={0} y={16} className="chartAxisTitle">Youth</text>
          {ticks.map(tick => <g key={tick}>
            <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="chartGrid" />
            <text x={left - 12} y={y(tick) + 5} textAnchor="end" className="chartTick">{tick}</text>
          </g>)}
          {dateIndices.size > 0 && [...dateIndices].map(i => <text key={i} x={x(i)} y={bottom + 28} textAnchor="middle" className="chartTick">{dateLabel(filtered[i].date, true)}</text>)}
          <text x={(left + right) / 2} y={height - 6} textAnchor="middle" className="chartAxisTitle">Session date</text>
          {values.length > 1 && <path d={path} className="chartLine" />}
          {focused && <line x1={x(filtered.indexOf(focused))} x2={x(filtered.indexOf(focused))} y1={top} y2={bottom} className="chartGuide" />}
          {values.map((value, i) => <g key={filtered[i].id}>
            <circle cx={x(i)} cy={y(value)} r={filtered[i].id === focused?.id ? 6 : 4} className="chartDot" />
            {filtered.length <= Math.max(4, Math.floor(width / 60)) && <text x={x(i)} y={y(value) - 13} textAnchor="middle" className="chartValue">{value}</text>}
          </g>)}
          <rect x={left - 16} y={top - 20} width={right - left + 32} height={bottom - top + 40} fill="transparent" className="chartHitArea"
            onPointerMove={event => { if (event.pointerType === "mouse") setHoveredId(sessionAtPointer(event)); }}
            onPointerLeave={() => setHoveredId(null)} onPointerDown={event => selectSession(sessionAtPointer(event))} />
        </svg> : <p className="empty">{invalidRange ? "Update the dates to view the chart." : sessions.length ? "No sessions in this date range. Try a wider range or All dates." : "No sessions yet. Create a session and record awards to see trends."}</p>}
      </div>
      <p className="trendHelp" id={descriptionId}>Each point is one session, in date order. Tap or hover to inspect; use the session selector below for keyboard access. Dates are spaced equally.</p>
      {focused && <div className="trendSelection">
        <div className="trendReadout" aria-live="polite" aria-atomic="true"><strong>{focused.counts[category] || 0} youth</strong><span>{label} · {dateLabel(focused.date)}</span><span>{focused.title}</span></div>
        <div className="trendSessionControls">
          <label className="field">Session<select value={selected.id} onChange={event => selectSession(Number(event.target.value))}>
            {filtered.map(session => <option key={session.id} value={session.id}>{dateLabel(session.date)} · {session.title} (#{session.id})</option>)}
          </select></label>
          <div className="trendStepButtons">
            <button type="button" className="btn secondary" disabled={selectedIndex <= 0} onClick={() => selectSession(filtered[selectedIndex - 1].id)} aria-label="Previous session">← Previous</button>
            <button type="button" className="btn secondary" disabled={selectedIndex >= filtered.length - 1} onClick={() => selectSession(filtered[selectedIndex + 1].id)} aria-label="Next session">Next →</button>
          </div>
        </div>
      </div>}
      <p className="trendHelp">Counts reflect recorded awards, not point values. Removed sessions are excluded; zero means no award recorded.</p>
      {filtered.length > 0 && <details className="trendData"><summary>View session data</summary>
        <div className="tableWrap"><table className="trendDataTable">
          <caption className="srOnly">{label} by session</caption>
          <thead><tr><th scope="col">Date / session</th><th scope="col">Youth</th></tr></thead>
          <tbody>{filtered.map(session => <tr key={session.id}><th scope="row"><Link href={`/sessions/${session.id}`}>{dateLabel(session.date)}<span>{session.title}</span></Link></th><td>{session.counts[category] || 0}</td></tr>)}</tbody>
        </table></div>
      </details>}
    </section>
  );
}
