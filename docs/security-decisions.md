# Security decisions

Each entry: the decision, the threat it addresses, and the cost of taking it. **Status** is
`decided` until the phase that implements it ships, then `implemented`.

The OWASP Top 10 mapping is completed in Phase 17.

---

## SD-1 — Downstream services trust gateway headers

**Status:** decided (Phase 7)

The gateway verifies the access token, then forwards `x-user-id` and `x-user-role`. Notes, todo
and (for `/users/*`) auth read those headers directly. They contain no JWT library and no
signing secret.

**Why:** one place owns token validation. A leaked signing secret compromises one service, not
four. Adding a fifth service costs no auth code.

**The trade-off, stated plainly:** any client that can reach a downstream service directly can
impersonate any user by setting two headers. The entire security of this model rests on those
services being unreachable from outside.

**Enforced by:**

1. The gateway **strips** all inbound `x-user-*` headers before setting its own. A client
   sending `x-user-role: ADMIN` gets it discarded.
2. Locally: only `web` (3000) and `api-gateway` (4000) publish ports. The other services are on
   an internal Docker bridge network with no host mapping.
3. In Kubernetes: `networkpolicy.yaml` permits ingress to auth/notes/todo **only** from the
   gateway pod. This manifest is not optional — without it the model is broken.

**Alternative rejected:** verify the JWT in every service. Duplicated logic and the signing
secret in four places, in exchange for defence in depth. Given the network controls above, not
worth it at this size.

---

## SD-2 — Access token in memory, refresh token in an httpOnly cookie

**Status:** decided (Phase 5 + 11)

| Token | Lifetime | Storage | Contents |
|---|---|---|---|
| Access | 15 min | JavaScript memory (Zustand) | `{ sub, role, sid }` and nothing else |
| Refresh | 7 days | httpOnly, Secure, `SameSite=Strict` cookie scoped to `/api/auth` | opaque 64 random bytes |

**Threat:** XSS. This is the whole mitigation story.

- Nothing in `localStorage` or `sessionStorage`, so an injected script has nothing persistent to
  steal.
- The refresh token is unreadable from JavaScript by construction (`httpOnly`).
- An XSS payload can still call the API as the user *while the page is open* — that is
  unavoidable. What it cannot do is exfiltrate a credential that outlives the page.

**Cost:** a full page reload loses the access token, so the app must silently refresh on boot.

**`SameSite=Strict` also removes the need for CSRF tokens** on these endpoints, since the browser
won't attach the cookie to cross-site requests. Noted as a deliberate reliance on one control.

---

## SD-3 — Only `sha256(refreshToken)` is stored, and rotation detects reuse

**Status:** decided (Phase 5)

Refresh tokens are 64 random bytes, base64url. The database stores **only** the SHA-256 hash.

- A database leak yields hashes, not usable tokens.
- SHA-256 without a work factor is correct here (unlike passwords): the input is 512 bits of
  entropy, so brute force is infeasible and a per-request bcrypt would be wasted latency on every
  refresh. Work factors are for low-entropy human input; random tokens don't need one.

**Rotation with reuse detection:** on refresh, the old session is marked revoked and its
`replacedById` set to the new one. If a refresh token arrives that is *already revoked*, that
means two parties hold the same token — one of them stole it. Response: **revoke the entire
chain for that user** and return 401. The legitimate user is logged out and must re-authenticate,
which is the correct outcome.

---

## SD-4 — bcrypt (`bcryptjs`) for passwords

**Status:** decided (Phase 5)

Passwords are hashed with `bcryptjs`. Cost factor comes from `BCRYPT_ROUNDS` via `config.ts`,
default **12**.

**Why bcrypt:** deliberately slow, salt generated per password and embedded in the output, and
26 years of unbroken production use. **Why the pure-JS build:** no `node-gyp`, so the Docker
build stage needs no compiler and behaviour is identical on every platform and in CI.

