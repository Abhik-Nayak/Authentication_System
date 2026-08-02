# Phase 3 — Shared package

Status: **done, 2026-07-30.** `packages/shared` holds the seven things worth sharing. 19 tests
pass. The `ping()` placeholder is gone.

---

## 1. Progress

### Created — `packages/shared/src/`

| File | Code lines | Exports |
|---|---|---|
| `errors.ts` | 32 | `AppError`, `errorHandler` |
| `async.ts` | 8 | `asyncHandler` |
| `validate.ts` | 20 | `validate(schema, source?)` |
| `requireUser.ts` | 30 | `requireUser`, `requireRole(...roles)` |
| `logger.ts` | 20 | `logger`, `requestLogger(requestId)` |
| `pagination.ts` | 27 | `parsePagination(query)`, `paginated(data, total, params)` |
| `types.ts` | 39 | `Role`, `AuthUser`, `FieldError`, `ErrorBody`, `Paginated`, `PaginationMeta`, `PaginationParams`, plus the `req.user` / `req.valid` declaration merge |
| `index.ts` | 16 | the package's public API |
| **total** | **192** | budget was ~200 |

Tests: `pagination.test.ts` (11), `validate.test.ts` (8). Deps added: `express` 5.2, `zod` 4.4,
`pino` 10.3; dev `jest` 30 + `ts-jest`.

### Verified

```
npm test                  19 passed, 2 suites
npm run lint              0 problems
npm run typecheck         clean
npm run build             clean; dist/ contains 8 modules, no *.test.js
npm run verify:workspace  shared-ok — all 9 runtime exports resolve through the symlink
```

`verify:workspace` now asserts every expected export exists rather than calling `ping()`.

### Decisions

- **`validate()` writes to `req.valid`, never back to `req[source]`.** Forced by a real Express 5
  behaviour, below.
- **`AppError` is a class** — the one sanctioned exception to the no-classes rule, because it must
  extend `Error` to carry a stack trace.
- **Unknown errors return a fixed `{ code: 'INTERNAL' }`** and log everything server-side. A leaked
  Prisma message discloses schema; a stack trace discloses file paths.
- **Pagination clamps, validation rejects.** Two different philosophies, deliberately — see Q3.
- **`logger` redacts by default** (`authorization`, `cookie`, `*.password`, `*.token`,
  `*.totpSecret`). Opt-out beats opt-in: a log aggregator is a softer target than the database.
- **`asyncHandler` is kept even though Express 5 handles async rejections natively** — it is
  explicit at the call site and still covers rejections raised inside nested callbacks.
- **`index.ts` is a package entry point, not a barrel maze.** Seven modules from one directory,
  so services import `@secure-notes/shared` instead of reaching into `dist/` paths.

### The bug this phase found

`validate()` was originally going to overwrite `req[source]` with the parsed value — the usual
pattern. A probe first suggested the write silently vanished; the test then proved something
worse and more precise:

