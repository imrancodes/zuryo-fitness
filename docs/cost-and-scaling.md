# Cost and scaling

Prices below were taken from the official pricing pages on **2026-10-22** and are in USD. Prices change often, so recheck them before you rely on them. No real production traffic exists yet; the usage figures are **estimates** for illustration only.

## Current development and demo setup

| Service | Plan in use | Cost |
| --- | --- | --- |
| Hosting | Vercel (https://zuryo-fitness.vercel.app) | $0 on Hobby. The plan in use was **not verified** from the repo. Hobby is for personal, non-commercial use only |
| Database | MongoDB Atlas | $0 on M0 (512 MB, shared, no backups). The tier in use was **not verified** from the repo |
| AI | Gemini `gemini-3.5-flash-lite` | $0 on the free tier. Google may use free-tier data to improve its products, and the free tier has low quotas that aren't guaranteed |
| Other | None. There's no email, SMS, payment, queue or monitoring service | $0 |

## Estimated production setup

The smallest setup that's realistic for a commercial launch:

| Service | Plan | Published price |
| --- | --- | --- |
| Vercel Pro | 1 developer seat | $20/month, including $20 of usage credit (10M CDN requests, 1 TB transfer); usage beyond that is billed as you go |
| MongoDB Atlas Flex | Shared, 5 GB | from about $8/month at 0–100 operations a second, capped at $30/month |
| MongoDB Atlas M10 | Dedicated, 2 GB RAM, backups | from about $57/month, for when Flex is outgrown |
| Gemini, paid tier | `gemini-3.5-flash-lite` | $0.30 per 1M input tokens, $2.50 per 1M output tokens |

**Baseline:** about **$28–$50 a month** (Vercel Pro plus Atlas Flex), plus AI usage. Moving to M10 raises the baseline to about **$77 a month**.

### AI cost per interaction (estimate)

| Item | Assumption | Cost |
| --- | --- | --- |
| Input | about 1,500 tokens (rules, JSON schema, profile, up to 5 workouts) | about $0.00045 |
| Output | about 800 tokens (the code allows up to 1,500) | about $0.0020 |
| **Per new plan** | | **about $0.0025** |

The token counts are estimates from the prompt size; real counts would come from Gemini's `usageMetadata`, which isn't stored yet. Plans are cached until the customer's inputs change or 7 days pass, and regenerations are capped at 3 a day. So the worst case is about 4 calls per customer per day, which is about $0.01.

**Example scenario (an estimate, not real traffic):** 1,000 active customers, each needing 2 new plans a week, comes to about 8,700 plans a month. That's roughly **$22 a month** in AI cost.

## Potential future costs

- **Payment gateway:** a per-transaction fee (not priced here).
- **SMS or push notifications:** per message.
- **Error monitoring and log retention:** for example Sentry.
- **A queue or scheduler:** for background jobs.
- **Maps or location APIs:** for live ETA.
- **Higher Atlas tiers:** for more storage and backup retention.

## Cost drivers

1. **Database tier.** This is the biggest fixed cost once M0 or Flex is outgrown, and it's driven by storage, operations per second and backups.
2. **Serverless compute.** Every page render and API call is a function call, and bookings and payments use transactions, which take several round trips each.
3. **AI output tokens.** These cost about 8 times more than input tokens, so the size of each plan matters more than the size of the prompt.

## Scaling notes

- **Indexes:** the queries that run most already have indexes: trainer overlap, customer bookings, status and start time, availability by zone and date, and unique email. Admin name search uses a regex, and the payment-status filter has no index. That's fine for the MVP, but they need a text index or a compound index once there are many bookings.
- **Connection reuse:** `lib/mongodb.ts` caches the Mongoose connection on `globalThis`, so warm serverless instances reuse their pool. With many instances, keep an eye on Atlas connection limits.
- **Booking concurrency:** a per-trainer transaction lock keeps each trainer's bookings consistent. Contention only grows for a single very busy trainer. Bookings for different trainers don't block each other.
- **Caching:** AI plans are already cached in MongoDB. Pricing rules and trainer lists could be cached briefly, but bookings and payments must stay uncached.
- **Background jobs:** completion and missed sessions are currently handled lazily, when a session is read. A scheduler such as Vercel Cron, or a queue, would be needed for notifications, for releasing unpaid slots and for session reminders.
- **Monitoring and rate limiting:** neither exists yet. Add error tracking and uptime checks, rate limit login and AI routes (for example with Upstash Redis), and set Vercel spend alerts. Vercel scales functions automatically; the database tier has to be raised by hand.
