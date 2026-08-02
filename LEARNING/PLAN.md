# Secure Notes & To-Do — Build Plan for Claude Code

A learning-oriented, production-shaped full-stack app.
Backend is **Node + Express + TypeScript** (no NestJS). Everything else stays as specced.

---

## 0. Rules for Claude Code (read before every phase)

### Code style — non-negotiable

| Do | Don't |
|---|---|
| Plain exported `async function`s | Classes, `abstract class`, inheritance chains |
| `router.post('/login', validate(schema), loginHandler)` | Decorators, DI containers, `@Injectable()` |
| Controller → service function → Prisma | Controller → Repository → UnitOfWork → Mapper → Entity |
| `zod` schema + one `validate` middleware | Custom validation framework |
| One `asyncHandler` wrapper for try/catch | try/catch in every handler |
| Named imports from the actual file | Barrel-file mazes (`index.ts` re-exporting 40 things) |
| `string`, `number`, simple interfaces | Generic gymnastics, conditional types, mapped types |
| Comment **why**, not what | Comments that restate the code |

More rules:

- **Max ~150 lines per file.** If it grows, split by feature, not by layer.
- **No premature abstraction.** Write it twice before extracting a helper. Three services duplicating a 5-line helper is fine and clearer.
- **No `any`.** But also no type puzzles — if a type is hard, the design is wrong.
- Every service is the **same shape** so learning one teaches all four.
- Errors: one `AppError` class + one error middleware. That's the whole error system.
- If a phase output feels clever, rewrite it boring.

### Standard file shape for every service

```
apps/<service>/
  src/
    index.ts           # start server, nothing else
    app.ts             # express app, middleware, mount routers
    config.ts          # read + validate env with zod, export typed object
    db.ts              # prisma client singleton
    redis.ts           # redis client singleton (only where needed)
    middleware/
      error.ts         # AppError + errorHandler
      async.ts         # asyncHandler
      validate.ts      # zod validator
      requireUser.ts   # reads gateway headers (not in auth-service)
    modules/
      <feature>/
        <feature>.routes.ts       # router + wiring
        <feature>.controller.ts   # req/res only, no logic
        <feature>.service.ts      # the actual logic
        <feature>.schema.ts       # zod schemas
    utils/
  prisma/schema.prisma
  Dockerfile
  package.json
  tsconfig.json
```

### Process rules

1. **One phase per session.** Stop at the end of each phase, print what changed, wait for approval.
2. Before writing code in a phase, write 3–8 lines explaining *what it does and why this design*.
3. Every phase ends with a **runnable verification** (a curl command, a test, a page to open).
4. Append a `docs/learning-notes.md` entry after each phase: what was built, what was chosen, what the alternative was.
5. Conventional commits, one commit per phase minimum.
6. Never hardcode a secret. Add to `.env.example` the moment a new env var appears.

---

## 1. Architecture

### Services and ports

| Service | Port | Owns |
|---|---|---|
| `web` (Next.js) | 3000 | UI |
| `api-gateway` | 4000 | Public entry, JWT verify, rate limit, routing, logging |
| `auth-service` | 4001 | Users, sessions, JWT, 2FA, password reset |
| `notes-service` | 4002 | Notes, tags, search |
| `todo-service` | 4003 | Todos, labels |
| `notification-service` | 4004 | Sends email |
| PostgreSQL | 5432 | 3 databases: `auth_db`, `notes_db`, `todo_db` |
| Redis | 6379 | OTP, rate limit counters, cache |
| MailHog | 1025 / 8025 | Local fake SMTP + web inbox |

### Request flow

```mermaid
graph LR
  B[Browser] -->|cookie + Bearer| G[API Gateway :4000]
  G -->|x-user-id, x-user-role| A[auth-service :4001]
  G -->|x-user-id, x-user-role| N[notes-service :4002]
  G -->|x-user-id, x-user-role| T[todo-service :4003]
  A --> NS[notification-service :4004]
  A --> PG[(auth_db)]
  N --> PG2[(notes_db)]
  T --> PG3[(todo_db)]
  A --> R[(Redis)]
  G --> R
  NS --> SMTP[MailHog / SES]
```

