# Learning notes

One entry per phase: what was built, what was chosen, what the alternative was. Longer per-phase
write-ups with focus areas and self-test Q&A live in [`LEARNING/`](../LEARNING/).

---

## Phase 0 — Repo skeleton (2026-07-30)

**Built.** npm workspaces monorepo: root `package.json`, `tsconfig.base.json`,
`eslint.config.mjs`, Prettier, `.editorconfig`, `.gitignore`, `.env.example`, `README.md`,
husky + commitlint hooks, the four top-level folders, and `packages/shared` exporting a single
`ping()` function.

**Chosen / rejected.**

- *npm workspaces* over Turborepo/Nx. Gave up build caching and dependency-ordered task graphs;
  at six packages neither is felt, and both can be added later without code changes.
- *`module: CommonJS`* over ESM. Express, Prisma, ts-node and Jest all work with zero
  configuration; ESM needs `type: "module"`, `.js` extensions in TS imports and a Jest transform
  workaround.
- *ESLint 10 flat config* over the `.eslintrc.cjs` the plan asked for. ESLint 8 is the last
  version supporting eslintrc, is EOL, and pulls in 9 high-severity advisories via
  `brace-expansion`/`minimatch` — which Phase 16's `npm audit` gate would fail on.
- *Stricter than `strict: true`* — also `noUncheckedIndexedAccess`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`. Cheap now, hundreds of errors if switched on at Phase 12.
- *Lint deliberately not type-aware.* Type-aware rules need a project reference per workspace and
  roughly triple lint time; `npm run typecheck` covers types instead.

**Learned.** npm symlinks `node_modules/@secure-notes/shared` → `packages/shared` and resolves
`main` → `dist/`, which is *why* shared must be compiled before anything importing it runs. And
`--workspaces --if-present` is the reason adding a service in Phase 5 needs no root file change.

Details: [`LEARNING/PHASE-0.md`](../LEARNING/PHASE-0.md)

---

## Phase 1 — Docs skeleton + decisions (2026-07-30)

**Built.** Four documents, written before the code they describe:
[`architecture.md`](architecture.md), [`technology-choices.md`](technology-choices.md),
[`api-contracts.md`](api-contracts.md), [`security-decisions.md`](security-decisions.md), plus
this file.

**Chosen / rejected.**

- *Contracts written before implementation.* `api-contracts.md` lists all ~45 endpoints as
  `planned` with request/response shapes now, and each flips to `built` as its phase ships. The
  alternative — generating docs from code afterwards — means the shape gets decided by whatever
  was convenient to write, and the frontend can't be designed against it in parallel.
- *Numbered, individually-titled security decisions (SD-1 … SD-12)* rather than a flat prose
  list. Each carries a status and an explicit cost, so a later phase can cite "SD-8" and so the
  gaps are as visible as the controls.
- *One error envelope and one pagination envelope, fixed now.* Every service returns
  `{ error: { code, message, details? } }` and `{ data, meta }`. Deciding this before the first
  handler exists is what makes `packages/shared` possible in Phase 3 — otherwise four services
  invent four shapes and the shared helpers can't exist.
- *404 instead of 403 for another user's resource*, recorded as a contract, not a convention. It
  needs to be written down or the first person to "fix the misleading status code" reintroduces
  ID enumeration.

**Learned.** Two things only came into focus by writing them out rather than coding them:

1. The header-trust model (SD-1) is *only* safe because of the NetworkPolicy. Writing it down
   turned `networkpolicy.yaml` from a Phase 14 checklist item into a load-bearing security
   control — if it's missing, two HTTP headers grant admin.
2. Sanitise-on-render (SD-8) has a cost that isn't obvious from the code: **every** future
   consumer must sanitise independently. An export-to-PDF job or an email digest added later
   becomes an XSS vector unless it's checked against that entry. That's a note the code can't
   carry.

Also: writing `technology-choices.md` forced admitting that a **modular monolith is the better
engineering answer** for an app this size. Six services is a curriculum choice, not an
architecture conclusion.

**Revision (same day).** Password hashing changed from Argon2id to **bcrypt via `bcryptjs`**
(SD-4, and Phase 5/6 in the plan). Driver: pure JS means no `node-gyp`, so the Phase 13 Docker
build stage needs no compiler and CI behaves identically everywhere. Accepted cost: bcrypt is
CPU-hard only, not memory-hard, and the pure-JS build is ~3× slower than native — so at a fixed
latency budget it affords a lower cost factor. This makes it the weakest of the four acceptable
password hashes. Two mitigations became mandatory as a result: **rehash-on-login** (or the cost
factor is frozen forever, since it can't be raised offline) and a **72-byte password cap**
(bcrypt silently truncates past it, so two long passwords can collide). New env var:
`BCRYPT_ROUNDS=12`. This is the first entry where a documented decision changed before any code
existed — which is the cheapest possible moment for it to happen, and the point of Phase 1.

Details: [`LEARNING/PHASE-1.md`](../LEARNING/PHASE-1.md)

---

## Phase 2 — Local infrastructure (2026-07-30)

**Built.** `infrastructure/docker/docker-compose.dev.yml` (postgres 17, redis 8, mailhog — named
volumes, healthchecks, loopback-bound ports), `postgres-init/01-create-databases.sql`, and a root
`docker-compose.yml` that owns the project name and `include`s the dev file. Started
[`troubleshooting.md`](troubleshooting.md) with the five failures actually hit.

**Chosen / rejected.**

- *Healthcheck queries `todo_db`* rather than `pg_isready`. During the init pass Postgres accepts
  connections **before** the init scripts have run, so `pg_isready` reports ready with zero
  application databases and anything using `condition: service_healthy` starts too early.
- *Ports bound to `127.0.0.1`* instead of Docker's default `0.0.0.0`, which bypasses the host
  firewall and would expose an unauthenticated Postgres and Redis to the local network.
- *`POSTGRES_DB: postgres`* so the entrypoint doesn't create a stray database named after the user;
  the three real databases come only from the init script.
- *`${VAR:-default}` everywhere* so a fresh clone runs with no `.env` at all — `.env` only overrides.
- *`troubleshooting.md` started now*, not in Phase 17 as planned. Reconstructing failures from
  memory fifteen phases later produces a worse file than writing them down while the error text is
  still on screen.

**Learned.** Three real bugs surfaced, none in application code — which is the argument for this
phase existing before Phase 5:

1. **A healthcheck that can't fail is decoration.** The `todo_db` check immediately caught a broken
   bind mount that `pg_isready` reported as healthy. Same lesson applies to `GET /health` in
   Phase 4.
2. **`include` + `project_directory: .` resolves *every* relative path from the repo root**, not
   from the included file. So `./postgres-init` pointed at `<repo>/postgres-init` — and Docker
   Desktop **auto-creates a missing bind-mount source instead of erroring**, so the only symptom
   was a database with no databases. `docker compose config` shows resolved paths and would have
   caught it in seconds.
3. **Init scripts run only on an empty data directory.** Worse: kill the container between `initdb`
   finishing and the scripts running, and you get a valid-but-empty cluster the entrypoint skips
   initialising forever. `down -v` is the only fix.

Also: SMTP was smoke-tested end-to-end now rather than in Phase 4, so the transport is known good
before any code could be blamed for it.

**Environment note.** Port 5432 on this machine is owned by a native PostgreSQL install; the stack
was verified on `POSTGRES_PORT=5433`. Changing it requires editing all three `*_DATABASE_URL`
values too — they aren't derived from it.

Details: [`LEARNING/PHASE-2.md`](../LEARNING/PHASE-2.md)

---

## Phase 3 — Shared package (2026-07-30)

**Built.** `packages/shared` — `errors.ts` (`AppError` + `errorHandler`), `async.ts`,
`validate.ts`, `requireUser.ts` (+ `requireRole`), `logger.ts`, `pagination.ts`, `types.ts`, and a
package entry `index.ts`. 192 code lines against a ~200 budget. 19 tests for `pagination` and
`validate`. The `ping()` placeholder is gone and `verify:workspace` now asserts every export.

**Chosen / rejected.**

- *`validate()` writes to `req.valid`*, never back to `req[source]` — forced by an Express 5
  behaviour, below. One destination for all three sources means no per-source exception, and
  `req.body` stays raw for audit logging.
- *`req.valid` is `unknown`, not generic.* Threading a schema's inferred type through
  `RequestHandler` into `router.post()` is possible and is exactly the generic gymnastics section 0
  forbids. Cost: one `as RegisterInput` cast per handler, visible where the assumption is made.
- *Pagination clamps; validation rejects.* `?page=-3` is a stale link and page 1 is what was meant;
  a malformed body is ambiguous intent and guessing about credentials is worse than failing.
  `MAX_LIMIT=100` is the one clamp that's a control rather than a convenience.
- *Unknown errors return a fixed `INTERNAL` message.* Prisma text names tables and columns, driver
  errors can carry connection strings — echoing `err.message` is information disclosure.
- *`asyncHandler` kept although Express 5 handles async rejections natively* — explicit at the call
  site, and still needed for rejections inside nested callbacks.
- *Logger redacts by default* (`authorization`, `cookie`, `*.password`, `*.token`, `*.totpSecret`).
  Opt-out beats opt-in; log aggregators are softer targets than the database.

**Learned.** The design was changed by something only a probe would reveal: Express 5 made
`req.query` **getter-only**, and `@types/express` does not model the missing setter. So
`req.query = parsed` **type-checks and then throws at run time** — TypeScript's `strict` implies
`alwaysStrict`, and assigning to a getter-only property throws in strict mode. In sloppy-mode JS it
silently no-ops instead, which is the harder version to debug and how it usually ships unnoticed.
Either way it would have been a failure on every list endpoint in Phases 8–9. A test now pins the
behaviour so an Express upgrade reports the change.

The transferable lesson: **a clean `tsc` is not evidence about runtime.** For anything touching a
framework's request/response objects, write the two-minute probe, then pin the answer in a test.

Second: Express identifies error middleware by **function arity**. Dropping the unused `_next` from
`errorHandler` silently turns it into an ordinary handler that never sees an error — no warning,
and direct-call unit tests still pass.

Details: [`LEARNING/PHASE-3.md`](../LEARNING/PHASE-3.md)

---

## Phase 4 — Notification service (2026-08-02)

**Built.** `apps/notification-service` on 4004 — `index.ts`, `app.ts`, `config.ts`, `mailer.ts`,
`middleware/internalKey.ts`, and `modules/email/{routes,controller,service,schema}.ts` plus
`templates.ts` and `modules/health/health.routes.ts`. Four templates, `POST /internal/email`
guarded by `x-internal-key`, `GET /health`. Verified end to end against MailHog.

**Deviation from the plan's file shape.** The template lists a per-service `middleware/` folder
with `error.ts`/`async.ts`/`validate.ts`/`requireUser.ts`; those live in `packages/shared` as of
Phase 3, so `middleware/` holds only the service-specific `internalKey.ts`.

**Chosen / rejected.**

- *`202 Accepted`, not `200 OK`* — SMTP accepted the message for relay; delivery is not something
  this service can know. 200 would let callers build support flows on a false premise.
- *Discriminated union on `template`* over a loose `data` object plus a runtime registry. Gives
  per-template validation at the boundary **and** a `switch` the compiler proves is exhaustive —
  adding a template without handling it is a `tsc` failure, not a 3am 500.
- *`crypto.timingSafeEqual`* over `===` for the internal key. Byte-by-byte short-circuiting turns a
  32-char key from 256³² guesses into 32 × 256 over a low-latency internal network.
- *`/health` calls `transporter.verify()`* rather than returning a constant — Phase 2's lesson
  applied one layer up. Costs an SMTP connection per probe; correct at this scale, would not be if
  the check fanned out to several dependencies.
- *No `MailProvider` interface.* One implementation; a comment in `mailer.ts` marks where SES swaps
  in. An adapter for a single implementation is the abstraction this plan exists to avoid.
- *`config.ts` exits 1 on invalid env* with field-level errors, so a missing `SMTP_HOST` is a failed
  boot rather than a failed registration hours later.

**Learned.** `npm run build` **could not build a clean clone** — `--workspaces` runs in directory
order, so `apps/*` compiled before `packages/shared/dist` existed and every import failed with
`TS2307`. It passed locally only because a stale `dist/` from Phase 3 was masking it. This is
precisely the trade Phase 0 accepted and named: npm workspaces has no dependency-ordered task graph.
Fixed by sequencing explicitly — `npm run build -w packages && npm run build -w apps` (`-w <dir>`
selects every workspace beneath it). npm does exit non-zero on a failed workspace, so Phase 16's CI
would have caught it, but only after the phase that introduced it.

Second, unplanned and the best evidence in this phase: the compose stack happened to be down when
`/health` was first called. It returned `503 degraded`, then flipped to `200 ok` **on its own** once
MailHog came back — no restart. A hardcoded `{status:"ok"}` would have lied in both directions.

Third: the HTML-escaping test only proved anything once it used a `"` rather than `<script>` — an
unescaped quote inside `href="..."` closes the attribute early, which is the actual injection
vector in an email template.

Details: [`LEARNING/PHASE-4.md`](../LEARNING/PHASE-4.md)
