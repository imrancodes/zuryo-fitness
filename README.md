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
| `GEMINI_API_KEY` | No | Google AI Studio API key for AI workout plans. Server-only, never exposed to the browser. Without it the app uses rule-based suggestions |
| `GEMINI_MODEL` | No | Gemini model ID. Defaults to `gemini-3.5-flash-lite` |

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

| Command | What it deletes before seeding |
| --- | --- |
| `bun run seed` | Only demo data: the `@zuryo.dev` accounts' bookings, payments, sessions, credits, profiles and availability. Other users and their data are kept, and any of their bookings with old zone names are renamed. |
| `bun run seed:reset` | **Every document in every Zuryo collection**, including real users. Use it for a clean demo database; it can't be undone. |

Both create the same demo data. All names and data are synthetic. The password is `DEMO_PASSWORD`, or `ZuryoDemo123!` if unset.

| Role | Email | Details |
| --- | --- | --- |
| Admin | `admin@zuryo.dev` | |
| Customer (demo) | `customer@zuryo.dev` | Aarav Mehta: intermediate profile with 3 dated assessments (weight 78.2 → 76.4 kg), 10-session package with 4 used |
| Customer | `neha.customer@zuryo.dev` | Neha Kapoor: beginner profile, 2-session package granted by the admin, **exhausted** |
| Customer | `arjun.customer@zuryo.dev` | Arjun Malhotra: advanced profile, no package (completions are recorded as `no_package`) |
| Customer | `sana.customer@zuryo.dev` | Sana Sheikh: **no fitness profile**, to show the "complete your assessment" state |
| Trainer (demo) | `trainer@zuryo.dev` | Priya Nair: Mumbai / Thane |
| Trainer | `rohan.trainer@zuryo.dev` | Rohan Das: Thane / Navi Mumbai |
| Trainer | `meera.trainer@zuryo.dev` | Meera Iyer: Delhi / Mumbai |
| Trainer | `kabir.trainer@zuryo.dev` | Kabir Singh: Bengaluru / Navi Mumbai |
| Trainer | `ananya.trainer@zuryo.dev` | Ananya Rao: Bengaluru / Delhi |
| Trainer | `vikram.trainer@zuryo.dev` | Vikram Joshi: Navi Mumbai / Thane |

Each trainer gets availability for today and the next 7 days: 06:00–13:00 IST in their first zone and 14:00–21:00 IST in their second.

The seed creates **25 bookings** across all five cities, dated relative to the day you run it (scenarios live in `scripts/seed-data.ts`):
- **9 completed**, each with a paid payment, a workout record and a package deduction; 4 have customer feedback. Two of them were booked as instant sessions.
- **2 cancelled** (one unpaid, one after a failed payment) and **2 missed** (one paid, one unpaid).
- **12 upcoming**, inside each trainer's availability windows: 8 paid (including two for Priya tomorrow), 2 unpaid, 1 with an expired checkout attempt and 1 with a failed payment.

Sessions in progress and open checkouts aren't seeded, because they expire within minutes. To try them live, start one of Priya's paid sessions during its start window.