### The two design decisions that make this simple

**1. Only the gateway verifies JWTs.**
Gateway validates the access token, then forwards `x-user-id` and `x-user-role` headers. Downstream services just read those headers — no JWT library, no shared secret in notes/todo.
*Trade-off:* downstream services must be unreachable from outside. Enforced by Docker network locally and a Kubernetes NetworkPolicy in prod. Write this down in `docs/security-decisions.md`.

**2. No foreign keys across services.**
`notes.userId` is a plain UUID string. No join to the users table. This is what "microservice data ownership" actually means in practice.

---

## 2. Phases

Each phase: **Goal → Build → Verify → Stop.**

---

### Phase 0 — Repo skeleton

**Goal:** empty monorepo that lints, builds, and runs nothing yet.

**Build**
- npm workspaces monorepo (not Turborepo/Nx — one less tool to learn).
- Root: `package.json` with workspaces, `tsconfig.base.json` (`strict: true`), `.eslintrc.cjs`, `.prettierrc`, `.gitignore`, `.env.example`, `README.md`.
- Folders: `apps/`, `packages/`, `infrastructure/`, `docs/`.
- `packages/shared` with one function so workspace linking is proven to work.
- Root scripts: `dev`, `build`, `lint`, `format`, `test`.
- `commitlint` + `husky` pre-commit running lint.

**Verify:** `npm install && npm run lint && npm run build` passes.

---

### Phase 1 — Docs skeleton + decisions

**Goal:** write the design down before building it.

**Build**
- `docs/architecture.md` — the Mermaid diagram above + one paragraph per service.
- `docs/technology-choices.md` — table: choice / why / what we rejected. Cover: Express over NestJS, npm workspaces, Prisma, Redis, gateway-only JWT verification, database-per-service.
- `docs/api-contracts.md` — every endpoint with request body, response body, status codes. Stub for now, fill in as built.
- `docs/security-decisions.md` — start with the header-trust trade-off.
- `docs/learning-notes.md` — empty, appended each phase.

**Verify:** diagrams render on GitHub.

---

### Phase 2 — Local infrastructure

**Goal:** Postgres, Redis, MailHog running before any app code.

**Build**
- `infrastructure/docker/docker-compose.dev.yml` — postgres, redis, mailhog only. Named volumes. Healthchecks.
- `infrastructure/docker/postgres-init/01-create-databases.sql` — creates `auth_db`, `notes_db`, `todo_db`.
- Root `docker-compose.yml` includes it.

**Verify:** `docker compose up -d`, then `psql -l` shows 3 databases, MailHog UI loads at localhost:8025.

---

### Phase 3 — Shared package

**Goal:** the small set of things genuinely worth sharing. Keep it under ~200 lines total.

**Build** in `packages/shared/src/`:
- `errors.ts` — `AppError(statusCode, message, code?)` + `errorHandler` middleware. Standard error body: `{ error: { code, message, details? } }`.
- `async.ts` — `asyncHandler`.
- `validate.ts` — `validate(schema)` middleware, returns 422 with field-level errors.
- `requireUser.ts` — reads `x-user-id` / `x-user-role`, 401 if missing, attaches `req.user`. Includes `requireRole('ADMIN')`.
- `logger.ts` — `pino` with request id.
- `pagination.ts` — parse `page`/`limit`, build `{ data, meta: { page, limit, total, totalPages } }`.
- `types.ts` — `Role`, `AuthUser`, shared DTO types.

**Stop:** nothing else goes in shared. Not business logic, not Prisma clients.

**Verify:** unit tests for `pagination` and `validate`.

---

### Phase 4 — Notification service

**Goal:** smallest real service first, to establish the template everyone copies.

