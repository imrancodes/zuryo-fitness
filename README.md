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

| Role | Email |
| --- | --- |
| Customer | `customer@zuryo.dev` |
| Trainer | `trainer@zuryo.dev` |
| Admin | `admin@zuryo.dev` |

It also creates six synthetic availability slots for the demo trainer and a `Standard` pricing rule. The password is `DEMO_PASSWORD`, or `ZuryoDemo123!` if unset. Seeding:

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

### API

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/health` | Public, pings the database |
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/logout` | Public |
| `POST` | `/api/auth/demo` | Demo mode only |
| `GET` | `/api/auth/me` | Signed in |
| `GET` | `/api/trainer/availability` | Trainer |
| `GET` | `/api/admin/users` | Admin |

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run start` | Serve the production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Auth and authorization tests against an in-memory MongoDB |
| `bun run seed` | Seed demo data into `MONGODB_URI` |

## Project structure

```
app/          Pages, layouts and Route Handlers
components/   Shared UI (app shell, page header, empty state, shadcn/ui)
features/     Feature-specific UI and hooks (auth)
lib/          Infrastructure: database, session, auth, roles, navigation
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
- Booking, pricing logic and payments are planned for later phases.
