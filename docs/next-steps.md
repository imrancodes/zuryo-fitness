# Next steps

These are ordered by priority: reliability and core booking flow first, then optional enhancements. Current status is in [feature-status.md](feature-status.md).

## 1. Background jobs for session and booking state

- **What:** a scheduled job that completes expired sessions, marks missed sessions, and releases unpaid bookings after a deadline.
- **Why:** this logic only runs when someone reads the data. Unpaid bookings hold a trainer's slot forever, which blocks real customers, and nothing can send reminders.
- **Approach:** run a Vercel Cron route every few minutes. It reuses the existing `reconcileExpiredSessions` and adds an `expireUnpaidBookings` step in the same per-trainer transaction lock. Mark released bookings as `cancelled` with a reason.

## 2. Real payment integration

- **What:** replace the simulated payment with a gateway such as Razorpay.
- **Why:** Zuryo can't take real money today, and there are no refunds.
- **Approach:**
  - Keep the existing 15-minute price snapshot and use it to create the gateway order.
  - Confirm payments only through a **signed webhook**. Keep the existing unique "one paid payment per booking" index.
  - Add refunds and a job that reconciles stuck `pending` payments.

## 3. Cancel and reschedule

- **What:** customer and admin cancellation with a clear refund policy, plus rescheduling.
- **Why:** this is a basic expectation for a booking product, and it's currently missing everywhere.
- **Approach:** add cancel and reschedule service functions inside the trainer lock. A reschedule reuses `createBooking`'s eligibility check for the new time. Refunds go through the gateway from step 2.

## 4. Notifications

- **What:** booking confirmations, session reminders and trainer alerts by push, SMS or email.
- **Why:** today the only alert is the in-app five-minute warning, so trainers have no way to learn about a new booking.
- **Approach:** write booking events to an outbox collection inside the existing transactions. A worker started by the cron from step 1 then sends them through a provider and records the delivery status.

## 5. Security hardening

- **What:** rate limiting on login and AI routes, password reset, email verification, and turning off demo login when real users exist.
- **Why:** login can be brute-forced, and demo login is open in every environment.
- **Approach:** add a Redis-backed limiter (for example Upstash) in the Route Handlers. Put demo access behind an environment flag. Use short-lived tokens with a revocation list.

## 6. Admin operational tools

- **What:** user management (activate or deactivate), booking actions (reassign, cancel, refund), and basic reports.
- **Why:** admins can see problems but can't fix them.
- **Approach:** add write endpoints that reuse the booking and payment services and record an audit-log entry for every admin action. Build on the existing `/admin/bookings` details page.

## 7. Monitoring and end-to-end tests

- **What:** error tracking, structured logs, storing AI token usage, and Playwright tests for the main flows.
- **Why:** service tests are strong (179 passing), but nothing tests the UI or alerts anyone to production errors.
- **Approach:** add Sentry or a similar tool, and log Gemini's `usageMetadata` for each plan. Add Playwright tests for booking to checkout to session to history, run in CI against a seeded test database.

## 8. Live trainer location and ETA

- **What:** a trainer's live location and an ETA for the customer around session start.
- **Why:** it's useful for at-home sessions, but optional until the steps above are done.
- **Approach:** the trainer app shares its location only during the start window. Store the latest position with a time-to-live index, calculate the ETA with a maps API, and push updates over Server-Sent Events.

## Most valuable next step

**Background jobs (step 1)** matter most. Today, a single abandoned unpaid booking blocks a trainer's slot indefinitely, and nothing runs unless someone opens a page. A scheduled job fixes that directly. It also becomes the base for payment reconciliation (step 2) and notifications (step 4), so later work builds on it instead of duplicating it.