**Build**
- Express app on 4004, follows the standard file shape exactly.
- `POST /internal/email` → `{ to, template, data }`.
- Templates as plain functions returning `{ subject, html }`: `verifyEmail`, `resetPassword`, `otpCode`, `accountLocked`.
- `mailer.ts` — Nodemailer with SMTP config from env. One `sendMail` function. Add a comment showing where SES would swap in; do not build an adapter interface for one implementation.
- Simple shared-secret header (`x-internal-key`) so only internal callers can hit it.
- `GET /health`.

**Verify:** curl the endpoint, see the email in MailHog.

---

### Phase 5 — Auth service: core

**Goal:** register → verify email → login → refresh → logout, no 2FA yet.

**Prisma schema (`auth_db`)**

```prisma
model User {
  id                String    @id @default(uuid())
  email             String    @unique
  passwordHash      String
  role              Role      @default(USER)
  emailVerified     Boolean   @default(false)
  isDisabled        Boolean   @default(false)
  failedAttempts    Int       @default(0)
  lockedUntil       DateTime?
  totpSecret        String?
  totpEnabled       Boolean   @default(false)
  createdAt         DateTime  @default(now())
  sessions          Session[]
  tokens            VerificationToken[]
  recoveryCodes     RecoveryCode[]
}

model Session {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash    String   @unique   // sha256 of refresh token, never the token
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  revokedAt    DateTime?
  replacedById String?             // set on rotation -> enables reuse detection
  createdAt    DateTime @default(now())
}

model VerificationToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  type      TokenType
  expiresAt DateTime
  usedAt    DateTime?
}

model RecoveryCode {
  id       String   @id @default(uuid())
  userId   String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash String
  usedAt   DateTime?
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String            // "login.success", "note.delete", ...
  ipAddress String?
  userAgent String?
  metadata  Json?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}

enum Role      { USER ADMIN }
enum TokenType { EMAIL_VERIFY PASSWORD_RESET }
```

**Endpoints**
```
POST /auth/register          -> create user, send verify email
POST /auth/verify-email      -> consume token, set emailVerified
POST /auth/login             -> password check -> tokens (or 2FA challenge in Phase 6)
POST /auth/refresh           -> rotate refresh token
POST /auth/logout            -> revoke current session
POST /auth/logout-all        -> revoke all sessions for user
POST /auth/forgot-password   -> email reset token
POST /auth/reset-password    -> set new password, revoke all sessions
GET  /auth/sessions          -> list active devices
DELETE /auth/sessions/:id    -> revoke one device
GET  /users/me
```

**Build**
- bcrypt via `bcryptjs` (pure JS — no `node-gyp` in the Docker build). Cost factor from
  `BCRYPT_ROUNDS` in `config.ts`, default 12, with a comment on how it was chosen. Cap password
  length at 72 bytes and reject longer input — bcrypt silently truncates past that. **Rehash on
  login** when a stored hash is below current cost, so the number can be raised later. See SD-4.
- Access token: JWT, 15 min, payload `{ sub, role, sid }`. Nothing else in it.
- Refresh token: 64 random bytes, base64url, 7 days. **Store only `sha256(token)`.** Sent as httpOnly + Secure + SameSite=Strict cookie scoped to `/api/auth`.
- **Rotation with reuse detection:** on refresh, mark old session revoked and set `replacedById`. If a refresh token arrives that is already revoked → revoke the entire chain for that user and 401. Comment why (stolen-token detection).
- **Lockout:** 5 failures → lock 15 min, reset on success. Return the same generic error for wrong-password and locked, so accounts can't be enumerated.
- Same generic response for `forgot-password` whether or not the email exists.
- `writeAudit()` helper called on every auth event — one function, fire-and-forget.

**Verify:** a `docs/curl-auth.md` walkthrough: register → grab link from MailHog → verify → login → call `/users/me` → refresh → logout. Plus Jest+Supertest tests for the rotation-reuse case and lockout.

---

### Phase 6 — 2FA

**Goal:** TOTP + email OTP + recovery codes.