**The cost, stated plainly:** bcrypt is **CPU-hard only, not memory-hard** — a GPU or ASIC
parallelises it far better than it does Argon2id or scrypt. And `bcryptjs` is roughly **3×
slower than a native implementation**, so at a fixed ~250ms latency budget it affords a lower
cost factor than native bcrypt would. Both effects push the same direction: this is the weakest
of the four acceptable choices. Accepted for build simplicity; Argon2id via `@node-rs/argon2`
(prebuilt binaries, no compiler) is the upgrade if that ever stops being the right trade.

**Two mitigations, both required:**

1. **Rehash on login.** After a successful password verify, if the stored hash's cost factor is
   below current policy, rehash at the new cost and update the row. Cost factors cannot be
   raised offline — we don't have the plaintexts — so without this the app is stuck at whatever
   `BCRYPT_ROUNDS` was on day one, forever. With it, raising the number migrates users as they
   log in.
2. **Pick the number by measuring, not by copying.** OWASP's floor is 10; 12 is the default here.
   Time it on the actual container and tune until a hash takes ~250ms. Tests set
   `BCRYPT_ROUNDS=4` — a suite that hashes 50 passwords at cost 12 takes minutes.

**bcrypt-specific gotcha to handle in Phase 5:** input beyond **72 bytes is silently truncated**,
so two different long passwords can collide. Registration must cap password length (~72 bytes) and
reject longer input explicitly rather than accepting it and quietly ignoring the tail. Argon2 and
scrypt have no such limit.

Rejected: PBKDF2 (weakest of the acceptable set; worth choosing only under FIPS-140), and any
bare hash function — MD5/SHA-1/SHA-256 are fast by design, and salting them fixes rainbow tables
while doing nothing about GPU throughput.

---

## SD-5 — No enumeration: identical responses and 404-not-403

**Status:** decided (Phases 5, 8, 9)

| Endpoint | Behaviour |
|---|---|
| `/auth/login` | Wrong password and locked account return the **same** generic 401. Otherwise lockout tells an attacker the email is valid. |
| `/auth/forgot-password` | Always `200 { sent: true }`, whether or not the address exists. |
| `/auth/register` | Returns `409` on a taken email — **a deliberate exception**, because the alternative (pretending to succeed) is a bad enough UX to be worse than the leak. |
| `/notes/:id`, `/todos/:id` | Not found and not-yours both return **404**, never 403. One `ownedNote(id, userId)` helper enforces this so a handler can't get it wrong. |

**Residual risk:** registration still leaks membership, and timing differences between "user
exists" and "user doesn't" paths can leak too. Constant-time login paths are out of scope; noted.

---

## SD-6 — Account lockout

**Status:** decided (Phase 5)

5 consecutive failures → locked 15 minutes. Counter resets on success. Values from
`MAX_FAILED_ATTEMPTS` / `LOCKOUT_MINUTES`.

**Threat:** online password guessing against a single account.

**Known abuse:** lockout is itself a denial-of-service — anyone knowing an email can keep that
account locked. Accepted at this scale. Mitigations if it mattered: exponential backoff instead
of a hard lock, or IP-scoped counters. Combined with gateway rate limiting (10 requests per 15
min on `/api/auth/login`) this covers both single-account and spray attacks.

---

## SD-7 — TOTP secrets encrypted at rest

**Status:** decided (Phase 6)

`User.totpSecret` is encrypted with AES-256-GCM using `TOTP_ENCRYPTION_KEY` (~20 lines in
`utils/crypto.ts`).

**Threat:** a read-only database leak. Password hashes are useless to an attacker, but a
plaintext TOTP secret lets them generate valid second factors forever — it must not be the weak
link. GCM is authenticated, so tampering is detected rather than silently decrypted.

**Cost:** the key lives in an env var, so a leak of *both* the database and the environment
defeats it. Real answer is a KMS; noted for Phase 15.

