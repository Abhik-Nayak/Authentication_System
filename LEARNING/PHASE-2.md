# Phase 2 — Local infrastructure

Status: **done, 2026-07-30.** Postgres, Redis and MailHog run and are verified before any app
code exists.

---

## 1. Progress

### Created

| Path | Purpose |
|---|---|
| `infrastructure/docker/docker-compose.dev.yml` | postgres 17, redis 8, mailhog — named volumes, healthchecks, loopback-bound ports |
| `infrastructure/docker/postgres-init/01-create-databases.sql` | creates `auth_db`, `notes_db`, `todo_db` |
| `docker-compose.yml` (root) | sets the project name and `include`s the dev file, so `docker compose up -d` works from the root with no `-f` |
| `docs/troubleshooting.md` | the five failures actually hit in this phase, with fixes |

Also updated: `.env.example` (port-conflict note), `docs/technology-choices.md` (Mailpit as the
maintained MailHog alternative).

### Verified — all commands actually run

```
docker compose config --quiet             valid; services = postgres, redis, mailhog
docker compose up -d --wait               all three report (healthy)
psql -l                                   auth_db, notes_db, todo_db  ← the phase's gate
psql -d <each>  "select 1"                all three accept connections
redis-cli ping / set / get                PONG, round-trip ok
curl localhost:8025                       HTTP 200, MailHog UI loads   ← the phase's gate
raw SMTP → 127.0.0.1:1025                 250 queued; message visible via /api/v2/messages
psql from HOST via 127.0.0.1:5433         connects — apps can reach it without being in Docker
docker compose ps                         every port bound to 127.0.0.1, none on 0.0.0.0
docker compose restart                    3 databases still present; init ran exactly once
```

The SMTP send was worth doing now rather than in Phase 4 — it proves the transport before there's
any application code that could be blamed for a failure.

### Decisions

- **Ports bound to `127.0.0.1`, not `0.0.0.0`.** Docker's default publishes on every interface and
  bypasses the host firewall — an unauthenticated Postgres and Redis visible to the local network.
  One prefix per port removes that.
- **`POSTGRES_DB: postgres`.** Left unset, the entrypoint creates a database named after the user
  (`app`). Pinning it to `postgres` keeps the three real databases the only application databases.
- **Healthcheck queries `todo_db`, not `pg_isready`.** During the init pass Postgres is up and
  `pg_isready` answers *ready* — before `postgres-init/` has run. Querying a database that only
  exists after init is the only honest signal, and it caught a real failure in this phase (below).
- **Redis has no password locally.** It holds only OTPs, mfaTokens and rate counters — short-lived
  and regenerable. Production uses ElastiCache with auth and TLS.
- **One bridge network named `secure-notes`,** declared here so Phase 13 attaches the six app
  containers to the same network without redefining it.
- **`docs/troubleshooting.md` started now** rather than in Phase 17. Reconstructing five failures
  from memory fifteen phases later produces a worse file than writing them down while the error
  text is still on screen.

### Environment finding, not a code problem

Port **5432 on this machine is already owned by a native PostgreSQL server** (PID 8348, listening
on `0.0.0.0:5432`). It was not touched. Verification ran with `POSTGRES_PORT=5433`, and the stack
is currently up on that port. To make it permanent, put `POSTGRES_PORT=5433` in `.env` **and**
change the port in all three `*_DATABASE_URL` values — they are not derived from it.

---

## 2. Focus areas — what to learn here

### 2.1 Healthy ≠ ready, and a healthcheck that can't fail is decoration

This is the phase's most transferable lesson, and it was earned rather than theorised.

The obvious healthcheck is `pg_isready`. It is **wrong here**, because the Postgres entrypoint
starts a temporary server to run `initdb` and the init scripts — so there is a window where
`pg_isready` says *ready* and not one application database exists. A service depending on
`condition: service_healthy` would start, connect, and fail on a missing table.

Querying `todo_db` instead means the check can only pass after init finished. And it immediately
paid for itself: it caught a broken bind mount that `pg_isready` would have reported as perfectly
healthy.