**Flow**
1. `POST /auth/login` with valid password and 2FA enabled → `202` + `{ mfaToken, methods: ["totp","email"] }`. `mfaToken` is a short-lived (5 min) random string in Redis mapping to `userId`; it is **not** an access token.
2. `POST /auth/2fa/email/send` (if email method) → 6-digit code, hashed, in Redis, 5 min TTL, max 5 attempts.
3. `POST /auth/2fa/verify` with `{ mfaToken, code }` → success returns real tokens.

**Endpoints**
```
POST /auth/2fa/totp/setup     -> generate secret, return otpauth:// URI + QR data URL
POST /auth/2fa/totp/enable    -> verify a code, then flip totpEnabled, issue 10 recovery codes
POST /auth/2fa/totp/disable   -> requires password + valid code
POST /auth/2fa/email/send
POST /auth/2fa/verify         -> accepts totp code, email otp, or recovery code
POST /auth/2fa/recovery-codes/regenerate
```

**Build**
- `otplib` for TOTP, `qrcode` for the data URL. Window of ±1 step for clock drift.
- Recovery codes: 10 codes, format `XXXX-XXXX`, bcrypt-hashed (same `bcryptjs`), single use.
- Encrypt `totpSecret` at rest with AES-256-GCM using a key from env. ~20 lines in `utils/crypto.ts`.
- Rate limit `2fa/verify` hard: 5 attempts per `mfaToken`, then invalidate it.
- SMS: **skip entirely.** Add a `// SMS would slot in here` comment in the methods list. Don't build a mock provider abstraction for a feature you're not using.

**Verify:** enable TOTP with a real authenticator app; log in with it; log in with a recovery code; confirm that code fails the second time.

---

### Phase 7 — API Gateway

**Goal:** the only publicly exposed service.

**Build**
- `helmet` for secure headers + explicit CSP and HSTS config.
- `cors` with an allowlist from env, `credentials: true`.
- `express-rate-limit` + `rate-limit-redis`: 100 req/15min global per IP, 10 req/15min on `/api/auth/login` and `/api/auth/register`.
- `pino-http` request logging with a generated `x-request-id` forwarded downstream.
- **Auth middleware:** verify access token from `Authorization: Bearer`. On success set `x-user-id` / `x-user-role`. Always **strip incoming** `x-user-*` headers first — client spoofing prevention. Comment this loudly.
- **Routing:** `http-proxy-middleware`, table-driven:
  ```ts
  const routes = [
    { path: '/api/auth',  target: config.AUTH_URL,   public: true  },
    { path: '/api/users', target: config.AUTH_URL,   public: false },
    { path: '/api/notes', target: config.NOTES_URL,  public: false },
    { path: '/api/todos', target: config.TODO_URL,   public: false },
  ];
  ```
  Public routes skip auth but keep rate limiting. No service discovery, no registry.
- `GET /health` aggregating downstream health.

**Verify:** all Phase 5–6 curls now work through :4000. Sending a forged `x-user-id` from the client does nothing.

---

### Phase 8 — Notes service

**Prisma (`notes_db`)**

```prisma
model Note {
  id         String    @id @default(uuid())
  userId     String                        // no FK, owned by auth-service
  title      String
  content    String    @db.Text            // markdown
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id])
  tags       Tag[]
  isFavorite Boolean   @default(false)
  isArchived Boolean   @default(false)
  deletedAt  DateTime?                     // soft delete = trash
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  @@index([userId, deletedAt, isArchived])
}

model Tag      { id String @id @default(uuid()) userId String name String notes Note[] @@unique([userId, name]) }
model Category { id String @id @default(uuid()) userId String name String notes Note[] @@unique([userId, name]) }
```

**Endpoints**
```
GET    /notes                 ?page&limit&sort&search&tag&category&favorite&archived
POST   /notes
GET    /notes/:id
PUT    /notes/:id
DELETE /notes/:id             soft delete
POST   /notes/:id/restore
DELETE /notes/:id/permanent
POST   /notes/:id/archive
POST   /notes/:id/favorite
GET    /notes/trash
GET    /tags
GET    /categories
```