Recovery codes are bcrypt-hashed (same `bcryptjs`, same cost factor — an `XXXX-XXXX` code is
~40 bits, low enough to deserve a work factor, and well under bcrypt's 72-byte cap) and
single-use. Verification is rate limited to 5 attempts per
`mfaToken`, after which the token is destroyed — otherwise a 6-digit code is brute-forceable.

---

## SD-8 — Markdown is sanitised on render, not on write

**Status:** decided (Phases 8 + 11)

Note content is stored exactly as the user typed it. Sanitising happens in the browser at render
time via `react-markdown` + `rehype-sanitize`. `dangerouslySetInnerHTML` is never used.

**Why not sanitise on write:** storage would be lossy and irreversible. One over-aggressive rule
and every affected note is corrupted permanently, with no original to re-render. Sanitising at
render means fixing a rule fixes all existing content.

**The cost, and it is real:** every consumer must sanitise. Today there is one (the web app). If
an API client, an export-to-PDF job, or an email digest is ever added, each one must sanitise
independently or it becomes the XSS vector. **Any new renderer must be checked against this
entry.**

---

## SD-9 — Rate limiting lives in Redis at the gateway

**Status:** decided (Phase 7)

100 requests / 15 min per IP globally; 10 / 15 min on `/api/auth/login` and `/api/auth/register`.
Public routes skip authentication but **not** rate limiting.

Counters are in Redis, not process memory, so the limit holds across replicas — an in-memory
limiter with 3 pods is really a 3× limit.

**Cost:** if Redis is unavailable the limiter's fail mode must be chosen explicitly (fail-open
keeps the site up and unprotected; fail-closed protects it and takes it down). To be decided in
Phase 7 and recorded here.

---

## SD-10 — Secrets never in the repo

**Status:** implemented (Phase 0)

`.gitignore` ignores `.env` and `.env.*`, then un-ignores `.env.example`. Every new env var is
added to `.env.example` — name and a placeholder, never a value — in the same commit that
introduces it. Phase 16 adds Gitleaks to CI as a backstop.

**Known gap:** Kubernetes Secrets are base64, not encryption. Anyone with `get secret` in the
namespace reads them in plaintext. Production answer is AWS Secrets Manager plus External
Secrets; documented in Phase 14, not implemented.

---

## SD-11 — Container hardening

**Status:** decided (Phases 13 + 14)

Multi-stage builds with production dependencies only; `node:22-alpine`; a non-root user;
`dumb-init` as PID 1 so signals reach Node and containers shut down cleanly. In Kubernetes:
`runAsNonRoot`, `readOnlyRootFilesystem` where the service allows it, and CPU/memory limits so
one service cannot starve the node.

---

## SD-12 — Audit log

**Status:** decided (Phases 5 + 10)

`writeAudit()` is called on every auth event and every admin action: `login.success`,
`login.failure`, `password.reset`, `2fa.enabled`, `admin.user.disabled`, and so on. Rows carry
`userId`, `action`, `ipAddress`, `userAgent`, `metadata`.

Fire-and-forget: an audit write failure must never fail the request it describes.

**Gap:** the log is in the same database as the data it audits, so an attacker with write access
can edit it. Real answer is append-only storage or shipping to an external sink. Out of scope.

---

## Accepted risks (deliberate, not oversights)

| Risk | Why accepted |
|---|---|
| Access token stays valid up to 15 min after logout | No denylist. Revoking access tokens means a Redis check on every request — the usual industry trade-off. Refresh is revoked immediately, so the session cannot be extended. |
| Lockout is a DoS vector (SD-6) | Acceptable at this scale. |
| Registration leaks whether an email exists (SD-5) | UX cost of hiding it is worse than the leak. |
| K8s Secrets are not encrypted (SD-10) | Learning environment; the production path is documented. |
| No WAF, no CAPTCHA on registration | Signup spam is not a threat to a learning project. |
| Single symmetric JWT secret, no rotation or JWKS | Rotating invalidates all tokens at once. RS256 + JWKS is the production answer. |
| No queue between auth and notification | A verification email can be silently lost with no retry. |