The general rule: **a healthcheck should assert the thing consumers actually depend on**, not that
the process is alive. Apply it again to `GET /health` in Phase 4 — returning `{status:"ok"}`
unconditionally tells you nothing; checking that the DB and Redis handles work tells you something.

### 2.2 Compose path resolution — where `include` will bite you

`include` with `project_directory: .` changes the base directory for **every relative path in the
included file**, not just env files. So inside `infrastructure/docker/docker-compose.dev.yml`, a
volume written as `./postgres-init` resolves to `<repo>/postgres-init`.

What makes this genuinely dangerous is the failure mode: **Docker Desktop auto-creates a missing
bind-mount source directory instead of erroring.** No warning. Postgres starts, reports healthy on
a naive check, and has no databases. The only clue is one line in the log:

```
/usr/local/bin/docker-entrypoint.sh: ignoring /docker-entrypoint-initdb.d/*
```

`ignoring` followed by a literal `*` means the glob matched nothing. Learn to read that.

Habit worth forming: after writing any compose file, run `docker compose config` and read the
**resolved** paths. Interpolation and path resolution both happen there, and it is much faster
than debugging a running container.

### 2.3 Volume lifecycle — why your SQL edits do nothing

`/docker-entrypoint-initdb.d/*` runs **only when the data directory is empty.** This is not a
Postgres-image quirk; it is how nearly every database image works (MySQL, Mongo, the same).
Consequences:

- Editing `01-create-databases.sql` after the first run changes nothing until `down -v`.
- `docker compose restart` and `down` (without `-v`) both **preserve** the volume. Only `-v`
  destroys it.
- Real schema changes are therefore **migrations**, not init scripts. The init script's only job is
  creating empty databases; everything after that is Prisma's problem from Phase 5.

The nasty edge case, which happened here: kill the container *between* `initdb` completing and the
init scripts running, and you get a valid-but-empty cluster that the entrypoint will skip
initialising forever. Recognise it from `database system was shut down at ...` on a first boot
where you expected `initdb ... Success`.

### 2.4 Publishing a port is a security decision

`- '5432:5432'` binds `0.0.0.0` — every interface, and it **bypasses the Windows firewall** because
Docker inserts its own rules. On a café network that is an unauthenticated Postgres open to
strangers. `- '127.0.0.1:5432:5432'` is the same functionality with none of that.

Same reasoning that governs SD-1: reachability *is* the security boundary. Phase 13 extends it —
only `web` and `api-gateway` publish anything at all.

### 2.5 Infrastructure before application code

Phase 2 exists before any service so that when Phase 5's auth-service fails to connect, you
already know the database is fine. Every hour spent here is an hour of ambiguity removed from
later debugging — that's the entire argument, and the three real bugs found in this phase (none of
which involved application code) are the evidence.

### Not worth your time

Tuning `shared_buffers`, adding a Postgres exporter, or configuring Redis persistence properly.
This is a dev environment; losing it costs one `docker compose up`.

### Highest-leverage exercise

```bash
docker compose down -v && docker compose up -d --wait
docker compose exec postgres psql -U app -l
```

Then deliberately break it: change the init mount path to `./postgres-init`, `down -v`, `up`, and
watch the stack come up **healthy-looking with zero databases**. Find it from the logs alone. That
is the debugging loop you'll need in Phases 13–14, learned somewhere cheap.

---

## 3. Why this is good infrastructure

1. **One command, from a fresh clone, with no `.env`.** Every variable has a `${VAR:-default}`
   fallback, so `docker compose up -d` works immediately and `.env` only *overrides*.
2. **`--wait` makes readiness machine-checkable.** Because the healthchecks are honest, CI can
   block on `up -d --wait` instead of a `sleep 30` that is simultaneously too long and too short.
3. **Infrastructure and application definitions are separate files.** Phase 13 adds six app
   services without touching the file that defines Postgres, and both compose files stay readable.
4. **Nothing is exposed beyond loopback**, so the dev environment can't be reached from the
   network.
