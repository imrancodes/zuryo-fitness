# Feature status

Status is based on the code and the automated tests ([testing.md](testing.md)), not on the UI alone. Every page listed reads real data from MongoDB; none of them use mock data.

## Implemented

### Customer
- **Register and sign in:** email and password, plus one-click demo access.
- **Book a session:** instant or scheduled in one of 5 zones, with automatic or preferred trainer assignment and protection against double booking.
- **Slot search:** open times for each trainer and zone, in IST.
- **Checkout:** a quote calculated on the server, with peak pricing and commission, locked for 15 minutes.
- **Simulated payment:** approve or decline; it charges once even when retried.
- **My bookings:** booking, payment and session status, filtered by state.
- **Fitness profile:** goals, experience and preferences, with a dated assessment saved on every update.
- **Progress:** sessions per week, consistency, weight trend, credits.
- **Workout history:** completed sessions with exercises and trainer notes, plus a 1–5 rating and comment.
- **Packages:** credit balance and a deduction ledger.
- **AI workout plan:** a Gemini plan with schema and safety validation, caching, 3 regenerations a day and a rules-based fallback.

### Trainer
- **Availability:** add, edit and delete zone-specific time windows; overlaps and windows that would strand a booking are rejected.
- **Sessions list:** upcoming, in progress and completed sessions assigned to the trainer.
- **Run a session:** start within the window, a countdown set by the server, a five-minute warning, and completion.
- **Workout record:** exercises, notes and a suggested next workout, editable for 24 hours after completion.

### Admin
- **Pricing:** normal and peak prices, commission and peak windows (overlaps rejected); checkout pauses when pricing is inactive.
- **Packages:** grant 1–50 session credits to a customer by email.
- **Bookings:** a read-only list with status, payment and date filters, name or ID search and pagination, plus a details page showing payment attempts and session times.

### Platform
- **Server-side role checks** on every page and API.
- **Zod validation** on every write.
- **IST time handling.**
- **Health check** at `/api/health`.
- **Demo seed:** `seed` and `seed:reset`.

## Partially implemented

- **Session completion and missed sessions:** completion happens lazily on the next read. "Missed" is a display status only, with no automatic cancellation or refund.
- **Packages:** credits are deducted when a session completes, but they can't be bought or used at checkout. Customers still pay for each session, and credits are only granted by an admin.
- **Notifications:** only the in-app five-minute warning on the session timer exists.
- **Admin operations:** bookings can be viewed but not reassigned, cancelled or refunded. `GET /api/admin/users` exists, but there is no user management page.
- **Unpaid bookings:** these hold the trainer slot indefinitely, because nothing releases unpaid bookings after a deadline.
- **AI de-duplication:** simultaneous requests share one Gemini call only within a single server instance.
- **Account security:** passwords are hashed and sessions are signed, but there is no login rate limiting, email verification, password reset or token revocation.

## Proposed

- **Real payment gateway** (for example Razorpay) with webhooks, refunds and invoices.
- **Cancel and reschedule**, for both customers and admins.
- **Trainer accept or decline** of assigned bookings.
- **Push, SMS or email notifications** for bookings, reminders and session events.
- **Live trainer location and ETA (GPS)**; currently zones are a fixed list with no location data.
- **Real-time updates** (Server-Sent Events or WebSockets); pages currently refresh on load.
- **Background jobs** for session completion, missed-session handling and expiring unpaid bookings.
- **Admin tools:** user management, booking actions and reports.
- **Buying packages at checkout** and paying with credits.

See [next-steps.md](next-steps.md) for priorities.
