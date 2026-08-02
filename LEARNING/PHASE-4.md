# Phase 4 — Notification service

Status: **done, 2026-08-02.** The smallest real service, running on 4004. This is the template
auth, notes and todo copy.

---

## 1. Progress

### Created — `apps/notification-service/`

| File | Code lines | Job |
|---|---|---|
| `src/index.ts` | 12 | listen, handle SIGTERM/SIGINT. Nothing else |
| `src/app.ts` | 12 | express app, JSON limit, mount routers, 404, error handler |
| `src/config.ts` | 22 | read + validate env with zod, `process.exit(1)` on failure |
| `src/mailer.ts` | 14 | one Nodemailer transport, `sendMail`, `verifyTransport` |
| `src/middleware/internalKey.ts` | 12 | timing-safe `x-internal-key` guard |
| `src/modules/email/email.schema.ts` | 26 | discriminated union — per-template `data` validation |
| `src/modules/email/email.routes.ts` | 9 | router wiring |
| `src/modules/email/email.controller.ts` | 8 | req/res only |
| `src/modules/email/email.service.ts` | 26 | render + send + log |
| `src/modules/email/templates.ts` | 55 | four templates, HTML-escaped |
| `src/modules/health/health.routes.ts` | 14 | `GET /health`, asserts SMTP |

No Prisma and no Redis — this service owns no data. No `Dockerfile` either; Phase 13 does all six
at once with the multi-stage build.

### Deviation from the plan's standard file shape

The template in PLAN.md section 0 lists a per-service `middleware/` folder containing `error.ts`,
`async.ts`, `validate.ts`, `requireUser.ts`. Those live in `packages/shared` as of Phase 3, so
services import them instead. `middleware/` here holds only what is genuinely service-specific:
`internalKey.ts`. The rest of the shape is followed exactly.

### Verified — every command actually run

```
POST /internal/email, no key            401 UNAUTHENTICATED
POST /internal/email, wrong key         401 UNAUTHENTICATED (same message)
bad email + 2-digit code                422, details: [to, data.code]
unknown template                        422, names the four valid discriminators
GET /nope                               404 in the shared JSON envelope
all four templates                      202 + messageId, all four visible in MailHog
HTML escaping, hostile verifyUrl        " -> &quot;, <script> -> &lt;script&gt;
GET /health, MailHog down               503 {"status":"degraded","smtp":"down"}
GET /health, MailHog up                 200 {"status":"ok","smtp":"up"} — no restart needed
boot with missing env                   4 field errors printed, exit code 1
SIGTERM                                 port released, clean exit
```

The `/health` sequence was accidental and is the best evidence in this phase: the stack happened
to be down, the probe correctly reported `degraded`, and it flipped back to `ok` on its own once
MailHog returned. A hardcoded `{status:"ok"}` would have lied in both directions.

### Decisions

- **`202 Accepted`, not `200 OK`.** SMTP has accepted the message for relay; whether it reaches an
  inbox is out of our hands. `200` would overstate what happened.
- **Discriminated union on `template`.** Each template's `data` is validated against its own shape,
  and the `switch` in the service is exhaustive — adding a template without handling it is a
  compile error, not a runtime 500.
- **Timing-safe key comparison.** `===` returns on the first differing byte, so response time
  leaks how many leading characters were right. Over a fast internal network that is a practical
  byte-at-a-time attack.
- **Every interpolated value is HTML-escaped.** Template data crosses a service boundary and some
  of it originates with a user.
- **`/health` calls `transporter.verify()`** rather than returning a constant, applying Phase 2's
  lesson to the application layer. Unauthenticated, because Kubernetes probes can't carry the key
  and the response discloses nothing.
- **No `MailProvider` interface.** One implementation. `mailer.ts` carries a comment showing where
  SES swaps in; that is the entire abstraction.
- **`config.ts` exits on invalid env**, so a missing `SMTP_HOST` is a failed boot rather than a
  failed user registration an hour later.

### The bug this phase found

`npm run build` **could not build a clean clone.** `--workspaces` runs in directory order, so
`apps/notification-service` compiled before `packages/shared/dist` existed:

```
src/app.ts(2,40): error TS2307: Cannot find module '@secure-notes/shared'
```

Phase 0 predicted this exactly — "if a service ever needed shared built first as part of one
`npm run build`, we'd have to sequence it manually" ([PHASE-0.md](PHASE-0.md), Q2). It went
unnoticed until now only because `dist/` already existed locally from Phase 3.

Fixed by making the order explicit — `-w <dir>` selects every workspace under a directory:

```json
"build": "npm run build -w packages --if-present && npm run build -w apps --if-present"
```

Same change for `typecheck`. Confirmed working from a deleted `dist/`. Also confirmed npm **does**
exit non-zero (code 2) when a workspace script fails, so CI would have caught it in Phase 16 — but
only after the phase that introduced it.

