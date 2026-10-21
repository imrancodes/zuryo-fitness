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

Trainer names, specialties and zones are synthetic. Each trainer gets availability for today and the next 7 days: 06:00–13:00 IST in their first zone and 14:00–21:00 IST in their second. Re-seeding replaces those windows; existing bookings are kept. The seed also upserts a `Standard` pricing rule. The password is `DEMO_PASSWORD`, or `ZuryoDemo123!` if unset. Seeding:

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
| `GET` | `/api/bookings/me` | Customer | Own bookings |
| `GET` | `/api/bookings/[id]` | Owner, assigned trainer or admin | `404` for anyone else |
| `GET` | `/api/admin/users` | Admin | |

The server always takes the customer from the session, sets the session length, assigns the trainer and sets the status. Any `customerId`, `status` or duration sent by the client is ignored.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Auth, availability and booking tests (including concurrent requests) against an in-memory MongoDB replica set |
| `bun run seed` | Seed demo data into `MONGODB_URI` |

## Project structure

```
app/          Pages, layouts and Route Handlers
components/   Shared UI (app shell, page header, empty state, shadcn/ui)
features/     Feature-specific UI (auth, booking, availability)
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
- Bookings are confirmed without payment. Prices stay empty until pricing and checkout arrive in Phase 4.
- Customers can't cancel or reschedule yet, and there are no trainer accept or decline steps.
- A customer can book two overlapping sessions with different trainers; overlap is only blocked per trainer.
- There is a single platform time zone (IST) and a fixed list of synthetic service zones.
- The trainer lock serializes writes per trainer. That is fine at this scale; a very busy trainer would see more transaction retries.