**Build**
- **Every query filters by `req.user.id`.** One `ownedNote(id, userId)` helper that throws 404 (not 403) if not found or not owned — no ID enumeration.
- Search: Postgres full-text on `title + content`. Use `to_tsvector` via a raw Prisma query in **one** function with a comment on why raw SQL is fine here. Do not build a query builder.
- Markdown is stored raw; **sanitising happens on render in the frontend** with `rehype-sanitize`. Note this in `docs/security-decisions.md`.
- Reuse `pagination.ts` from shared.

**Verify:** full CRUD + soft-delete/restore via curl; a test proving user A gets 404 for user B's note.

---

### Phase 9 — Todo service

**Prisma (`todo_db`)**

```prisma
model Todo {
  id          String    @id @default(uuid())
  userId      String
  title       String
  description String?
  status      Status    @default(TODO)
  priority    Priority  @default(MEDIUM)
  dueDate     DateTime?
  completedAt DateTime?
  labels      Label[]
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([userId, status, dueDate])
}

model Label { id String @id @default(uuid()) userId String name String color String @default("#888") todos Todo[] @@unique([userId, name]) }

enum Status   { TODO IN_PROGRESS DONE }
enum Priority { LOW MEDIUM HIGH URGENT }
```

**Endpoints:** same shape as notes, plus `PATCH /todos/:id/status`, `GET /todos/overdue`, filters on `status`, `priority`, `dueBefore`, `label`.

**Build**
- Copy the notes-service structure deliberately. Duplication across service boundaries is correct.
- Recurring tasks: **skip.** Leave a `docs/` note on how you'd do it (a `recurrenceRule` field + a cron worker).

**Verify:** curl walkthrough + tests.

---

### Phase 10 — Admin & audit

**Goal:** RBAC actually used, not just declared.

**Build** in auth-service, guarded by `requireRole('ADMIN')`:
```
GET    /admin/users              ?page&limit&search
PATCH  /admin/users/:id/disable
PATCH  /admin/users/:id/enable
PATCH  /admin/users/:id/role
GET    /admin/audit-logs         ?userId&action&from&to&page&limit
```
- Disabling a user revokes all their sessions immediately.
- Admin cannot change their own role or disable themselves — guard it.
- A seed script creates one admin from env vars.
- Add `AuditLog` writes for admin actions and note/todo deletes (notes/todo services POST to an internal auth endpoint, or log locally — pick one and document why).

**Verify:** a USER token gets 403 on every admin route.

---

### Phase 11 — Frontend

**Goal:** Next.js App Router UI that exercises everything above.

**Build**
- `apps/web`: Next.js + TS + Tailwind + React Query + Zustand.
- `lib/api.ts` — one `fetch` wrapper: adds `Authorization`, and on a 401 tries `/api/auth/refresh` **once** then retries. Single in-flight refresh promise so parallel 401s don't stampede.
- Access token in **memory only** (Zustand, not localStorage). Refresh token is the httpOnly cookie. Explain this in learning notes — it's the whole XSS-mitigation story.
- Pages: `/register`, `/verify-email`, `/login`, `/login/2fa`, `/forgot-password`, `/reset-password`, `/notes`, `/notes/[id]`, `/todos`, `/settings/security` (TOTP QR, recovery codes, active sessions), `/admin/users`, `/admin/audit-logs`.
- Components: keep them dumb. Data fetching lives in React Query hooks in `hooks/`, one hook per endpoint.
- Markdown rendered with `react-markdown` + `remark-gfm` + `rehype-sanitize`. Never `dangerouslySetInnerHTML`.
- No component library. Tailwind + ~10 small local components.

**Verify:** register a fresh user in the browser and complete the whole journey including TOTP.

---

### Phase 12 — Tests

**Goal:** meaningful coverage, not a coverage number.

