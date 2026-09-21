# Rock Youth Rewards Tracker

A hosted-ready Next.js app for tracking youth group attendance, engagement points, reward redemption, and individual trends.

## Run locally

Install Node.js 20 or newer, then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app opens directly to the admin dashboard and uses a local SQLite database at `data/rock-youth.db`.

## Included workflows

- Compact session-summary landing page with total point balance and seven-day change, active youth and estimated month-over-month roster growth, and an attendance sparkline for the last eight sessions. Comparisons use Central time; roster growth uses current active members' join dates because historical status changes were not recorded.

- Youth attendee admin with inline edit/remove support, including grade and birth date metadata.
- Leader/admin display records with inline edit/remove support.
- Configurable point rules for attendance, Bible, prayer, reading aloud, insights, questions, notes, and bringing a friend.
- Approved awards: attendance 2, Bible 5, prayer 5, reading aloud 4, insights 5, questions 3, notes 5, and bringing a friend 10. Historical Participation points are archived and preserved.
- Point rule edits apply to new awards; saving an existing meeting preserves already-recorded values and archived points.
- Reward catalog with point costs and active/inactive status.
- Meeting/session point entry for active youth.
- Manual ledger entries for adjustments, bonuses, and corrections.
- Reward redemption that checks available balance and records point spending.
- Individual reports with balance, lifetime earned/spent, attendance, category tendencies, recent sessions, adjustments, and reward history.
- Sortable reports with youth, report links, and attendance first on mobile.
- Session trends at `/trends`, with attendance by default, action and date filters, session inspection, and an accessible data table.
- Scorecard birthdays for active youth: the current Sunday–Saturday week in Central time, plus the next three occurrences after that week. Missing/invalid dates are skipped; February 29 is observed on February 28 in non-leap years.

## Notes

V1 uses private-link access only. It does not include user login, youth accounts, or reward inventory tracking.
