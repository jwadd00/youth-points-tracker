"use client";

import { useMemo, useState } from "react";
import { deleteAttendee, saveAttendee } from "@/lib/actions";
import { points } from "@/lib/format";

function attendeeName(attendee) {
  return `${attendee.first_name} ${attendee.last_name}`.trim();
}

function searchableText(attendee) {
  return [
    attendee.first_name,
    attendee.last_name,
    attendee.grade,
    attendee.status,
    attendee.notes,
    attendee.birth_date
  ].join(" ").toLowerCase();
}

export default function AttendeeRoster({ attendees }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredAttendees = useMemo(() => {
    if (!normalizedSearch) return attendees;
    return attendees.filter((attendee) => searchableText(attendee).includes(normalizedSearch));
  }, [attendees, normalizedSearch]);

  return (
    <>
      <div className="rosterToolbar">
        <label className="searchField">
          <span>Search youth</span>
          <input
            aria-label="Search youth roster"
            autoComplete="off"
            name="roster_search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, grade, status, notes"
            type="search"
            value={search}
          />
        </label>
        <div className="rosterCount" aria-live="polite">
          <strong>{filteredAttendees.length}</strong>
          <span>shown</span>
        </div>
        {search ? (
          <button className="btn secondary" type="button" onClick={() => setSearch("")}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="rosterList">
        {filteredAttendees.map((attendee) => {
          const name = attendeeName(attendee);
          const formId = `attendee-${attendee.id}`;
          return (
            <article className="attendeeCard" key={attendee.id}>
              <div className="attendeeIdentity">
                <div className="avatar" aria-hidden="true">
                  {attendee.first_name.slice(0, 1)}{attendee.last_name.slice(0, 1)}
                </div>
                <div>
                  <h3>{name}</h3>
                  <div className="metaLine">
                    <span>{attendee.grade || "Grade not set"}</span>
                    <span className={attendee.status === "active" ? "pill" : "pill off"}>{attendee.status}</span>
                    <span className="score">{points(attendee.balance)}</span>
                  </div>
                </div>
              </div>

              <form id={formId} action={saveAttendee} className="attendeeEditGrid">
                <input type="hidden" name="id" value={attendee.id} />
                <label className="field compact">
                  First name
                  <input name="first_name" defaultValue={attendee.first_name} aria-label={`${name} first name`} />
                </label>
                <label className="field compact">
                  Last name
                  <input name="last_name" defaultValue={attendee.last_name} aria-label={`${name} last name`} />
                </label>
                <label className="field compact small">
                  Grade
                  <input name="grade" defaultValue={attendee.grade} aria-label={`${name} grade`} />
                </label>
                <label className="field compact date">
                  Birth date
                  <input name="birth_date" type="date" defaultValue={attendee.birth_date} aria-label={`${name} birth date`} />
                </label>
                <label className="field compact small">
                  Status
                  <select name="status" defaultValue={attendee.status} aria-label={`${name} status`}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="field compact notes">
                  Notes
                  <textarea name="notes" defaultValue={attendee.notes} aria-label={`${name} notes`} />
                </label>
              </form>

              <div className="rowActions">
                <button form={formId} className="btn" type="submit">Save</button>
                <form action={deleteAttendee}>
                  <input type="hidden" name="id" value={attendee.id} />
                  <button className="btn ghost danger" type="submit">Remove</button>
                </form>
              </div>
            </article>
          );
        })}
        {!attendees.length && <p className="empty">No youth attendees have been added yet.</p>}
        {attendees.length > 0 && !filteredAttendees.length && <p className="empty">No youth match that search.</p>}
      </div>
    </>
  );
}
