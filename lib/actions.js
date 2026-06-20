"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, insertedId, run } from "@/lib/db";

function text(formData, key) {
  return String(formData.get(key) || "").trim();
}

function intValue(formData, key, fallback = 0) {
  const value = Number.parseInt(String(formData.get(key) || ""), 10);
  return Number.isFinite(value) ? value : fallback;
}

function checked(formData, key) {
  return formData.get(key) ? 1 : 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function saveAttendee(formData) {
  const id = intValue(formData, "id");
  const values = [
    text(formData, "first_name"),
    text(formData, "last_name"),
    text(formData, "grade"),
    text(formData, "birth_date"),
    text(formData, "status") || "active",
    text(formData, "notes")
  ];
  if (!values[0] || !values[1]) return;

  if (id) {
    await run(`
      UPDATE attendees
      SET first_name = ?, last_name = ?, grade = ?, birth_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [...values, id]);
  } else {
    await run(`
      INSERT INTO attendees (first_name, last_name, grade, birth_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, values);
  }
  revalidatePath("/");
  revalidatePath("/attendees");
  revalidatePath("/reports");
  redirect("/attendees?saved=1");
}

export async function deleteAttendee(formData) {
  await run("DELETE FROM attendees WHERE id = ?", [intValue(formData, "id")]);
  revalidatePath("/");
  revalidatePath("/attendees");
  revalidatePath("/reports");
}

export async function saveAdminUser(formData) {
  const id = intValue(formData, "id");
  const values = [
    text(formData, "name"),
    text(formData, "role") || "Leader",
    text(formData, "email"),
    text(formData, "phone"),
    text(formData, "status") || "active",
    text(formData, "notes")
  ];
  if (!values[0]) return;

  if (id) {
    await run(`
      UPDATE admin_users
      SET name = ?, role = ?, email = ?, phone = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [...values, id]);
  } else {
    await run(`
      INSERT INTO admin_users (name, role, email, phone, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, values);
  }
  revalidatePath("/users");
  redirect("/users?saved=1");
}

export async function deleteAdminUser(formData) {
  await run("DELETE FROM admin_users WHERE id = ?", [intValue(formData, "id")]);
  revalidatePath("/users");
}

export async function savePointCategory(formData) {
  await run(`
    UPDATE point_categories
    SET label = ?, points = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    text(formData, "label"),
    Math.max(0, intValue(formData, "points")),
    checked(formData, "enabled"),
    intValue(formData, "id")
  ]);
  revalidatePath("/point-rules");
  revalidatePath("/sessions");
  redirect("/point-rules?saved=1");
}

export async function saveReward(formData) {
  const id = intValue(formData, "id");
  const values = [
    text(formData, "name"),
    text(formData, "description"),
    Math.max(1, intValue(formData, "cost", 1)),
    checked(formData, "active")
  ];
  if (!values[0]) return;

  if (id) {
    await run(`
      UPDATE rewards
      SET name = ?, description = ?, cost = ?, active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [...values, id]);
  } else {
    await run(`
      INSERT INTO rewards (name, description, cost, active)
      VALUES (?, ?, ?, ?)
    `, values);
  }
  revalidatePath("/rewards");
  revalidatePath("/reports");
  redirect("/rewards?saved=1");
}

export async function deleteReward(formData) {
  const rewardId = intValue(formData, "id");
  const used = await get("SELECT COUNT(*) AS count FROM reward_redemptions WHERE reward_id = ?", [rewardId]);
  if (Number(used?.count || 0) > 0) {
    await run("UPDATE rewards SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [rewardId]);
  } else {
    await run("DELETE FROM rewards WHERE id = ?", [rewardId]);
  }
  revalidatePath("/rewards");
}

export async function createSession(formData) {
  const row = await get(`
    INSERT INTO sessions (session_date, title, notes)
    VALUES (?, ?, ?)
    RETURNING id
  `, [text(formData, "session_date") || today(), text(formData, "title"), text(formData, "notes")]);
  const id = insertedId(row);
  revalidatePath("/sessions");
  redirect(`/sessions/${id}?saved=1`);
}

export async function deleteSession(formData) {
  const sessionId = intValue(formData, "id");
  if (!sessionId) return;

  await run(`
    UPDATE sessions
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at = ''
  `, [sessionId]);

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath("/ledger");
  revalidatePath("/reports");
}

export async function restoreDeletedSessionsSince(formData) {
  const restoreDate = text(formData, "restore_date");
  if (!restoreDate) return;

  await run(`
    UPDATE sessions
    SET deleted_at = ''
    WHERE deleted_at >= ?
  `, [`${restoreDate} 00:00:00`]);

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  redirect("/sessions?saved=1");
}

export async function saveSessionPoints(formData) {
  const sessionId = intValue(formData, "session_id");
  const session = await get("SELECT * FROM sessions WHERE id = ? AND deleted_at = ''", [sessionId]);
  if (!session) return;

  const categories = await all("SELECT * FROM point_categories WHERE enabled = 1 ORDER BY sort_order");
  const attendees = await all("SELECT id FROM attendees WHERE status = 'active' ORDER BY last_name, first_name");

  await run("DELETE FROM session_points WHERE session_id = ?", [sessionId]);
  await run("DELETE FROM point_ledger WHERE source_type = 'session' AND source_id = ?", [sessionId]);

  for (const attendee of attendees) {
    for (const category of categories) {
      const field = `cat_${attendee.id}_${category.category_key}`;
      if (!formData.get(field)) continue;
      await run(`
        INSERT INTO session_points (session_id, attendee_id, category_key, points)
        VALUES (?, ?, ?, ?)
      `, [sessionId, attendee.id, category.category_key, category.points]);
      await run(`
        INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, source_id, occurred_on)
        VALUES (?, 'earn', ?, ?, 'session', ?, ?)
      `, [
        attendee.id,
        category.points,
        `${category.label} - ${session.title || "Youth group session"}`,
        sessionId,
        session.session_date
      ]);
    }
  }

  revalidatePath("/");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/reports");
  redirect(`/sessions/${sessionId}?saved=1`);
}

export async function addManualLedger(formData) {
  const attendeeId = intValue(formData, "attendee_id");
  const points = intValue(formData, "points");
  const occurredOn = text(formData, "occurred_on") || today();
  if (!attendeeId || points === 0) return;

  await run(`
    INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, occurred_on)
    VALUES (?, 'adjustment', ?, ?, 'manual', ?)
  `, [attendeeId, points, text(formData, "description") || "Manual adjustment", occurredOn]);
  revalidatePath("/");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  redirect("/ledger?saved=1");
}

export async function redeemReward(formData) {
  const attendeeId = intValue(formData, "attendee_id");
  const rewardId = intValue(formData, "reward_id");
  const redeemedOn = text(formData, "redeemed_on") || today();
  const reward = await get("SELECT * FROM rewards WHERE id = ? AND active = 1", [rewardId]);
  if (!attendeeId || !reward) return;

  const balance = await get(`
    SELECT COALESCE(SUM(points), 0) AS balance
    FROM point_ledger l
    WHERE l.attendee_id = ?
      AND (
        l.source_type != 'session'
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = l.source_id AND s.deleted_at = ''
        )
      )
  `, [attendeeId]);
  if (Number(balance?.balance || 0) < Number(reward.cost || 0)) return;

  const ledger = await get(`
    INSERT INTO point_ledger (attendee_id, entry_type, points, description, source_type, source_id, occurred_on)
    VALUES (?, 'reward', ?, ?, 'reward', ?, ?)
    RETURNING id
  `, [attendeeId, Number(reward.cost) * -1, `Redeemed reward: ${reward.name}`, rewardId, redeemedOn]);
  await run(`
    INSERT INTO reward_redemptions (reward_id, attendee_id, points_spent, ledger_id, redeemed_on, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [rewardId, attendeeId, reward.cost, insertedId(ledger), redeemedOn, text(formData, "notes")]);

  revalidatePath("/");
  revalidatePath("/ledger");
  revalidatePath("/reports");
  redirect("/ledger?saved=1");
}