```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

Express 5 made `req.query` **getter-only**. `@types/express` does not model the missing setter, so
`req.query = {...}` **type-checks and then throws at run time** — because TypeScript's `strict`
implies `alwaysStrict`, and assigning to a getter-only property throws in strict mode. In
sloppy-mode JavaScript it silently no-ops instead, which is how this normally ships unnoticed.

Either way it would have fired on every list endpoint in Phases 8 and 9. `validate.test.ts` pins
the behaviour, so if Express ever adds a setter the test fails and the design can be revisited.

---

## 2. Focus areas — what to learn here

### 2.1 The Express middleware contract

Four things that are not obvious and all bite:

1. **Error middleware is identified by arity.** `errorHandler` must take exactly four parameters.
   Delete the unused `_next` and Express silently treats it as an ordinary handler that never
   receives an error — no warning, errors just fall through to the default HTML page.
2. **`next(err)` is the only way to reach it from async code.** `throw` inside a callback escapes
   to the process, not to Express. That is what `asyncHandler` exists for.
3. **`next()` with no argument means "continue"; `next(anything)` means "error".** Passing a
   string works and produces a confusing 500 — always pass an `AppError`.
4. **Order is load-bearing.** `errorHandler` mounts *after* every router, `requireUser` *before*
   `requireRole`. Mounting the error handler early is a common and silent mistake.

### 2.2 Types describe intent; runtime is the authority

`req.query = {...}` type-checks and throws. That gap between `@types/express` and Express 5 is
worth internalising, because the instinct after a clean `tsc` is to trust it.

The habit: for anything touching a framework's runtime object — request/response, ORM client,
driver — **write the probe.** Two minutes with `node -e` settled a design question that a type
signature actively misled on. And once settled, pin it in a test so the next upgrade tells you if
it changed.

### 2.3 Clamp or reject? Two philosophies, chosen per-input

`parsePagination('?page=-3')` returns page 1. `validate()` on a malformed body returns 422. Both
are "bad input" — why treat them differently?

- **Pagination is navigation.** `?page=-3` is a stale bookmark or an off-by-one in a UI. Failing
  the request helps nobody; page 1 is what the user wanted. The one non-negotiable is `MAX_LIMIT`
  — clamping `?limit=1000000` to 100 is what stops a single request exhausting the database.
- **A request body is intent.** Silently "fixing" a malformed registration means guessing what the
  caller meant, and guessing about credentials is how you build something that behaves
  differently from what its client believes.

The rule worth carrying: **clamp what is merely out of range; reject what is ambiguous.**

### 2.4 An error handler is an information-disclosure boundary

`errorHandler` has two branches for a reason. `AppError` is deliberate — the message was written to
be seen, so it goes to the client. Everything else is a bug, and the raw error text is likely to
contain a table name, a column, a file path, or a connection string.

So: log the whole thing server-side, return a fixed `{ code: 'INTERNAL', message: 'Internal server
error' }`. Same instinct as SD-5's 404-not-403 — **default to telling the client nothing it did
not already know.**

### 2.5 Declaration merging, and why `req.valid` is `unknown`

`declare global { namespace Express { interface Request { user?: AuthUser } } }` adds a property to
a type you don't own. It's the standard Express pattern and it's why `req.user` type-checks
everywhere without a cast.

`req.valid` is typed `unknown`, not generic, on purpose. Threading a schema's inferred type through
`RequestHandler` and into `router.post()` is possible and produces exactly the "generic gymnastics"
PLAN.md section 0 forbids. One `as RegisterInput` per handler is the boring cost, and it stays
honest — the cast is visible at the point where the assumption is made.

### 2.6 Testing middleware without a server

Middleware is a plain function of `(req, res, next)`. A stub object and a `jest.fn()` for `next` is
enough to assert everything that matters, and 19 tests run in under 5 seconds. Reach for
Supertest (Phase 12) when routing, body parsing or status codes are the thing under test — not
before.

The one exception here is deliberate: the `req.query` test *does* start a real server, because the
behaviour being pinned is Express's, not ours.

### Not worth your time

Making `req.valid` generic. Adding a DI container so `logger` can be swapped. Extracting a
`BaseError` hierarchy. All three are the abstractions this phase exists to avoid.

### Highest-leverage exercise

Delete the `_next` parameter from `errorHandler`, run the tests, and watch them still pass — then
work out why an actual 422 would come back as an HTML error page. That single behaviour explains
more about Express than any amount of documentation.

---

## 3. Why this is a good shared package

1. **It is small and it is finished.** Seven modules, 192 lines, and `index.ts` says out loud that
   nothing else belongs here. A shared package without a stated boundary becomes a junk drawer by
   Phase 9.
2. **It only contains things whose *shape* must agree across services.** The error envelope, the
   pagination envelope, the auth header contract. Business logic deliberately duplicates instead.
3. **One error shape, enforced by one function.** Four services cannot drift into four error
   formats, so the frontend's `fetch` wrapper needs no per-service special cases.
4. **Every export is a plain function or a middleware factory.** No classes except the one that has
   to be, no configuration object, no init step, no order-of-import requirements.
5. **Security defaults are on by default.** Redaction is configured in `logger` itself, so a
   service cannot forget it. `requireUser` rejects an unrecognised role rather than trusting it.
6. **The dangerous parts are pinned by tests.** `MAX_LIMIT`, `totalPages === 0` for an empty
   result, and the Express getter behaviour are all regression-guarded.
7. **Fast to test.** No server, no database, no container. Sub-5-second feedback is what makes
   people actually run the tests.

Honest caveat: `req.valid` as `unknown` pushes one cast into every handler. It is the right trade
against generic plumbing, but it is a real cost repeated ~45 times, and it relies on the cast
matching the schema — nothing enforces that they agree.

---

## 4. Five Q&A (self-test)

**Q1. Why must `errorHandler` declare four parameters, and what exactly happens if you delete the
unused `_next`?**

Express distinguishes error middleware from ordinary middleware by `fn.length` — four parameters
means error handler, three means normal handler. Delete `_next` and it silently becomes a normal
handler: it is never invoked with an error, every `next(err)` falls through to Express's default
handler, and clients get an HTML error page with a stack trace in development. Nothing warns you,
and unit tests that call the function directly still pass, which is what makes it dangerous.

**Q2. `validate()` attaches the parsed result to `req.valid` rather than overwriting `req[source]`.
Give the concrete failure that forced this.**

Express 5 defines `req.query` as a getter with **no setter**, and `@types/express` doesn't model
that — so `req.query = parsed` compiles cleanly. At run time, because TypeScript's `strict` implies
`alwaysStrict`, assigning to a getter-only property throws
`TypeError: Cannot set property query ... which has only a getter`. That would be a 500 on every
list endpoint in Phases 8–9. (In sloppy-mode JS it silently no-ops instead — the coerced values
just vanish, which is the harder version to debug.) One destination for all three sources removes
the per-source exception, and `req.body` stays raw for audit logging.

**Q3. `?page=-3` is clamped to page 1, but a malformed body returns 422. Justify treating two kinds
of bad input differently.**

Pagination is navigation: a negative page is a stale link or a UI off-by-one, and page 1 is
unambiguously what was wanted, so failing helps nobody. A request body is *intent* — silently
repairing a malformed registration means guessing what the caller meant about credentials, and the
client then believes something happened that didn't. The rule: **clamp what is merely out of range,
reject what is ambiguous.** The one clamp that is a hard control rather than a convenience is
`MAX_LIMIT`, which stops `?limit=1000000` from being a one-request DoS.

**Q4. `requireUser` trusts `x-user-id` with no signature check. Name every condition that must hold
for that to be safe, and the failure if one doesn't.**

Three, all required (SD-1): the gateway must **strip** inbound `x-user-*` before setting its own,
or a client sends them straight through the front door; the service must be **unreachable from
outside** — locally only ports 3000/4000 publish, in Kubernetes `networkpolicy.yaml` restricts
ingress to the gateway pod; and the gateway must actually verify the JWT before setting them. If
any one fails, `curl notes-service:4002/notes -H 'x-user-id: <victim>' -H 'x-user-role: ADMIN'`
returns that user's data with no token at all. `requireUser` adds one small defence of its own —
it rejects a role string that isn't `USER` or `ADMIN` rather than passing it through.

**Q5. Why does `errorHandler` return a fixed message for anything that isn't an `AppError`, when
echoing `err.message` would make debugging easier?**

Because non-`AppError` messages are written by libraries, not for users. A Prisma error names
tables and columns; a driver error can carry a connection string; a filesystem error leaks
deployment paths — that is an information-disclosure vulnerability, and it's free reconnaissance
for an attacker. Debuggability isn't lost: the full error is logged server-side with the request
path, and Phase 7 adds `x-request-id` so a client-reported failure maps to exact log lines. Same
instinct as 404-instead-of-403 in SD-5 — **tell the client nothing it did not already know.**

---

## 5. Next

Phase 4 — notification-service: the smallest real service, establishing the template the other
three copy. Express on 4004 following the standard file shape, `POST /internal/email` guarded by
`x-internal-key`, four template functions returning `{ subject, html }`, Nodemailer pointed at
MailHog, and `GET /health`. Verified by curling the endpoint and seeing the mail land in the
MailHog inbox — which Phase 2 already proved works.
