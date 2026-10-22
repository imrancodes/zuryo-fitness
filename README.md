# Zuryo

Zuryo is an MVP for booking personal fitness trainers on demand. Customers book an instant or scheduled 60-minute session in their city, pay through a simulated checkout, and track their workouts and progress. Trainers publish availability and run sessions with a server-timed countdown. Admins manage pricing and session packages and review every booking.

## Key features

- **Booking:** instant (within the hour) or scheduled (up to 30 days) sessions in five service zones. Trainers are assigned automatically or chosen by the customer, and double bookings are blocked even under simultaneous requests.
- **Pricing and checkout:** normal and peak prices in IST plus a 10% commission, all calculated on the server. Quotes are locked for 15 minutes, and payment is simulated (approve or decline).
- **Sessions:** trainers start sessions within a start window; the server sets the end time, which the timer counts down to. Trainers then record workouts, and customers leave a rating.
- **Customer profile:** fitness assessments, progress charts, workout history, package credits deducted when a session completes, and AI workout plans (Gemini) with a rules-based fallback.
- **Admin:** pricing and peak-hour settings, package grants, and a read-only bookings list with filters, search and a details page.
- **Roles:** customer, trainer and admin areas, each protected on the server.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js Route Handlers, with service modules in TypeScript |
| Database | MongoDB Atlas through Mongoose 9, using transactions on a replica set |
| Validation | Zod 4, shared by forms and APIs |
| Auth | Signed JWT (`jose`) in an httpOnly cookie, passwords hashed with `bcryptjs` |
| AI | Google Gemini (`@google/genai`), default model `gemini-3.5-flash-lite` |
| Testing | `bun test` with `mongodb-memory-server` |
| Runtime / hosting | Bun, Vercel |

## Live demo

- App: https://zuryo-fitness.vercel.app
- Repository: https://github.com/imrancodes/zuryo-fitness

## Demo access

1. Open https://zuryo-fitness.vercel.app/demo, or click **Open demo access** on the sign-in page.
2. Choose **Customer**, **Trainer** or **Admin**. You're signed in to that seeded demo account straight away, with no password.

All demo data is made up. It comes from `bun run seed`, and booking dates are relative to the day the seed was last run.

**As the customer (Aarav Mehta):**
- Book a session: pick instant or scheduled, a city and a time.
- Go through checkout and approve or decline the simulated payment.
- Look around **Bookings**, **History** (past workouts and ratings) and **Progress** (weight trend and weekly sessions).
- **Packages** shows 6 of 10 credits left. The overview page shows an AI workout plan.

**As the trainer (Priya Nair):**
- **Sessions:** two paid sessions tomorrow, plus past sessions with workout notes. You can only start a session from 15 minutes before its start time until 30 minutes after.
- **Availability:** add or edit time windows and see bookings sitting inside them.

**As the admin:**
- **Bookings:** every booking in the system. Filter by status, payment or date, search by name, and open one for full details.
- **Pricing:** change prices, commission and peak hours.
- **Packages:** give a customer session credits by email.

## Local setup

1. Clone the repository:
   ```bash
   git clone https://github.com/imrancodes/zuryo-fitness.git
   cd zuryo-fitness
   ```
2. Install dependencies with [Bun](https://bun.sh) 1.4+ (the repo uses `bun.lock`):
   ```bash
   bun install
   ```
3. Copy `.env.example` to `.env.local` and fill in:
   - `MONGODB_URI`, a MongoDB connection string that includes the database name. It must point to a replica set; Atlas clusters already are one.
   - `SESSION_SECRET`, at least 32 random characters. Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
     ```
   - `GEMINI_API_KEY`. Without it, the app shows rules-based workout suggestions instead of AI plans.
4. Seed the demo data and start the app:
   ```bash
   bun run seed
   bun run dev
   ```
   Then open http://localhost:3000/demo. To check the database connection, open http://localhost:3000/api/health.

`bun run seed:reset` deletes **everything** in the database before seeding. Only use it on a database you don't mind wiping.

## Deployment

The live app runs on Vercel with MongoDB Atlas. To deploy your own copy:

1. Import the GitHub repo into Vercel. It picks up Next.js on its own, and installs with Bun because of `bun.lock`.
2. Under **Settings → Environment Variables**, add `MONGODB_URI` and `SESSION_SECRET`. `GEMINI_API_KEY` is optional.
3. In Atlas **Network Access**, allow Vercel to connect. Vercel has no fixed IP addresses, so this usually means allowing `0.0.0.0/0` and protecting the database with a strong user password.
4. Seed the production database once from your machine by running `bun run seed` with `MONGODB_URI` pointing at it. The seed refuses to run when `NODE_ENV=production`, so run it from a normal shell.
5. Deploy, then open `/api/health`. It should return `{"status":"ok","database":"connected"}`.

## Testing

```bash
bun test
```

Tests run against an in-memory MongoDB, so they never touch your database. On Windows, that in-memory database needs the [Visual C++ Redistributable](https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist). See [docs/testing.md](docs/testing.md) for coverage and results.

## Documentation

- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [Feature status](docs/feature-status.md)
- [Cost and scaling](docs/cost-and-scaling.md)
- [Next steps](docs/next-steps.md)

## Known limitations

- **Payments are simulated.** There's no gateway or refunds, and an unpaid booking keeps holding its trainer slot.
- **No cancel or reschedule,** and no trainer accept or decline step.
- **Notifications are in-app only:** a five-minute warning on the session timer.
- **Session status catches up lazily.** Sessions are completed when they're next read, and missed sessions are only labelled as missed; nothing runs in the background to handle them.
- **Package credits aren't used at checkout.** Customers still pay per session; credits are granted by an admin.
- **Admin bookings are read-only.**
- **Demo login is open to anyone.** There is also no rate limiting on login, no email verification and no password reset.
- **Fixed zones and time zone.** There's a single time zone (IST), a fixed list of service zones, and no GPS.
