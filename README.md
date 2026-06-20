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

- Youth attendee admin with inline edit/remove support, including grade and birth date metadata.
- Leader/admin display records with inline edit/remove support.
- Configurable point rules for attendance, Bible, prayer, reading aloud, insights, questions, notes, and participation.
- Reward catalog with point costs and active/inactive status.
- Meeting/session point entry for active youth.
- Manual ledger entries for adjustments, bonuses, and corrections.
- Reward redemption that checks available balance and records point spending.
- Individual reports with balance, lifetime earned/spent, attendance, category tendencies, recent sessions, adjustments, and reward history.

## Notes

V1 uses private-link access only. It does not include user login, youth accounts, or reward inventory tracking.
