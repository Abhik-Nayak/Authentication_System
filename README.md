# Secure Notes & To-Do

A learning-oriented, production-shaped full-stack app: Next.js frontend, an API gateway, and
four Express + TypeScript microservices behind it (auth with 2FA, notes, todos, notifications),
on PostgreSQL + Redis.

Build plan and rules: [LEARNING/PLAN.md](LEARNING/PLAN.md). Progress lives in its section 5
tracker. Per-phase notes — what was built, what to focus on, self-test Q&A — live alongside it,
starting with [LEARNING/PHASE-0.md](LEARNING/PHASE-0.md).

## Status

Phases 0–4 complete. One service exists: **notification-service** on 4004.

```bash
docker compose up -d --wait                        # infra
npm run build
npm run dev -w @secure-notes/notification-service  # or: npm start -w ...

curl localhost:4004/health
curl -X POST localhost:4004/internal/email \
  -H "x-internal-key: $INTERNAL_API_KEY" -H 'content-type: application/json' \
  -d '{"to":"you@example.com","template":"otpCode","data":{"code":"482913"}}'
# -> 202, then open http://localhost:8025
```

## Local infrastructure

```bash
cp .env.example .env          # optional — every var has a working default
docker compose up -d --wait   # postgres + redis + mailhog, waits for healthy
```

| | |
|---|---|
| Postgres | `localhost:5432` — databases `auth_db`, `notes_db`, `todo_db` |
| Redis | `localhost:6379` |
| MailHog SMTP | `localhost:1025` |
| MailHog inbox | http://localhost:8025 |

All ports bind to `127.0.0.1` only. `docker compose down` stops it; `down -v` also destroys the
data and forces the database-creation script to re-run.

If port 5432 is already taken by a local Postgres install, see
[docs/troubleshooting.md](docs/troubleshooting.md).

## Docs

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How it fits together — diagram, services, data ownership |
| [docs/technology-choices.md](docs/technology-choices.md) | Every choice, why, and what was rejected |
| [docs/api-contracts.md](docs/api-contracts.md) | Every endpoint, request/response shapes, status codes |
| [docs/security-decisions.md](docs/security-decisions.md) | SD-1 … SD-12 with threats, costs and accepted risks |
| [docs/learning-notes.md](docs/learning-notes.md) | One entry per phase |

## Layout

```
apps/            services + web UI      (Phase 4 onward)
packages/shared  the few shared helpers (Phase 3)
infrastructure/  docker, kubernetes, scripts
docs/            architecture, decisions, learning notes
LEARNING/        build plan + per-phase learning notes
```

## Quickstart

```bash
npm install
npm run lint
npm run build
```

## Root scripts

| Script | What it does |
|---|---|
| `npm run dev` | `dev` in every workspace that has one |
| `npm run build` | `build` in every workspace that has one |
| `npm test` | `test` in every workspace that has one |
| `npm run lint` | ESLint over all `.ts` / `.tsx` |
| `npm run format` | Prettier write |
| `npm run typecheck` | `tsc --noEmit` per workspace |
| `npm run verify:workspace` | Resolves `@secure-notes/shared` — proves workspace linking (run after `build`) |

## Conventions

- npm workspaces. No Turborepo, no Nx.
- Plain exported `async function`s. No classes, no DI, no repository pattern.
- Max ~150 lines per file; split by feature, not by layer.
- Conventional commits, enforced by commitlint. `pre-commit` runs lint.
- Every new env var goes into `.env.example` in the same commit.
- Validated input is read from **`req.valid`**, never `req.body`/`req.query` — `validate()` puts
  the parsed value there for all three sources. `req.query` is getter-only in Express 5.
- Errors: `throw new AppError(status, message, code)`. One `errorHandler`, mounted last.
