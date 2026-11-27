# Savelife CSM

E-commerce · Membership · Affiliate · Investment

## Overview

Next.js 16 App Router + TypeScript + Tailwind, backed by PostgreSQL through Prisma.
Auth.js credentials login with member/admin roles, English/Bangla locales and
light/dark themes.

The storefront is the homepage (`/en`, `/bn`). Company rules and risk disclosures live
inside the authenticated member panel at `/member/program`. Money is stored as integer
paisa (`BigInt`) and every balance change is an append-only ledger entry.

## Prerequisites

- Node.js 20+ (Node 22 recommended)
- Docker (for PostgreSQL) or an existing PostgreSQL 14+ database

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
# Docker Postgres is published on localhost:5433 so it does not clash with a local PostgreSQL service.
npm run db:migrate
npx prisma generate
npm run db:seed
npm run dev
```

Open `http://localhost:3000/en` (or `/bn`).

**Seed admin:** `SL000000` / `Admin@123456` (login uses member ID only)

> These defaults are development-only. `npm run db:seed` with `NODE_ENV=production`
> refuses to run unless `SEED_ADMIN_PASSWORD` and `SEED_FOUNDER_PASSWORD` are set
> (minimum 12 characters). Rotate both immediately after the first production login.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (money, rank, salary, wallet and investment rules) |
| `npm run db:migrate` | Apply committed migrations (use this in production) |
| `npm run db:seed` | Seed admin, settings and sample store data |

## Structure

```
src/
  app/[locale]/        Storefront, login, member panel, admin panel
  api/auth/[...nextauth]  Auth.js route handler
  components/          UI, layout and providers
  i18n/                next-intl routing and locale config
  lib/                 Prisma client, money utilities, helpers
  generated/prisma/    Generated Prisma client (gitignored)
  auth.ts              Auth.js instance with credentials provider
  auth.config.ts       Edge-safe config shared with the proxy
  proxy.ts             Next.js 16 proxy: locale + optimistic auth redirects
messages/              en.json, bn.json
prisma/                schema.prisma, migrations, seed.ts
```

## Sponsor and placement relationships

Each member has two independent relationships:

- **Sponsor ID** is permanent. It owns direct referrals and is the only chain used for
  the three affiliate levels (3%, 1%, 0.5%). The materialised `Upline` rows mirror this
  sponsor chain. Missing sponsor levels are skipped and never backfilled.
- **Placement Parent ID + slot (1–3)** controls network position only. A parent can hold
  at most three direct placement children. Placement depth is unlimited. Placement never
  changes `sponsorId`, `Upline`, wallet balances or historical rewards.

Registration requires both IDs. The placement parent must be `ACTIVE` and must be the
sponsor or somewhere in the sponsor's placement downline. A slot is reserved in the same
transaction as registration; if another registration takes it first, the request fails with
`PLACEMENT_SLOT_TAKEN` and no automatic reassignment happens.

`My Network` lives at `/member/team`. Admins can move a member's placement from the
member detail page; the move is audit logged and never recalculates rewards.

### Fresh database

On a new database, migrations create the complete schema and drop the obsolete
`RegistrationDraft` table. Run `npm run db:migrate` then `npm run db:seed` to create only
`SL000000` (admin) and `SL000001` (founder). The next registration receives `SL000002`.

`prisma migrate reset` is destructive: it drops all data and replays every migration.
Use it only on development databases that contain no real member data.

## Money rules

- Amounts are displayed in **SP (Save Points)**, where 1 SP = 1 taka.
- Internally all amounts are integer **paisa** stored as `BigInt` (1 SP = 100 paisa).
- Wallet balances change only through append-only `LedgerEntry` records inside a DB transaction.
- Investment terms are snapshotted per investment; settings changes apply only to new investments.
- Profit distribution uses largest-remainder allocation so shares reconcile exactly, weighted
  by the capital still in each active investment.
- Installments return only the invested capital over the term; profit is a separate monthly
  share based on the remaining capital.
