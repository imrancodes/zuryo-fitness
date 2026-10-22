# Testing

## Framework and configuration

- **Runner:** Bun's built-in test runner (`bun test`). Test files live in `tests/*.test.ts`.
- **Database:** `bunfig.toml` preloads `tests/setup.ts`, which starts a `MongoMemoryReplSet` (from `mongodb-memory-server`) and clears it between tests. It's a real replica set, so the transactions and unique indexes used in production are exercised. No external database is touched.
- **Time:** pure timer and progress helpers take an explicit `now` and are checked exactly. Session and booking tests create data relative to the real clock (for example, a booking that started 40 minutes ago).
- **AI:** the Gemini client is replaced with a mock, so tests never call the real API and never need a key.
- **Windows:** the in-memory MongoDB needs the [Visual C++ Redistributable](https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist).

There is no separate unit and integration split. Most tests call services and Route Handlers against the in-memory database, which makes them integration tests. Pure helpers such as pricing, timers and the AI safety rules are tested directly.

## Commands

| Command | What it does |
| --- | --- |
| `bun test` (or `bun run test`) | Run all tests |
| `bun test tests/booking.test.ts` | Run one file |
| `bun test -t "concurrent"` | Run only the tests whose name matches |
| `bun run typecheck` | TypeScript check (`tsc --noEmit`) |
| `bun run lint` | ESLint |

## Coverage of critical business rules

| Area | Covered by | What is checked |
| --- | --- | --- |
| Booking conflicts and simultaneous requests | `booking.test.ts` | Overlaps for the same trainer are rejected. Simultaneous requests can't double-book one trainer, auto-assignment uses each trainer at most once, and duplicate submissions return the same booking |
| Trainer assignment eligibility | `booking.test.ts`, `availability.test.ts` | Zone and full-window coverage, earliest-`_id` tie-break, a preferred trainer is never swapped, window edits can't strand a booking |
| Pricing and commission | `pricing.test.ts`, `checkout.test.ts` | ₹438.90 normal / ₹548.90 peak, commission rounded half-up to whole paise, peak windows in IST, no float parsing, overlapping windows rejected |
| Checkout and payment | `checkout.test.ts` | Client prices are ignored, quotes lock for 15 minutes, declines can be retried, simultaneous payment attempts charge exactly once |
| Authorization and roles | `authorization.test.ts`, `auth.test.ts`, and the access tests in each file | No session gives `401`; the wrong role is blocked; tampered tokens are rejected; the database role overrides a signed token's role claim; ownership checks on bookings, payments, profiles and sessions |
| Session timing and status | `session.test.ts`, `session-timer.test.ts` | Start window (15 minutes early to 30 minutes late), the server sets the 60-minute end, simultaneous starts keep one start time, no completion before the end, lazy completion, and every derived status, including missed |
| Idempotent package deductions | `packages.test.ts` | One credit per completed session, retries and simultaneous completions deduct once, the last credit can't be over-used, the balance never goes negative |
| AI validation and fallback | `ai-recommendation.test.ts`, `ai-prompt.test.ts` | Schema and safety checks, every fallback reason, rate-limit cooldown, caching, 3 regenerations a day even under simultaneous requests, and no personal data in the prompt |
| Admin bookings | `admin-bookings.test.ts` | Admin-only access, filters, IST date boundaries, search, pagination, deleted users, 404s |

Other files: `fitness-profile`, `fitness-progress`, `history`, `redirect` and `health`.

## Latest results

Run on **2026-10-22** with `bun test`:

```
179 pass
0 fail
514 expect() calls
Ran 179 tests across 17 files. [30.90s]
```

`bun run typecheck` and `bun run lint` also ran with no errors on the same day. The output includes Mongoose deprecation warnings about the `new` option on `findOneAndUpdate`. They are warnings only, not failures.

## Known gaps

- **No browser or end-to-end tests:** UI flows such as booking, checkout and the timer screen are only checked by hand.
- **No load tests:** concurrency is tested with a few parallel requests, not sustained traffic.
- **No tests for the seed scripts.** They were checked by hand against an in-memory database.
- **The real Gemini API isn't tested:** only the mock is, so real latency and output quality aren't covered.
- **No multi-instance tests** for the in-memory AI de-duplication.
- **Not tested because not implemented:** cancellation, refunds, notifications, GPS and login rate limiting.