**Build**
- Jest + Supertest per service. `testcontainers` or a separate `*_test` database via docker compose.
- Must-have tests: refresh-token reuse detection, account lockout, TOTP verify + replay rejection, recovery-code single use, cross-user 404s on notes and todos, rate limit returns 429, admin routes reject USER, pagination metadata correctness.
- One Playwright happy-path spec: register → verify → 2FA login → create note → create todo.
- `npm test` at root runs everything.

---

### Phase 13 — Docker

**Build**
- Per-service multi-stage `Dockerfile`:
  1. `deps` — install with `npm ci`
  2. `build` — `tsc` + `prisma generate`
  3. `runner` — `node:22-alpine`, non-root user, prod deps only, `dumb-init` as PID 1
- `.dockerignore` in every app.
- `web` Dockerfile uses Next.js `output: 'standalone'`.
- Full `docker-compose.yml` at root: 6 apps + postgres + redis + mailhog, with `depends_on: condition: service_healthy`, one internal bridge network, **only gateway (4000) and web (3000) publish ports**.
- Migrations: each service container runs `prisma migrate deploy` on start via a small entrypoint script.
- `docs/docker-guide.md` — how to build, run, tail logs, reset volumes.

**Verify:** `docker compose up --build` from a clean clone → app fully usable at localhost:3000. Every image under ~250MB.

---

### Phase 14 — Kubernetes

**Build** in `infrastructure/kubernetes/base/`:
- `namespace.yaml` (`secure-notes`)
- Per service: `deployment.yaml`, `service.yaml` (ClusterIP; gateway + web get an Ingress path)
- `configmap.yaml` — non-secret config
- `secret.example.yaml` — placeholder values only, real secrets go via `kubectl create secret` or External Secrets. Document both.
- `ingress.yaml` — AWS ALB Ingress Controller annotations, TLS via ACM
- `hpa.yaml` — gateway and each API service, 2–6 replicas at 70% CPU
- `postgres-statefulset.yaml` + `pvc.yaml` for learning, **plus a comment that production uses RDS**
- `redis-deployment.yaml` (+ note: ElastiCache in prod)
- `networkpolicy.yaml` — only the gateway may talk to auth/notes/todo. This is what makes the header-trust model safe.
- Every deployment: resource requests/limits, liveness + readiness probes on `/health`, `runAsNonRoot`, `readOnlyRootFilesystem` where possible.
- Optional: `infrastructure/helm/` chart wrapping the same manifests with a `values.yaml`.
- `docs/kubernetes-guide.md` — apply order, how to debug a CrashLoopBackOff, how to port-forward.

**Verify:** works on kind or minikube end-to-end before AWS is touched.

---

### Phase 15 — AWS deploy path

**Build** in `infrastructure/scripts/`:
- `build-images.sh` — build all, tag `<service>:<git-sha>` and `:latest`
- `push-ecr.sh` — `aws ecr get-login-password`, create repos if missing, push both tags
- `deploy-eks.sh` — `aws eks update-kubeconfig`, `kubectl set image` per deployment, `kubectl rollout status`
- Image versioning: **git SHA is the deployable tag.** `latest` is convenience only, never referenced in a manifest.
- `docs/deployment-guide.md`: prerequisites, IAM permissions needed, `eksctl` cluster command, ALB controller install, ACM cert, secrets creation, deploy, rollback (`kubectl rollout undo`), teardown to stop billing.
- **Do not run any `aws` command.** Scripts and docs only.

---

### Phase 16 — CI/CD

**Build** `.github/workflows/`:
- `ci.yml` on PR: install → lint → typecheck → test (postgres + redis service containers) → build. Matrix over services.
- `security.yml`: `npm audit`, Trivy image scan, Gitleaks secret scan, CodeQL. Weekly schedule + on PR.
- `deploy.yml`: on push to `main`, manual `workflow_dispatch` approval gate, OIDC role assumption (no long-lived AWS keys — explain why), build → push ECR → deploy EKS. Guarded by an environment secret so a fork can't trigger it.
- `docs/cicd-guide.md` listing every required repo secret/variable.

---

### Phase 17 — Documentation pass