---

## 2. Focus areas — what to learn here

### 2.1 The four-layer request path, and why it never varies

Every endpoint in every service from here on is the same four files:

```
routes      wiring only — which middleware, in what order
controller  req in, res out. No logic, no awaits beyond the service call
service     the actual work. Knows nothing about HTTP
schema      zod. The contract, and the TypeScript type, in one place
```

The discipline that makes this pay off: **the service function must be callable without a request
object.** `sendTemplatedEmail(input)` takes a plain value and returns a plain value. That's what
makes it testable without Supertest, reusable from a queue consumer or a CLI later, and
impossible to accidentally couple to Express.

The controller looks pointlessly thin — eight lines that unwrap `req.valid` and set a status code.
That thinness *is* the point. When a controller starts growing conditionals, logic has leaked out
of the service.

### 2.2 Validate at the boundary, then trust

`sendTemplatedEmail` does no checking. No `if (!input.to) throw`. It can't — by the time it runs,
`validate(sendEmailSchema)` has guaranteed the shape, and TypeScript knows the narrowed type.

This only works if validation is *exhaustive* at the boundary, which is why the discriminated
union matters. A looser `data: z.record(z.unknown())` would push checking down into every template
function and the guarantee would evaporate.

Watch the exhaustiveness in `email.service.ts`: `switch (input.template)` with no `default`.
Because the union is closed, TypeScript proves every case is handled. Add a fifth template to the
schema and `tsc` fails until the switch handles it — the compiler enforcing a rule a code review
would otherwise have to catch.

### 2.3 Timing attacks are not theoretical on an internal network

```ts
if (key === config.INTERNAL_API_KEY)     // leaks
crypto.timingSafeEqual(supplied, expected) // doesn't
```

`===` on strings compares byte by byte and returns at the first mismatch. The timing difference is
tiny, but it's *measurable* with enough samples, and it turns a 32-character key from
"impossible" into "32 × 256 guesses". On a LAN with sub-millisecond latency that's minutes.

Two details in the implementation that are easy to get wrong:

- `timingSafeEqual` **throws** on length mismatch, which itself leaks the length — so the length
  check comes first and falls through to the same generic error.
- Both branches return the identical message. A "missing key" vs "wrong key" distinction is free
  reconnaissance.

### 2.4 Health checks, one layer up from Phase 2

Phase 2's lesson was about `pg_isready`. Same idea in application code: `GET /health` returning a
hardcoded `{status:"ok"}` tells you only that Node is running — which the TCP connection already
proved. It cannot fail, so it carries no information.

`transporter.verify()` opens a connection and runs the SMTP handshake, so the endpoint fails when
the thing this service exists to do stops working. The trade-off, worth knowing: a real check costs
a connection per probe and can turn a slow dependency into a cascading outage. For a
once-every-10-seconds probe against local SMTP, fine. For a check that fans out to five
dependencies on every request, not fine — that's how one slow service takes down a whole cluster.

### 2.5 Fail at boot, not at first use

`config.ts` validates the whole environment and calls `process.exit(1)` with field-level errors.
The alternative — `process.env.SMTP_HOST!` scattered through the code — turns a typo into a 500
during someone's registration, hours later, with a stack trace that points at Nodemailer rather
than at the missing variable.

The general shape: **one place reads the environment, validates it, and exports a typed object.**
Nothing else in the service touches `process.env`.

### 2.6 Escape at render, and where that rule came from

`esc()` wraps every interpolated value in `templates.ts`. Same principle as SD-8's
sanitise-on-render for notes: **escape at the point of output**, using the escaping appropriate to
that output format.

The one caught here is subtle: an unescaped `"` inside `href="..."` closes the attribute early and
lets an attacker add their own. That's why the verification tested a `"` specifically, not just
`<script>`.

### Not worth your time

Making the templates prettier. MJML or a templating engine. Retry logic — that needs a queue, which
is explicitly out of scope.

### Highest-leverage exercise

