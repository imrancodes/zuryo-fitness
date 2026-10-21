# Zuryo

On-demand fitness trainer booking platform built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, MongoDB (Mongoose) and Zod.

## Requirements

- [Bun](https://bun.sh) 1.4+
- A MongoDB Atlas cluster (or any MongoDB 7+ instance)
- Windows only, for tests: the [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist) (`winget install Microsoft.VCRedist.2015+.x64`), needed by the in-memory MongoDB used in tests

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string, including the database name |
| `SESSION_SECRET` | Yes | Random string of at least 32 characters used to sign session cookies |
| `DEMO_PASSWORD` | No | Password for seeded demo accounts. Defaults to `ZuryoDemo123!` in development |
| `ENABLE_DEMO_LOGIN` | No | Set to `true` to allow one-click demo login outside `next dev`. Must be set at build time for the demo UI to appear |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## MongoDB setup

1. Create a free cluster in MongoDB Atlas.
2. Add a database user under **Database Access**.
3. Allow your IP under **Network Access**.
4. Copy the connection string into `MONGODB_URI`, including a database name, for example `mongodb+srv://user:pass@cluster.mongodb.net/zuryo`.
5. Check the connection with `bun run dev` and open http://localhost:3000/api/health.

## Getting started

```bash
bun install
bun run seed
bun run dev
```

Open http://localhost:3000 and sign in, or use **Open demo access** on the sign-in page.

## Demo accounts

`bun run seed` creates or updates:

| Role | Email | Service zones (morning / afternoon) |
| --- | --- | --- |
| Customer | `customer@zuryo.dev` | |
| Admin | `admin@zuryo.dev` | |
| Trainer (demo) | `trainer@zuryo.dev` | Indiranagar / Koramangala |
| Trainer | `rohan.trainer@zuryo.dev` | Koramangala / HSR Layout |
| Trainer | `meera.trainer@zuryo.dev` | Whitefield / Indiranagar |
| Trainer | `kabir.trainer@zuryo.dev` | Jayanagar / HSR Layout |

The seed also creates one synthetic **completed session** from yesterday, between the demo customer and Priya Nair, with a workout log, so the session history views have data. Trainer names, specialties and zones are synthetic. Each trainer gets availability for today and the next 7 days: 06:00–13:00 IST in their first zone and 14:00–21:00 IST in their second. Re-seeding replaces those windows; existing bookings are kept. The seed also upserts the `Standard` pricing rule with the default prices and peak hours (see [Pricing and checkout](#pricing-and-checkout)). The password is `DEMO_PASSWORD`, or `ZuryoDemo123!` if unset. Seeding:

- can be re-run without creating duplicates
- refuses to run when `NODE_ENV=production`
- prints the target database name before writing

## Authentication

- Credentials are stored as bcrypt hashes. `passwordHash` is excluded from queries by default and never returned by the API.
- A session is a JWT signed with `SESSION_SECRET` (HS256, 7 days) in an `HttpOnly`, `SameSite=Lax` cookie that is `Secure` in production.
- `proxy.ts` does a fast signature check to redirect early. Every page and API then validates the session on the server and reloads the user from the database, so a changed role or deactivated account takes effect immediately.
- Public registration only allows `customer` or `trainer`. Admins are created by the seed script.
- Login errors are generic, and redirects after login are limited to the user's own area.
- Demo login only works when `NODE_ENV=development` or `ENABLE_DEMO_LOGIN=true`. It signs in as a seeded account and goes through the same server-side role checks.

## Booking

### Time zone

All times are interpreted in **IST (Asia/Kolkata, UTC+05:30, no daylight saving)** and stored as UTC timestamps. Trainers enter local `HH:mm` times for a `YYYY-MM-DD` date, the server converts them to UTC, and the UI labels every time "IST".

### Instant vs scheduled

Every session lasts **60 minutes**. The server sets the end time; the client can't change it.

| | Instant | Scheduled |
| --- | --- | --- |
| Start time | Within the next 60 minutes | At least 60 minutes from now, up to 30 days ahead |
| Offered starts | Every 15 minutes | Every 30 minutes |
| Customer picks | Zone, then a time | Zone and date, then a time |

All start times must fall on a 15-minute mark. Past times are rejected.

### Service zones

Zones are a fixed list of synthetic Bengaluru areas (`lib/zones.ts`): Indiranagar, Koramangala, HSR Layout, Whitefield and Jayanagar. No GPS is used. Each availability window has exactly one zone, and a trainer only matches a booking request when one of their windows **in the requested zone** covers the whole 60-minute session.

### Trainer assignment

`services/booking.service.ts → createBooking`:

1. If the request's `idempotencyKey` was already used by this customer, return that booking (HTTP 200).
2. Validate the start time against the booking type's rules (HTTP 400 with a clear message).
3. Find **eligible** trainers. A trainer is eligible when:
   - their account is active and has the trainer role
   - an availability window in the requested zone covers the full session
   - they have no overlapping `pending` or `confirmed` booking
4. If the customer chose a **preferred trainer**, only that trainer is considered. If they aren't eligible, the request fails with `409` and is never silently given to someone else.
5. Otherwise eligible trainers are tried in **ascending `_id` order**. That is the tie-break rule: the earliest-created trainer wins, so the result is deterministic.
6. Each attempt re-checks eligibility inside the trainer lock (below) and inserts the booking as `confirmed`. If the trainer was taken in the meantime, the next eligible trainer is tried. If none are left, the response is `409 Conflict`.

### Preventing double bookings

A simple "check, then insert" can race: two requests can both pass the check. Indexes can't express "no overlapping time ranges", and a transaction alone doesn't stop two transactions from reading the same "free" state.

Zuryo serializes all schedule changes **per trainer** with a MongoDB transaction (`services/schedule-lock.ts`):

1. The transaction first increments `scheduleVersion` on the trainer's own `User` document.
2. It then re-checks availability and overlaps, and inserts the booking. Availability create, edit and delete go through the same lock.
3. Two concurrent transactions for the same trainer both write that document, so MongoDB aborts one with a `WriteConflict`. Mongoose's `connection.transaction()` retries it, and the retry reads the committed booking and fails the overlap check with `409`.
4. Anything thrown inside the transaction aborts it, so a booking is never left half-created. It only becomes `confirmed` once the reservation commits.

Transactions need a replica set. MongoDB Atlas provides one, and the tests use `MongoMemoryReplSet`.

**Duplicate submissions.** Each booking request carries a client-generated `idempotencyKey`, and a partial unique index on `{customerId, idempotencyKey}` guarantees at most one booking per key. A replayed request returns the original booking, including one that arrives while the first is still committing.

### Indexes

| Collection | Index | Used for | Limitation |
| --- | --- | --- | --- |
| bookings | `{trainerId, startTime, endTime}` | overlap lookups per trainer | does **not** prevent overlaps; the trainer lock does |
| bookings | `{customerId, startTime: -1}` | "My bookings" | |
| bookings | `{status, startTime}` | upcoming and admin queries | |
| bookings | `{customerId, idempotencyKey}` unique, partial | duplicate-submission guard | only applies when a key is sent |
| traineravailabilities | `{trainerId, startTime, endTime}` | a trainer's day view and overlap checks | overlap between windows is checked inside the lock |
| traineravailabilities | `{serviceZone, date, isAvailable}` | slot search by zone | |
| users | `{email}` unique | login and registration | |

### Real-time updates (future)

Today, booking results show up straight after the API response and on the next page load or refresh. Possible next steps:

- push booking events to customers and trainers with Server-Sent Events or WebSockets, from a MongoDB change stream on `bookings`
- send trainer notifications (push, SMS or email) from a queue worker that consumes those booking events

## Pricing and checkout

### Pricing formula

All money is stored and calculated as **integer paise** (₹1 = 100 paise) in the `INR` currency. Floating-point maths is never used for amounts.

```
session price = peak ? peakPrice : normalPrice
commission    = round_half_up(session price × commissionPercent / 100)    (computed as (price × bps + 5000) div 10000)
total payable = session price + commission
```

| Item | Normal slot | Peak slot |
| --- | ---: | ---: |
| Session price | ₹399.00 (39,900 paise) | ₹499.00 (49,900 paise) |
| Society commission (10%) | ₹39.90 (3,990 paise) | ₹49.90 (4,990 paise) |
| **Total payable** | **₹438.90 (43,890 paise)** | **₹548.90 (54,890 paise)** |

These defaults live in `DEFAULT_PRICING` (`lib/pricing.ts`) and are seeded into the `Standard` pricing rule. The same `calculateQuote` function is used by the server, the admin preview and the tests.

### Peak hours

A session is **peak when its start time falls inside a peak window**. Windows are evaluated in **IST** (Asia/Kolkata): booking timestamps are stored in UTC and converted to IST, including the weekday, before checking. Each window covers its start time up to, but not including, its end time.

| Days | Default peak windows (IST) |
| --- | --- |
| Monday–Friday | 06:00–10:00 and 17:00–21:00 |
| Saturday–Sunday | 07:00–12:00 |

Windows are configured by admins at `/admin/pricing` (days of the week plus a start and end time). Windows that share a day **may not overlap**, so there is never a precedence question. Peak status is a yes/no flag, so one matching window is enough.

### Quote and price-lock policy

1. Checkout shows a quote calculated on the server from the active pricing rule (`GET /api/bookings/[id]/quote`). Nothing is saved yet.
2. **Continue to payment** (`POST /api/bookings/[id]/checkout`) stores a **price snapshot** as a `pending` payment that is **locked for 15 minutes**. Calling it again reuses the open snapshot.
3. Paying charges **exactly the snapshot**. If an admin changes prices in the meantime, a quote that is still valid keeps its price. After 15 minutes the snapshot is marked `expired` and the customer has to review a fresh quote.
4. The client only ever sends `paymentId` and the simulated `outcome`. Any price, commission or peak flag it sends is ignored.

When no pricing rule is active, quotes and checkout return `503`, so checkout is paused until an admin activates pricing again.

### Simulated payment

There is no real gateway, and no card, UPI or bank details are collected. The checkout page has a clearly labelled **Simulated payment** panel where the customer chooses **Approve** (default) or **Decline**. The outcome is deterministic and never random.

| Outcome | Payment record | Booking `paymentStatus` | Booking `status` |
| --- | --- | --- | --- |
| Approve | `paid`, `sim_…` reference, `paidAt` | `paid`, with the amounts stored on the booking | unchanged (`confirmed`) |
| Decline | `failed`, with a reason | `failed`; the customer can start a new checkout and retry | unchanged |

Booking lifecycle status and payment status are separate fields. Payment never changes `status`.

### Payment idempotency and concurrency

- **One open checkout per booking:** a partial unique index on `{bookingId, status}` where `status: "pending"`. Concurrent checkout requests get the same snapshot.
- **One successful payment per booking:** a partial unique index on `{bookingId}` where `status: "paid"`.
- **Retries are safe:** the payment ID acts as the idempotency key. Paying an already `paid` payment returns the same result without charging again.
- **Simultaneous attempts:** `simulatePayment` runs in a MongoDB transaction that reads the payment, checks the booking and then writes both. Concurrent attempts on the same payment both write that document, so MongoDB aborts all but one with a `WriteConflict`. The retried transaction sees `paid` and returns the same result. The conditional booking update (`paymentStatus: {$ne: "paid"}`) and the unique "paid" index are extra safeguards in case different payment records race. Transactions alone aren't relied on to prevent the race; the forced write conflict on the shared document is what serializes the attempts.
- A payment is only `paid` once the transaction that also updates the booking has committed.

### Production payment considerations

A real gateway (for example Razorpay or Stripe) would replace `POST /api/payments/simulate` with:

- a gateway order created at checkout
- a client-side SDK
- a **signed webhook** that confirms the payment on the server

It would also need:

- signature verification
- refunds and partial refunds
- reconciliation jobs for payments stuck in `pending`
- currency and tax (GST) handling
- keeping card data entirely with the gateway (PCI DSS scope)

## Trainer sessions

### Lifecycle

A session belongs to exactly one booking. Its ID is the **booking ID**, and the `SessionRecord` is created when the trainer starts the session. The unique `bookingId` index allows only one record per booking.

| Session status | Meaning | Derived from |
| --- | --- | --- |
| `scheduled` | Confirmed, not started yet | booking `confirmed`, no record, start window not yet closed |
| `in_progress` | The trainer has started it | record `in_progress` and `endsAt` still in the future |
| `completed` | It reached its authoritative end time | record `completed`, or reconciled because `endsAt` has passed |
| `missed` | Never started within the start window | booking `confirmed`, no record, start window closed. Display only; no data changes. |
| `cancelled` | Won't take place | booking `cancelled` |

Allowed transitions:
- `scheduled → in_progress`, when started by the assigned trainer
- `in_progress → completed`, once `endsAt` is reached

`completed` is final. When a session completes, the booking `status` changes from `confirmed` to `completed`. **`paymentStatus` is never changed by sessions**, and payment records are never touched.

### Starting a session

Only the **assigned trainer** can start a session, and only when:
- the booking is `confirmed`
- it has been **paid**
- the current time is within the **start window**: from 15 minutes before to 30 minutes after the scheduled start

The server records `startedAt = now` and `endsAt = startedAt + 60 minutes`. Repeated or simultaneous start requests return the same record and never reset `startedAt`; a duplicate insert hits the unique index and returns the existing record. Any start or end time the client sends is ignored.

### The authoritative timer

```
remainingSeconds = max(0, ceil((endsAt − serverNow) / 1000))
```

- `endsAt` is stored in MongoDB, so refreshing, closing the browser, delayed requests or a changed device clock cannot move it.
- Every session response includes `serverNow`. The browser works out `offset = serverNow − Date.now()` and counts down with `Date.now() + offset`, so a wrong device clock is corrected.
- The timer re-syncs with `GET /api/sessions/[id]` every 30 seconds and whenever the tab becomes visible again.
- The browser's interval only updates the display. When it reaches zero, the trainer's browser calls `POST /api/sessions/[id]/complete` and the server decides.

### Five-minute warning

The warning appears when `0 < remainingSeconds ≤ 300`, that is from exactly 55:00 elapsed. Because it is derived from the stored `endsAt`, it reappears after a refresh during the last five minutes. It is shown once as an in-app alert banner, not as a repeated notification.

### Lazy reconciliation

Correct completion doesn't depend on a background process. **Every read or write of a session** reconciles it: the trainer and customer pages, the session APIs, `GET /api/bookings/me` and workout saves.
- If `endsAt` has passed, a transaction runs a conditional update `{status: "in_progress", endsAt ≤ now} → completed`. It sets `completedAt = endsAt` (the authoritative end, not the time it was read) and marks the booking `completed`.
- Concurrent reconciliations write the same document, so all but one hit a write conflict and see the session already completed. There is exactly **one** transition and no duplicate side effects.
- Early completion is rejected with `409` until `endsAt` is reached.

**In production**, a durable scheduler or delayed job could complete sessions exactly on time even if nobody opens them. Options include a cron-triggered route, MongoDB Atlas Scheduled Triggers, or a queue such as QStash, SQS or BullMQ. Because the transition is a conditional, idempotent update, it can run alongside lazy reconciliation without any risk.

### Workout records

- The assigned trainer logs exercises (name, sets, reps, notes), trainer notes and a suggested next workout.
- The record is editable while the session is in progress and for **24 hours after completion**, then locked.
- Only these fields can be written; timestamps and status can't be changed through the form.
- Customers see the workout summary and trainer notes **after completion**, and only for their own bookings.

### Notifications (future)

Push or SMS reminders would be driven by the same timestamps: a delayed job scheduled at `endsAt − 5 minutes`, sent through a provider such as FCM, APNs or Twilio, with an idempotency key per session so a message is sent once.

## API

All responses are JSON. Errors use the shape `{ "error": string, "fieldErrors"?: { [field]: string[] } }`, and internal errors return a generic `500`.

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Pings the database |
| `POST` | `/api/auth/register` | Public | `customer` or `trainer` only |
| `POST` | `/api/auth/login` | Public | |
| `POST` | `/api/auth/logout` | Public | |
| `POST` | `/api/auth/demo` | Demo mode only | |
| `GET` | `/api/auth/me` | Signed in | |
| `GET` | `/api/availability?mode&serviceZone&date` | Customer | Open slots by trainer, plus all open times |
| `GET` | `/api/trainers?serviceZone&startTime` | Customer | Trainers eligible for one start time |
| `GET` | `/api/trainers/me/availability?date` | Trainer | Own windows for a day, with bookings inside them |
| `POST` | `/api/trainers/me/availability` | Trainer | `{date, startTime, endTime, serviceZone}`; `409` on overlap |
| `PATCH` | `/api/trainers/me/availability/[id]` | Trainer (owner) | `409` if a booking would no longer be covered |
| `DELETE` | `/api/trainers/me/availability/[id]` | Trainer (owner) | `409` if the window has bookings |
| `POST` | `/api/bookings` | Customer | `{mode, startTime, serviceZone, preferredTrainerId?, idempotencyKey}`; `201` new, `200` replay, `400` invalid time, `409` unavailable |
| `GET` | `/api/bookings/me` | Customer | Own bookings, including `sessionStatus` |
| `GET` | `/api/bookings/[id]` | Owner, assigned trainer or admin | `404` for anyone else |
| `GET` | `/api/bookings/[id]/quote` | Customer (owner) | `{quote: {isPeak, sessionPrice, commissionPercent, commissionAmount, totalAmount}}`; `409` if not payable, `503` if pricing is paused |
| `POST` | `/api/bookings/[id]/checkout` | Customer (owner) | Creates or reuses the 15-minute price snapshot; `201` new, `200` reused |
| `POST` | `/api/payments/simulate` | Customer (owner) | `{paymentId, outcome: "approve" \| "decline"}`; `200` with the result, `409` if expired, closed or already paid |
| `GET` | `/api/payments/[id]` | Owner or admin | `404` for anyone else |
| `GET` | `/api/admin/pricing` | Admin | Current pricing rule |
| `PUT` | `/api/admin/pricing` | Admin | `{normalPrice, peakPrice (paise), commissionPercent, peakSlots[{daysOfWeek, startTime, endTime}], isActive}`; `400` on invalid values or overlapping windows |
| `GET` | `/api/sessions/me?status=upcoming\|in_progress\|completed\|all` | Trainer | `{sessions, serverNow}` for the trainer's own assigned sessions |
| `GET` | `/api/sessions/[id]` | Assigned trainer, owner customer or admin | `{session}` with timestamps and `serverNow`; customers only see the workout once it's completed; `404` for anyone else |
| `POST` | `/api/sessions/[id]/start` | Assigned trainer | `201` started, `200` already started (same `startedAt`); `409` if cancelled, unpaid or outside the start window |
| `POST` | `/api/sessions/[id]/complete` | Assigned trainer | `200` once `endsAt` has passed (idempotent); `409` before then or if not started |
| `PATCH` | `/api/sessions/[id]/record` | Assigned trainer | `{exercises[{name, sets?, reps?, notes?}], trainerNotes, suggestedNextWorkout}`; `409` if not started or locked |
| `GET` | `/api/admin/users` | Admin | |

The server always takes the customer from the session, sets the session length, assigns the trainer and sets the status. Any `customerId`, `status` or duration sent by the client is ignored, and so is any price, commission or total.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Auth, availability, booking, pricing, checkout and session tests (including concurrent requests and a controlled clock) against an in-memory MongoDB replica set |
| `bun run seed` | Seed demo data into `MONGODB_URI` |

## Project structure

```
app/          Pages, layouts and Route Handlers
components/   Shared UI (app shell, page header, empty state, shadcn/ui)
features/     Feature-specific UI (auth, booking, availability, checkout, pricing, sessions)
hooks/        Shared client hooks
lib/          Infrastructure and shared rules: database, session, auth, time, booking, zones
models/       Mongoose models
services/     Server-side application logic
validators/   Zod schemas shared by client and server
scripts/      Seed script
tests/        Bun tests
```

## Limitations

- There is no rate limiting or account lockout on login.
- Sessions are stateless JWTs, so logging out clears the cookie but cannot revoke a token copied elsewhere before it expires. Deactivating a user does block access immediately.
- There is no email verification or password reset.
- Payments are simulated. There is no real gateway, refunds or invoices, and an unpaid booking still holds the trainer's slot.
- Sessions complete lazily, when they are next read. Without a scheduler, an unopened session stays `in_progress` in the database until it is next read, though every view already reports it as completed. Missed sessions are display-only, with no automatic cancellation or refund.
- The five-minute warning is in-app only; there are no push or SMS notifications yet.
- There is a single editable pricing rule; there is no pricing history beyond the snapshot stored on each payment.
- Re-running `bun run seed` resets the `Standard` pricing rule to the defaults.
- Customers can't cancel or reschedule yet, and there are no trainer accept or decline steps.
- A customer can book two overlapping sessions with different trainers; overlap is only blocked per trainer.
- There is a single platform time zone (IST) and a fixed list of synthetic service zones.
- The trainer lock serializes writes per trainer. That is fine at this scale; a very busy trainer would see more transaction retries.