5. **Reproducible by destruction.** `down -v` returns you to a guaranteed-clean state, which is
   what makes the init script trustworthy — it always runs against an empty cluster or not at all.
6. **Named volumes, not bind-mounted data dirs.** No permission problems across
   Windows/macOS/Linux, and no chance of committing a data directory.
7. **The network is declared here and reused later**, so service-to-service DNS in Phase 13 needs
   no new plumbing.

Honest caveats: no resource limits (a runaway query can eat the host), Redis has no password, and
`restart: unless-stopped` will bring these back on every Docker start until you `down`. All fine
for dev, none of it fine for anything else.

---

## 4. Five Q&A (self-test)

**Q1. Postgres reports `(healthy)` and your service still fails with "relation does not exist" on
startup. Explain how both can be true, and what the healthcheck should have asserted.**

The entrypoint starts a temporary server to run `initdb` and then `/docker-entrypoint-initdb.d/*`.
During that window the process is accepting connections, so `pg_isready` returns success while
zero application databases exist. `condition: service_healthy` is satisfied and the dependent
service starts too early. The check must assert what consumers depend on — here,
`psql -d todo_db -c "SELECT 1"`, which cannot succeed until init has finished. Generalise it: a
healthcheck that only proves the process is running is decoration.

**Q2. You add a table to `01-create-databases.sql`, run `docker compose restart`, and nothing
changed. Why, and what are the two ways to make it apply?**

Init scripts run only when the data directory is empty. `restart` and plain `down` both preserve
the named volume, so the entrypoint sees an initialised cluster and skips init entirely. Either
destroy the volume (`docker compose down -v && docker compose up -d`) or apply the change as a
**migration** against the running database — which is the correct answer for anything beyond
"create empty database", and is what Prisma does from Phase 5 on.

**Q3. The included compose file uses `./postgres-init`. Why did that produce a Postgres with no
databases rather than an error, and how would you have caught it in ten seconds?**

`include` with `project_directory: .` resolves relative paths from the repo root, so the path
became `<repo>/postgres-init`, which doesn't exist — and Docker Desktop **creates a missing
bind-mount source directory rather than failing**. The container therefore mounts an empty
directory, the glob matches nothing, and the log says `ignoring /docker-entrypoint-initdb.d/*`
with a literal asterisk. Ten-second catch: `docker compose config | grep -A2 postgres-init` shows
the resolved host path before you ever start a container.

**Q4. What is the practical difference between `- '5432:5432'` and `- '127.0.0.1:5432:5432'`, and
which security decision does it mirror?**

The first binds all interfaces and Docker's own firewall rules mean it is reachable from the local
network regardless of the Windows firewall — an unauthenticated Postgres and Redis exposed to
anyone on the same Wi-Fi. The second binds loopback only, same functionality, no exposure. It
mirrors SD-1: **reachability is the security boundary.** Phase 13 applies the same rule at the
application layer — only ports 3000 and 4000 publish at all.

**Q5. Why build infrastructure in Phase 2, before any service exists, instead of adding Postgres
when auth-service needs it in Phase 5?**

So that a Phase 5 connection failure has exactly one possible cause. Bringing up a database at the
same time as the first code that uses it means every error has two candidate explanations, and
you debug both. The evidence from this phase: three real bugs surfaced here — a port conflict, a
silently mis-resolved bind mount, and a partially initialised volume — **none of which involved
application code.** Meeting them in Phase 5 would have looked like a broken Prisma configuration.

---

## 5. Next

Phase 3 — `packages/shared`: `errors.ts` (`AppError` + `errorHandler`), `async.ts`
(`asyncHandler`), `validate.ts` (zod middleware returning 422 with field errors),
`requireUser.ts` (reads `x-user-id`/`x-user-role`, plus `requireRole`), `logger.ts` (pino with
request id), `pagination.ts`, `types.ts`. Under ~200 lines total, and it replaces the `ping()`
placeholder. Verified by unit tests for `pagination` and `validate`.