Add a fifth template to `email.schema.ts` and **don't** touch `email.service.ts`. Run `npm run
typecheck` and read the error. That single interaction — a closed union making the compiler enforce
completeness — is the most valuable pattern in this service.

Then delete `crypto.timingSafeEqual` and replace it with `===`. Everything still passes. Sit with
the fact that no test you would naturally write catches that.

---

## 3. Why this is a good service template

1. **Every file has one job, and the job is in its name.** `index.ts` starts a server.
   `config.ts` reads env. `app.ts` wires middleware. Nothing is 300 lines of "and also".
2. **The four-layer module shape is copy-pasteable.** Phases 5, 8 and 9 create
   `<feature>.{routes,controller,service,schema}.ts` and already know what goes where.
3. **HTTP concerns stop at the controller.** Service functions take and return plain values, so
   they're testable without a server and reusable outside a request.
4. **The compiler enforces completeness**, via a closed discriminated union rather than a runtime
   registry lookup that can miss.
5. **Security is in the default path.** The key check is timing-safe, templates escape, `/health`
   is the only unauthenticated route, the JSON body is capped at 64kb.
6. **It fails loudly at the right time** — bad config at boot, not at first request.
7. **It shuts down cleanly**, so rolling deploys don't drop in-flight requests. Cheap now,
   invisible-but-broken if left to Phase 14.
8. **No abstraction with one implementation.** No `MailProvider`, no template registry class, no
   base controller. A comment marks where SES goes.

Honest caveats: there is **no retry** — if SMTP is down the email is lost and the caller gets a
500, which is exactly the accepted risk recorded in `security-decisions.md`. And `/health` opening
an SMTP connection per probe is fine at this scale and would not be at a larger one.

---

## 4. Five Q&A (self-test)

**Q1. Why does `POST /internal/email` return 202 rather than 200, and what would 200 be claiming?**

202 Accepted means the request was valid and handed to SMTP for relay. 200 OK would claim the
operation completed — that the email was *delivered* — which this service cannot know. Delivery
depends on the receiving server, greylisting, spam filtering and DNS. The distinction is not
pedantry: a caller that treats 200 as "the user has the link" will build retry and support flows on
a false premise. The honest contract is "accepted for delivery", and the `messageId` in the
response is what makes a later delivery question answerable.

**Q2. What does the discriminated union buy over `data: z.record(z.unknown())` plus a runtime
lookup?**

Two things. **Per-template validation:** `otpCode` requires exactly six digits and `verifyEmail`
requires a valid URL, checked at the boundary, so no template function ever needs a defensive check
— they receive proven-good input. **Compile-time exhaustiveness:** the `switch` in
`email.service.ts` has no `default`, and because the union is closed TypeScript proves every case is
handled. Add a template to the schema and forget the switch, and `tsc` fails. A runtime registry
lookup fails at 3am instead, on the one template nobody tested.

**Q3. Give the concrete attack `crypto.timingSafeEqual` prevents, and name the two ways a naive
implementation still leaks even when it uses it.**

`===` short-circuits at the first differing byte, so a wrong key that shares a longer prefix takes
measurably longer to reject. Sampling that, an attacker recovers the key one byte at a time — 32 ×
256 guesses instead of 256³² — and internal-network latency is low enough to make the signal
readable. Two ways to still leak: (1) `timingSafeEqual` **throws** on differing buffer lengths, so
calling it unguarded converts a length mismatch into a distinguishable error path — check length
first; (2) returning different messages for *missing* vs *wrong* key tells an attacker their key is
the right shape. Both branches here return the same 401 and the same string.

**Q4. `/health` calls `transporter.verify()`. Argue for the cheaper `res.json({status:'ok'})`, then
say why it loses.**

The cheap version costs nothing, never flaps, and cannot cascade — a real check opens an SMTP
connection per probe, and if the dependency is slow the probe times out, Kubernetes restarts a
perfectly healthy pod, and you've amplified someone else's outage into your own. That argument is
genuinely right at scale, and for checks that fan out to several dependencies it wins. It loses
here because a constant `ok` **cannot fail**, so it carries no information beyond what the TCP
connection already proved. This service's entire purpose is reaching SMTP; if SMTP is unreachable it
should leave the load balancer. Verified live: with MailHog down the probe returned 503 `degraded`,
and it recovered to 200 on its own when MailHog came back — no restart.

**Q5. `npm run build` worked locally but fails on a clean clone. Explain the mechanism, and why the
Phase 0 decision made it inevitable.**

`--workspaces` runs scripts in directory order, so `apps/notification-service` compiled before
`packages/shared/dist` existed, and `tsc` reported `TS2307: Cannot find module
'@secure-notes/shared'`. It passed locally only because `dist/` was left over from Phase 3 — a
stale artefact hiding a broken build. The root cause is the Phase 0 trade: npm workspaces has **no
dependency-ordered task graph**, which is one of the two things Turborepo would have provided.
Phase 0's Q2 named this exact scenario. The fix is to sequence it manually —
`npm run build -w packages && npm run build -w apps` — which is the honest cost of that decision,
not a defect.

---

## 5. Next

Phase 5 — auth-service core: register → verify email → login → refresh → logout, no 2FA yet. The
Prisma schema for `auth_db`, bcrypt via `bcryptjs` (SD-4, including rehash-on-login and the 72-byte
cap), refresh-token rotation with reuse detection, account lockout, and `writeAudit()`. Verified by
a `docs/curl-auth.md` walkthrough plus Jest+Supertest tests for the rotation-reuse and lockout
cases. This is the biggest phase in the plan.
