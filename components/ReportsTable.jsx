"use client";

import Link from "next/link";
import { useState } from "react";
import { sortReportRows } from "@/lib/reporting";

const columns = [
  ["name", "Youth"], ["open", "Report"], ["attendance", "Attendance"],
  ["balance", "Balance"], ["earned", "Earned"], ["spent", "Redeemed"]
];

export default function ReportsTable({ rows, totalSessions }) {
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const sorted = sortReportRows(rows, sort.key, sort.direction);
  function changeSort(key) {
    setSort(current => ({ key, direction: current.key === key ? (current.direction === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" }));
  }
  if (!rows.length) return <p className="empty">No youth attendees have been added yet.</p>;

  return (
    <>
      <p className="reportTableHint" id="report-table-help">Select a column heading to sort.<span className="mobileTableHint"> Swipe for point totals.</span></p>
      <div className="tableWrap reportsTableWrap" role="region" aria-label="Individual youth reports" tabIndex={0}>
        <table className="reportsTable" aria-describedby="report-table-help">
          <caption className="srOnly">Youth balances and attendance across {totalSessions} recorded sessions.</caption>
          <colgroup>{columns.map(([key]) => <col key={key} className={`reportCol-${key}`} />)}</colgroup>
          <thead><tr>{columns.map(([key, label]) => (
            <th key={key} scope="col" aria-sort={key === sort.key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
              {key === "open" ? label : <button type="button" className="sortHeading" onClick={() => changeSort(key)} aria-label={`Sort by ${label.toLowerCase()}`}>
                {label}<span aria-hidden="true">{sort.key === key ? sort.direction === "asc" ? "↑" : "↓" : "↕"}</span>
              </button>}
            </th>
          ))}</tr></thead>
          <tbody>{sorted.map(row => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td><Link className="btn secondary reportOpen" href={`/reports/${row.id}`} aria-label={`Open report for ${row.name}`}>Open</Link></td>
              <td><span className="attendanceCount">{row.attendance} / {totalSessions}</span><span className="attendancePercent">{totalSessions ? Math.round(row.attendance / totalSessions * 100) : 0}%</span></td>
              <td className="score">{row.balance.toLocaleString()}</td>
              <td>{row.earned.toLocaleString()}</td>
              <td>{row.spent.toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
