# Savelife CSM

E-commerce · Membership · Affiliate · Investment

## Phase 0 — Foundation (complete)

This repository contains the foundation: Next.js 16 App Router, TypeScript, Tailwind,
Prisma + PostgreSQL, Auth.js credentials with member/admin roles, English/Bangla locales,
light/dark themes, the app shell, skeleton components, money utilities, the initial
database migration, and auth-guarded member/admin panel shells.

The storefront is the homepage (`/en`, `/bn`). Company rules and risk disclosures live
inside the authenticated member panel at `/member/company-info`. Placeholder pages mark
the sections that will be implemented in later phases.

## Prerequisites

- Node.js 20+ (Node 22 recommended)
- Docker (for PostgreSQL) or an existing PostgreSQL 14+ database

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
# Docker Postgres is published on localhost:5433 so it does not clash with a local PostgreSQL service.
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

Open `http://localhost:3000/en` (or `/bn`).

**Seed admin:** `admin@savelife.test` / `Admin@123456`

> Change this password immediately after your first login in any non-local environment.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (money, rank, salary, wallet and investment rules) |
| `npx tsx prisma/qa-placement.ts` | Optional QA fixture after a clean reseed |
| `npx prisma migrate dev` | Create/apply a migration during development |
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

`My Network` has separate **Placement Network** and **Sponsor Network** views. Admins can
move a member's placement from the member detail page; the move is audit logged and does not
recalculate any rewards. Rank and placement-reward fields are intentionally placeholders.

### Destructive reset

Migration `0005_sponsor_placement_split` truncates all member-generated data (members,
wallets, orders, investments, rewards, ledgers and related audits) and keeps products,
categories and settings. Run `npx prisma migrate deploy` then `npm run db:seed` to recreate
only `SL000000` (admin) and `SL000001` (founder). The next registration receives `SL000002`.

For a reproducible QA chain, start from that clean state and run
`npx tsx prisma/qa-placement.ts`. It creates C=`SL000012`, F=`SL000016` and H=`SL000017`
where H's sponsor is C but H's placement parent is F. Remove QA data before production use.

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

## Deployment

`docker compose up -d --build` starts PostgreSQL and the app. Set `AUTH_SECRET`,
`POSTGRES_PASSWORD` and `AUTH_URL` in the environment before deploying. See `.env.example`
for the full list of variables.

On an always-on Node host, the automation checks due capital installments, due principal
notices and the latest weekly salary posting every five minutes after server startup. Only
one salary posting per Sunday boundary can ever be created. No admin batch button is needed.
The same idempotent passes can be triggered externally with
`POST /api/cron/investments` and `POST /api/cron/salary` when their respective secrets are
set; send the secret as a `Bearer` token or `x-cron-secret` header. `SALARY_AUTOMATION_SECRET`
falls back to `INVESTMENT_AUTOMATION_SECRET` when it is not set. The salary cron runs at
`0 18 * * 6` UTC, which is Sunday 00:00 Bangladesh time.