**Build / finish**
- `README.md` — what it is, screenshot, 5-command quickstart, links to all docs.
- `docs/architecture.md` — final diagrams.
- `docs/sequence-diagrams.md` — Mermaid for: registration + verification, password login, 2FA login, refresh rotation with reuse detection, logout-all.
- `docs/api-documentation.md` — every endpoint. Optionally an OpenAPI YAML + Swagger UI on the gateway.
- `docs/security-decisions.md` — map each control to the OWASP Top 10 item it addresses.
- `docs/troubleshooting.md` — the errors you actually hit while building this.
- `docs/learning-notes.md` — final read-through; this is the file that makes the project worth having.

---

## 3. Environment variables (`.env.example`)

```bash
# --- shared ---
NODE_ENV=development
LOG_LEVEL=debug
INTERNAL_API_KEY=change-me-internal-shared-secret

# --- postgres ---
POSTGRES_USER=app
POSTGRES_PASSWORD=change-me
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
AUTH_DATABASE_URL=postgresql://app:change-me@localhost:5432/auth_db
NOTES_DATABASE_URL=postgresql://app:change-me@localhost:5432/notes_db
TODO_DATABASE_URL=postgresql://app:change-me@localhost:5432/todo_db

# --- redis ---
REDIS_URL=redis://localhost:6379

# --- jwt / crypto ---
JWT_ACCESS_SECRET=change-me-min-32-chars
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
TOTP_ENCRYPTION_KEY=change-me-exactly-32-bytes-hex

# --- auth policy ---
MAX_FAILED_ATTEMPTS=5
LOCKOUT_MINUTES=15
OTP_TTL_SECONDS=300
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me

# --- service urls ---
GATEWAY_PORT=4000
AUTH_SERVICE_URL=http://localhost:4001
NOTES_SERVICE_URL=http://localhost:4002
TODO_SERVICE_URL=http://localhost:4003
NOTIFICATION_SERVICE_URL=http://localhost:4004

# --- cors ---
CORS_ORIGINS=http://localhost:3000

# --- smtp (mailhog locally) ---
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM="Secure Notes <no-reply@example.com>"

# --- frontend ---
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 4. Deliberately out of scope

Skipped on purpose, each with a short `docs/` note on how it would be added. Do not build these unless asked:

- RabbitMQ / message queue — HTTP between services is enough at this size
- SMS OTP provider abstraction
- Recurring todos + cron worker
- Service mesh, gRPC, event sourcing, CQRS
- Terraform (add only after the manual EKS path is understood)
- Repository pattern, DI container, CQRS handlers, generic base controllers

---

## 5. Progress tracker

- [x] Phase 0 — Repo skeleton — done 2026-07-30 ([PHASE-0.md](PHASE-0.md))
- [x] Phase 1 — Docs skeleton + decisions — done 2026-07-30 ([PHASE-1.md](PHASE-1.md))
- [x] Phase 2 — Local infrastructure — done 2026-07-30 ([PHASE-2.md](PHASE-2.md))
- [x] Phase 3 — Shared package — done 2026-07-30 ([PHASE-3.md](PHASE-3.md))
- [x] Phase 4 — Notification service — done 2026-08-02 ([PHASE-4.md](PHASE-4.md))
- [ ] Phase 5 — Auth service core
- [ ] Phase 6 — 2FA
- [ ] Phase 7 — API Gateway
- [ ] Phase 8 — Notes service
- [ ] Phase 9 — Todo service
- [ ] Phase 10 — Admin & audit
- [ ] Phase 11 — Frontend
- [ ] Phase 12 — Tests
- [ ] Phase 13 — Docker
- [ ] Phase 14 — Kubernetes
- [ ] Phase 15 — AWS deploy path
- [ ] Phase 16 — CI/CD
- [ ] Phase 17 — Documentation pass

---

## 6. How to start

Paste into Claude Code:

> Read `LEARNING/PLAN.md`. Follow the rules in section 0 exactly — plain functions, no classes, no DI, no repository pattern, files under 150 lines. Execute **Phase 0 only**, then stop and show me what you created.