The seed also sets up the `Standard` pricing rule with the default prices and peak hours (see [Pricing and checkout](#pricing-and-checkout)). It checks every scenario before writing anything. Seeding:

- can be re-run without creating duplicates
- refuses to run when `NODE_ENV=production`
- prints the target database name before writing

## Authentication

- Credentials are stored as bcrypt hashes. `passwordHash` is excluded from queries by default and never returned by the API.
- A session is a JWT signed with `SESSION_SECRET` (HS256, 7 days) in an `HttpOnly`, `SameSite=Lax` cookie that is `Secure` in production.
- `proxy.ts` does a fast signature check to redirect early. Every page and API then validates the session on the server and reloads the user from the database, so a changed role or deactivated account takes effect immediately.
- Public registration only allows `customer` or `trainer`. Admins are created by the seed script.
- Login errors are generic, and redirects after login are limited to the user's own area.
- Demo login is always available, including in production. It signs in as a seeded account and goes through the same server-side role checks. For a production database, seed the demo accounts by running `bun run seed` locally with `MONGODB_URI` set to that database.

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

Zones are a fixed list of Indian cities (`lib/zones.ts`): Mumbai, Thane, Navi Mumbai, Delhi and Bengaluru. All of them use IST. No GPS is used. Records saved with the earlier zone names (Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar) are renamed to Mumbai, Thane, Navi Mumbai, Delhi and Bengaluru respectively when `bun run seed` runs. Each availability window has exactly one zone, and a trainer only matches a booking request when one of their windows **in the requested zone** covers the whole 60-minute session.

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

## Customer profile, packages and history

### Fitness profile

Each customer has **one current profile**; a unique index on `customerId` enforces this. Only the signed-in customer can read or write it, and any `customerId` sent in the request is ignored.

| Field | Rules |
| --- | --- |
| `age` | Whole number, **16–90** |
| `weight` | Kilograms, **30–250**, at most one decimal |
| `fitnessGoals` | **1–3** of: lose weight, build muscle, improve endurance, increase flexibility, general fitness, sports performance |
| `experienceLevel` | `beginner`, `intermediate` or `advanced` |
| `workoutPreferences` | `{ workoutTypes: strength · cardio · hiit · yoga · mobility · boxing, preferredTimes: morning · afternoon · evening }` |

No medical or other sensitive information is collected. **Every save also appends a `FitnessAssessment`**, an append-only history written in the same transaction, so weight trends come from real dated records. The profile is always the latest assessment.

**Existing records.** `FitnessProfile` existed before this phase but was never written to. `workoutPreferences` changed from a list of strings to the structured object above, and the reader treats missing fields as empty lists. New fields on `Package` default to `source: "admin"` and `grantedBy: null`.

### Packages and session credits

- A package holds `totalSessions`, `usedSessions` and `remainingSessions` (non-negative integers), with `remainingSessions = totalSessions − usedSessions`.
- Lifecycle: `active` → `exhausted` when the balance reaches 0. `expired` and `cancelled` are reserved and not used yet.
- **How credits are created in this MVP:** the seed gives the demo customer a 10-session package, and admins grant packages at `/admin/packages`. Customers can't buy packages or change balances; there's no endpoint for it. Packages are **separate from per-session payments**: a customer still pays for each booking at checkout, and a successful payment does **not** create or use a credit. Linking packages to checkout is future work.

### Deduction rules

- A credit is used **only when a session completes**. That happens inside Phase 5's reconciliation transaction, at the single `in_progress → completed` transition. Creating a booking, paying, starting a session or cancelling never uses a credit.
- The oldest active package with a balance is used first, through a conditional update (`remainingSessions ≥ 1`), so a balance can never go below 0. When it reaches 0 the package becomes `exhausted`.
- Every completed session writes one `PackageDeduction` ledger row, with a **unique `bookingId`**, outcome `deducted` or `no_package`, and the package used. With no credits left, the session still completes and is recorded as `no_package`.
- **Atomic and idempotent:**
  - the completion, the package update and the ledger row commit together in one transaction, so a session can't end up completed with its deduction missing
  - retries and simultaneous completions of the same session transition only once, and the unique `bookingId` is a backstop
  - simultaneous completions of different bookings write the same package document, so MongoDB forces a retry and the retry sees the updated balance
- Sessions completed **before** this phase are not backfilled.

### Booking and workout history

- `/customer/bookings` filters by **Upcoming, In progress, Completed, Cancelled and All**. Missed sessions appear under All.
- Each row shows the date and time, trainer, zone, booking status, session status, payment status and the 60-minute duration. Cancelling and rescheduling aren't supported yet, and the page says so.
- `/customer/history` lists the customer's own completed sessions: exercises, duration, trainer notes and the suggested next workout. Customers can add or update a **1–5 rating and a comment**; this writes only `customerFeedback`, never the trainer's notes.
- Trainers see a customer's goals, experience and preferences (not age or weight), plus their own previous sessions with that customer, on the session page.

### Progress

`/customer/progress` uses only stored data:
- completed workouts in total and in the last 30 days
- sessions per week over the last 8 weeks
- active weeks (weeks with at least one session)
- credits remaining
- weight over time from saved assessments; a trend appears once there are two or more, otherwise it explains what's missing

Completing workouts shows consistency; it isn't presented as proof of changes in fitness or health.

### Workout suggestions (rules-based)

`services/recommendation.service.ts` loads **only the signed-in customer's** profile and last 5 completed sessions. The rules live in `lib/recommendations.ts` and are deterministic:

1. A session in the last 24 hours means **light mobility and recovery** comes first.
2. The trainer's latest **suggested next workout** is included.
3. The **first goal** chooses the focus: for example, build muscle leads to strength training, and lose weight leads to fat-burning conditioning. It uses a **preferred workout type** when one fits the goal.
4. **Experience caps the intensity**: beginner light (2–3 sets, technique first), intermediate moderate, advanced challenging but always "leave 1–2 reps in reserve". Nothing is ever maximal.
5. No sessions yet, or none in 14 days, means **easing back in** at a light intensity.
6. The same body area trained twice in a row means switching to another area. Otherwise the second goal adds another suggestion.

Each suggestion explains why it was chosen. Without a profile the API returns `needs_profile` and the UI asks the customer to complete the assessment. Suggestions carry a "not medical advice" disclaimer and never diagnose anything. These rules are also the **fallback** for the AI feature below.

## AI workout plans (Gemini)

### What is implemented

The customer overview's **Suggested for you** card shows a personalized workout plan generated by **Google Gemini**. It's based on the customer's fitness profile and recent completed sessions, and includes:
- a title, a summary and the goal
- why the plan was chosen
- 3–8 exercises with sets, reps or a duration, and notes
- the session length
- recovery advice, limitations and a safety disclaimer

It is clearly labelled **AI-generated**.

- **Provider and SDK:** Google Gemini API through the official `@google/genai` SDK, called **only from server code** (`services/ai/gemini.ts`). The key stays in `GEMINI_API_KEY` on the server and is never sent to the browser.
- **Model:** `gemini-3.5-flash-lite` by default, chosen for its free tier, low price and speed. It can be changed with `GEMINI_MODEL`. Google no longer serves `gemini-2.5-flash` and `gemini-2.5-flash-lite` to new API keys (they return 404), and `gemini-3.8-flash` thinks by default and regularly takes over a minute, which is past the 20-second timeout. Flash-Lite returns the plan without thinking tokens in about 3 seconds.
- **Request limits:** 20-second timeout, at most 1,500 output tokens, temperature 0.4, JSON-only response format with a response JSON schema.
- **Free tier:** Google's free tier has low request quotas, and Google may use free-tier prompts and responses to improve its products ([pricing page](https://ai.google.dev/gemini-api/docs/pricing)). So only the minimum is sent (below). Use a paid key for production data.

### Data sent to the model (`lib/ai/workout-prompt.ts`)

Only these fields are sent:
- **from the profile:** goals, experience level, and preferred workout types and times (as labels)
- **for up to 5 recent completed sessions:** how many days ago, up to 8 exercise names with sets and reps, and the trainer's suggested next workout (cut to 200 characters)

Never sent:
- names, emails or account or booking IDs
- age, weight, trainer notes or customer feedback
- other customers' data
- in-progress or cancelled sessions

### Prompt design

- The prompt is **versioned** (`PROMPT_VERSION = "workout-plan-v1"`), and the version is stored with each saved plan.
- A fixed **system instruction** holds the rules:
  - use only the supplied data and never invent personal details or progress
  - follow the first goal and experience level, with beginners capped at 4 sets per exercise
  - no maximal efforts, one-rep maxes, training to failure or training through pain
  - stay within volume limits: 3–8 exercises, at most 6 sets and 30 reps each, 30 sets in total, 15–75 minutes
  - no diagnoses, medication or guaranteed results
  - plain language, reasons tied to the supplied data, JSON only
- Customer data goes inside a `<customer_data>` block that the rules mark as **data, not instructions**. Angle brackets are removed from the text so it can't close the block early. Trainer suggestions are treated as untrusted text.
- **Limitations:** prompt injection can be reduced but not eliminated, which is why the output is validated again afterwards. The model only sees what's listed above, so it can't account for injuries or health conditions it doesn't know about.

### Output schema and safety checks

The response must match `validators/ai-recommendation.ts`, which is also sent to Gemini as the response JSON schema:

| Field | Limits |
| --- | --- |
| `title` / `goal` | up to 80 characters |
| `summary` | up to 400 characters |
| `reasoning` | 1–5 items, up to 200 characters each |
| `exercises` | 3–8 entries of `{name, sets 1–6?, reps 1–30?, durationSeconds 10–600?, notes ≤ 160}`; each needs sets, reps or a duration |
| `durationMinutes` | 15–75 |
| `recoveryAdvice` / `limitations` | up to 300 characters |

Valid JSON isn't trusted on its own. `lib/ai/safety.ts` also rejects:
- raw output over 8,000 characters
- total sets over 30
- a beginner plan with more than 4 sets per exercise
- unsafe phrases, such as a diagnosis, medication, pushing or training through pain, "no pain, no gain", one-rep max, training to failure, or guarantees and cures

A rejected plan is never saved or shown.

### Caching, regeneration and request control

- One saved plan per customer (`AiRecommendation`, unique `customerId`), with the model, prompt version and generation time.
- **Reuse:** a saved plan is reused while a hash of its inputs is unchanged (profile, completed sessions, model and prompt version) and it is less than **7 days** old. Updating the assessment or completing a session triggers a new plan on the next view.
- **When it's generated:** the card fetches `GET /api/recommendations/me` **after the page loads**. The page itself never calls Gemini while rendering, and the progress page uses the rules engine only.
- **Regenerate:** `POST /api/recommendations/me/regenerate`, limited to **3 per rolling 24 hours per customer**. The limit uses an atomic conditional update, so even simultaneous clicks can't exceed it; a fourth request gets `429` with the time to try again.
- **Cooldown:** after Gemini returns a rate-limit error (HTTP 429), the app doesn't call it again for that customer for 60 seconds and shows the fallback instead.
- **Duplicate requests:** simultaneous requests from one customer on the same server share a single Gemini call.
- **Trade-offs:** a plan can be up to 7 days old if nothing changes, and the duplicate-request guard only works within one server instance. A multi-instance deployment would need a database lease to fully prevent duplicate calls.

### Fallback behaviour

The rules engine (`lib/recommendations.ts`) is used, and the card shows a **Rules-based suggestions** badge with the reason, when:

| Reason | When |
| --- | --- |
| `not_configured` | no `GEMINI_API_KEY` |
| `rate_limited` | Gemini returned 429 (common on the free tier), including the 60-second cooldown |
| `timeout` | no response within 20 seconds |
| `provider_error` | any other provider failure |
| `invalid_output` | the response failed the schema or safety checks |

Customers without a profile get `needs_profile` and a prompt to complete the assessment, and no AI call is made. Provider errors and prompts are never returned to the browser; the server logs only the failure type and HTTP status.

### Cost

- **Free tier:** $0.
- **Paid tier, estimate** using Google's published `gemini-3.5-flash-lite` prices of **$0.30 per million input tokens** and **$2.50 per million output tokens** ([pricing page](https://ai.google.dev/gemini-api/docs/pricing), checked 2026-10-22):
  - input of about 1,500 tokens (system rules, schema and data) ≈ $0.00045
  - output of about 800 tokens ≈ $0.0020
  - **≈ $0.0025 per plan**, about ₹0.2
- Thanks to caching, a typical customer needs about 1–4 plans a week: one when their data changes, plus up to 3 regenerations a day at most. That's well under $0.01 per customer per week.
- Token counts are estimates from the prompt size. Real usage is in the Gemini API response's `usageMetadata`.

### Latency

- **Saved plans:** about as fast as any other API request, since it's a single database read.
- **New plans:** typically about **2–6 seconds** with 3.5 Flash-Lite. It depends on how many output tokens are generated, which model is chosen (thinking models are slower), Google's current load, and network distance.
- A request is cut off after 20 seconds and the fallback is shown. The card shows a loading state in the meantime.

### Future improvements (not implemented)

- Saving `usageMetadata` for real cost dashboards.
- A cross-instance lock for generation.
- Streaming partial plans.
- Letting trainers review AI plans before customers see them.
- A paid tier with Google's data-use terms for production.

## Admin bookings

`/admin/bookings` lists every booking from MongoDB, newest session first, 20 per page:
- **Columns:** booking ID, mode, customer and trainer (name and email), session date, time and zone in IST, booking status, session status, payment status, and the price, commission and total.
- **Amounts** are only stored on a booking once it's paid, so unpaid bookings show "—". Nothing is recalculated for display.
- **Filters:** booking status, payment status and session date (an IST day). They're plain query parameters, so a filtered view can be bookmarked or shared.
- **Search:** a full 24-character booking ID matches that booking. Any other text matches customer or trainer names (case-insensitive, partial).

Before listing, expired in-progress sessions are reconciled (the same lazy reconciliation every other read uses), so the stored "completed" status is accurate when filtering. The derived "Missed" session status isn't stored; those bookings appear under booking status "Confirmed", and the Session column shows "Missed".

`/admin/bookings/[id]` shows:
- the booking and its assignment (customer and trainer contacts, and when it was booked and assigned)
- the session lifecycle: status, start window, and the started, ends and completed times
- the paid price snapshot, and every checkout attempt (open, paid, failed or expired)

Workout notes, customer feedback and fitness profile data aren't shown.

The pages are **read-only**. Admins can't reassign, cancel, refund or change payments, because no business rules exist for those actions yet. Both pages and both APIs check the admin role on the server.

## API

All responses are JSON. Errors use the shape `{ "error": string, "fieldErrors"?: { [field]: string[] } }`, and internal errors return a generic `500`.

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Pings the database |
| `POST` | `/api/auth/register` | Public | `customer` or `trainer` only |
| `POST` | `/api/auth/login` | Public | |
| `POST` | `/api/auth/logout` | Public | |
| `POST` | `/api/auth/demo` | Public | `{role}`; signs in as the seeded demo account |
| `GET` | `/api/auth/me` | Signed in | |
| `GET` | `/api/availability?mode&serviceZone&date` | Customer | Open slots by trainer, plus all open times |
| `GET` | `/api/trainers?serviceZone&startTime` | Customer | Trainers eligible for one start time |
| `GET` | `/api/trainers/me/availability?date` | Trainer | Own windows for a day, with bookings inside them |
| `POST` | `/api/trainers/me/availability` | Trainer | `{date, startTime, endTime, serviceZone}`; `409` on overlap |
| `PATCH` | `/api/trainers/me/availability/[id]` | Trainer (owner) | `409` if a booking would no longer be covered |
| `DELETE` | `/api/trainers/me/availability/[id]` | Trainer (owner) | `409` if the window has bookings |
| `POST` | `/api/bookings` | Customer | `{mode, startTime, serviceZone, preferredTrainerId?, idempotencyKey}`; `201` new, `200` replay, `400` invalid time, `409` unavailable |
| `GET` | `/api/bookings/me?status=` | Customer | Own bookings, including `sessionStatus`; `status` is `upcoming`, `in_progress`, `completed`, `cancelled` or `all` |
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
| `PUT` | `/api/sessions/[id]/feedback` | Customer (owner) | `{rating 1–5, comment}`; `409` until the session is completed |
| `GET` | `/api/sessions/history/me` | Customer | Own completed sessions with workout, notes and feedback |
| `GET` | `/api/fitness-profile/me` | Customer | `{profile}` or `{profile: null}` |
| `PUT` | `/api/fitness-profile/me` | Customer | Saves the profile and appends an assessment; `400` with field errors |
| `GET` | `/api/packages/me` | Customer | `{packages, deductions}` |
| `GET` | `/api/packages/me/summary` | Customer | `{summary: {purchased, used, remaining, activePackages}}` |
| `GET` | `/api/progress/me` | Customer | Weekly counts, consistency, totals, weight history and credits |
| `GET` | `/api/recommendations/me` | Customer | `{status: "needs_profile", message}`; `{status: "ready", source: "ai", recommendation, generatedAt, model, cached, regenerationsLeft, disclaimer}`; or `{status: "ready", source: "rules", fallbackReason, suggestions, regenerationsLeft, disclaimer}`. Never accepts a customer ID |
| `POST` | `/api/recommendations/me/regenerate` | Customer | Forces a new AI plan; limited to 3 per rolling 24 hours (`429` after that) |
| `GET` | `/api/admin/packages` | Admin | Recent packages |
| `POST` | `/api/admin/packages` | Admin | `{email, sessions 1–50}`; `201`, `404` if the email doesn't belong to a customer |
| `GET` | `/api/admin/users` | Admin | |
| `GET` | `/api/admin/bookings?status&payment&date&q&page` | Admin | `{bookings, page, pageSize, total, totalPages}`; `status` is a booking status, `payment` a payment status, `date` an IST `YYYY-MM-DD`, `q` a booking ID or customer or trainer name; `400` on invalid filters |
| `GET` | `/api/admin/bookings/[id]` | Admin | `{booking, payments, session}`: contacts, amounts, every checkout attempt and session timestamps (no workout notes); `404` for an invalid or unknown ID |

The server always takes the customer from the session, sets the session length, assigns the trainer and sets the status. Any `customerId`, `status` or duration sent by the client is ignored, and so is any price, commission or total.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check |
| `bun run test` | All automated tests: auth, availability, booking, pricing, checkout, sessions, profiles, packages, history, progress and AI recommendations, including concurrent requests and a controlled clock, against an in-memory MongoDB replica set. Gemini is mocked, so tests never call the real API |
| `bun run seed` | Replace the demo data in `MONGODB_URI`, keeping other users |
| `bun run seed:reset` | Delete **everything** in `MONGODB_URI`, then seed demo data |

## Project structure

```
app/          Pages, layouts and Route Handlers
components/   Shared UI (app shell, page header, empty state, shadcn/ui)
features/     Feature-specific UI (auth, booking, availability, checkout, pricing, sessions, fitness, packages, progress, recommendations)
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
- Demo login is open in every environment, so anyone can sign in as the demo customer, trainer or admin without a password. Don't put real user data in a deployment that has demo login.
- Sessions are stateless JWTs, so logging out clears the cookie but cannot revoke a token copied elsewhere before it expires. Deactivating a user does block access immediately.
- There is no email verification or password reset.
- Payments are simulated. There is no real gateway, refunds or invoices, and an unpaid booking still holds the trainer's slot.
- Sessions complete lazily, when they are next read. Without a scheduler, an unopened session stays `in_progress` in the database until it is next read, though every view already reports it as completed. Missed sessions are display-only, with no automatic cancellation or refund.
- The five-minute warning is in-app only; there are no push or SMS notifications yet.
- Packages aren't linked to checkout yet: customers still pay per session, and credits are granted by an admin or the seed. Sessions completed before Phase 6 weren't backfilled into the ledger.
- Cancelling and rescheduling aren't supported; the bookings page says so.
- Admin bookings are read-only. Whether a trainer was auto-assigned or chosen by the customer isn't stored, so the details page can't show it. Name search uses a regex rather than a text index, and the payment-status filter has no dedicated index; both are fine at MVP scale.
- Progress is limited to completed sessions and self-reported weight. Suggestions (AI and rules-based) are general guidance, not medical advice.
- AI plans use the Gemini free tier by default: low quotas mean frequent rule-based fallbacks under load, and free-tier prompts may be used by Google to improve its products.
- There is a single editable pricing rule; there is no pricing history beyond the snapshot stored on each payment.
- Re-running `bun run seed` resets the `Standard` pricing rule to the defaults.
- Customers can't cancel or reschedule yet, and there are no trainer accept or decline steps.
- A customer can book two overlapping sessions with different trainers; overlap is only blocked per trainer.
- There is a single platform time zone (IST) and a fixed list of synthetic service zones.
- The trainer lock serializes writes per trainer. That is fine at this scale; a very busy trainer would see more transaction retries.