- Profit Only principal stays in the business. After the 12-month lock-in the member gives
  two months' notice; profit keeps accruing until the principal is released.

## Salary system

Eligible active investments allocate 9.5% of principal into eight independent rank
treasuries: R2 2%, R3 1.5%, R4 1.25%, R5 1.25%, R6 1%, R7 1%, R8 1% and R9 0.5%.
R1 has no salary treasury. Funding is append-only and idempotent per investment, so an
investment can never fund a rank twice. The salary wallet is separate from all other
reward wallets until **Collect All** moves it to Available Balance.

Each Sunday at 00:00 Bangladesh time (Saturday 18:00 UTC) every rank treasury is processed
together. Eligible members share their rank treasury equally; any share above the rank cap
is capped and the unused paisa stays in that same rank's treasury. Only `ACTIVE` members with
a salary rank entitlement are paid. Achieving a higher salary rank replaces the previous
entitlement and restarts the successful-week counter at Week 1. Failed postings are recorded
as `FAILED`, do not credit a wallet and do not count as a successful week. Re-running the
same week is always a no-op.

Members can review their salary rank, uncollected balance and full payment history at
`/member/salary`. Admins can review treasury allocations, payments, remaining balances and
weekly distributions at `/admin/salary`, and can trigger the current Sunday posting there.

## Deployment (Hostinger VPS2)

1. Install Docker and Git on the VPS, then clone this repository.
2. Create `.env` from `.env.example` and set a strong `POSTGRES_PASSWORD`, a freshly
   generated `AUTH_SECRET`, and the canonical public `AUTH_URL`/`APP_URL` (for example
   `https://your-domain.com`). Leave `AUTH_TRUST_HOST=false` unless a local proxy setup
   explicitly requires Host-header trust. The literal `.env.example` placeholder secret
   is rejected when `NODE_ENV=production`.
3. Run `docker compose up -d --build`. The app waits for PostgreSQL to become healthy,
   applies all committed migrations automatically, then starts the server.
4. Set `SEED_ADMIN_PASSWORD` and `SEED_FOUNDER_PASSWORD` in `.env`, then run
   `docker compose exec app npm run db:seed` once on the fresh database. Treat those
   values as one-time bootstrap secrets and rotate them (admin password via the admin
   UI, founder password at first login) immediately afterwards.
5. Put a TLS reverse proxy (Caddy/Nginx) in front of port 3000 and point the domain at it.

Uploads live in the named `uploads` volume and database files in `postgres_data`; back up
both volumes daily. The app also runs due investment and salary automation passes every
five minutes, so an always-on Node server is required.

### Security notes

- Login, admin re-auth and public registration uploads use injectable, in-memory
  rate limiters. They are an additional defense layer per process, not a shared
  cluster-wide quota; put a reverse-proxy/edge rate limit in front of multi-replica
  deployments. The limiters are keyed by hashed client/account identifiers and log
  hashed keys only.
- `ALLOW_DEV_SECRET=1` exists solely for an intentional local-only production build
  with a stand-in `AUTH_SECRET`; never set it on a deployed host.
- Non-public member APIs re-read role/status from PostgreSQL on each request via
  `requireActiveMemberApi()`, so a stale JWT cannot keep a suspended member authorized.
  Shared admin/member endpoints use its principal-level counterpart. Cart/checkout keep
  their explicit activation rules and money routes use transactional status checks.

GitHub Actions runs typecheck, lint, tests and the production build on every push to `main`.

On an always-on Node host, the automation checks due capital installments, due principal
notices and the latest weekly salary posting every five minutes after server startup. Only
one salary posting per Sunday boundary can ever be created. No admin batch button is needed.
The same idempotent passes can be triggered externally with
`POST /api/cron/investments` and `POST /api/cron/salary` when their respective secrets are
set; send the secret as a `Bearer` token or `x-cron-secret` header. `SALARY_AUTOMATION_SECRET`
falls back to `INVESTMENT_AUTOMATION_SECRET` when it is not set. The salary cron runs at
`0 18 * * 6` UTC, which is Sunday 00:00 Bangladesh time.
