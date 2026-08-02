# API contracts

**Stub — filled in as each phase is built.** Status column: `planned` → `built`.

Everything below is reached through the gateway on `:4000`. The gateway strips the `/api`
prefix segment it routes on, so `POST /api/auth/login` arrives at auth-service as
`POST /auth/login`.

| Public prefix | Target service | Auth required |
|---|---|---|
| `/api/auth/*` | auth-service | no (public route, still rate limited) |
| `/api/users/*` | auth-service | yes |
| `/api/notes/*` | notes-service | yes |
| `/api/todos/*` | todo-service | yes |

## Conventions

**Authentication.** `Authorization: Bearer <accessToken>`. The refresh token is never sent in a
body — it travels as an httpOnly, Secure, `SameSite=Strict` cookie scoped to `/api/auth`.

**Internal headers.** The gateway strips any inbound `x-user-id` / `x-user-role` and sets them
itself after verifying the token. Downstream services trust them; clients cannot forge them.

**Error body** — every non-2xx response:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect" } }
```

`details` is added only for validation failures:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request body is invalid",
    "details": [{ "path": "email", "message": "Invalid email" }]
  }
}
```

**Paginated body** — every list endpoint:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

**Status codes**

| Code | When |
|---|---|
| 200 | OK |
| 201 | Created |
| 202 | Accepted — used only for a 2FA challenge on login |
| 204 | No content — successful delete |
| 400 | Malformed request |
| 401 | Missing, expired or invalid access token |
| 403 | Authenticated but not permitted (role) |
| 404 | Not found **or not owned** — never 403, to prevent ID enumeration |
| 409 | Conflict — e.g. email already registered |
| 422 | Validation failed (`details` populated) |
| 429 | Rate limited |
| 500 | Unhandled — body carries no internals |

---

## auth-service — core (Phase 5)

| Method | Path | Request | Success | Notes | Status |
|---|---|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `201 { id, email }` | Sends verification email. `409` if email taken. | planned |
| POST | `/auth/verify-email` | `{ token }` | `200 { verified: true }` | Consumes single-use token. `400` if expired/used. | planned |
| POST | `/auth/login` | `{ email, password }` | `200 { accessToken, user }` + refresh cookie · or `202 { mfaToken, methods }` | Same generic `401` for wrong password **and** locked account. | planned |
| POST | `/auth/refresh` | — (cookie) | `200 { accessToken }` + new refresh cookie | Rotates. A revoked token revokes the whole chain → `401`. | planned |
| POST | `/auth/logout` | — (cookie) | `204` | Revokes the current session only. | planned |
| POST | `/auth/logout-all` | — | `204` | Revokes every session for the user. | planned |
| POST | `/auth/forgot-password` | `{ email }` | `200 { sent: true }` | Identical response whether or not the email exists. | planned |
| POST | `/auth/reset-password` | `{ token, password }` | `200` | Revokes all sessions on success. | planned |
| GET | `/auth/sessions` | — | `200 { data: [{ id, userAgent, ipAddress, createdAt, current }] }` | Active devices. | planned |
| DELETE | `/auth/sessions/:id` | — | `204` | `404` if not the caller's session. | planned |
| GET | `/users/me` | — | `200 { id, email, role, emailVerified, totpEnabled }` | | planned |

## auth-service — 2FA (Phase 6)

Login with 2FA enabled returns `202 { mfaToken, methods: ["totp", "email"] }`. `mfaToken` is a
random string in Redis with a 5-minute TTL mapping to a `userId` — **it is not an access token
and grants nothing**.

| Method | Path | Request | Success | Notes | Status |
|---|---|---|---|---|---|
| POST | `/auth/2fa/totp/setup` | — | `200 { otpauthUri, qrDataUrl }` | Secret stored AES-256-GCM encrypted, not yet enabled. | planned |
| POST | `/auth/2fa/totp/enable` | `{ code }` | `200 { recoveryCodes: string[] }` | 10 codes, shown once. | planned |
| POST | `/auth/2fa/totp/disable` | `{ password, code }` | `204` | Requires both. | planned |
| POST | `/auth/2fa/email/send` | `{ mfaToken }` | `200 { sent: true }` | 6 digits, hashed in Redis, 5 min TTL. | planned |
| POST | `/auth/2fa/verify` | `{ mfaToken, code }` | `200 { accessToken, user }` + refresh cookie | Accepts TOTP, email OTP or recovery code. 5 attempts then `mfaToken` is destroyed. | planned |
| POST | `/auth/2fa/recovery-codes/regenerate` | `{ password }` | `200 { recoveryCodes }` | Invalidates all previous codes. | planned |

## notes-service (Phase 8)

| Method | Path | Request | Success | Status |
|---|---|---|---|---|
| GET | `/notes` | query: `page` `limit` `sort` `search` `tag` `category` `favorite` `archived` | `200` paginated | planned |
| POST | `/notes` | `{ title, content, categoryId?, tags? }` | `201 { note }` | planned |
| GET | `/notes/:id` | — | `200 { note }` | planned |
| PUT | `/notes/:id` | `{ title, content, categoryId?, tags? }` | `200 { note }` | planned |
| DELETE | `/notes/:id` | — | `204` (soft delete → trash) | planned |
| POST | `/notes/:id/restore` | — | `200 { note }` | planned |
| DELETE | `/notes/:id/permanent` | — | `204` | planned |
| POST | `/notes/:id/archive` | `{ archived: boolean }` | `200 { note }` | planned |
| POST | `/notes/:id/favorite` | `{ favorite: boolean }` | `200 { note }` | planned |
| GET | `/notes/trash` | `page` `limit` | `200` paginated | planned |
| GET | `/tags` | — | `200 { data }` | planned |
| GET | `/categories` | — | `200 { data }` | planned |

Every query filters by `req.user.id`. A note belonging to someone else returns **404**.

## todo-service (Phase 9)

Same shape as notes, plus:

| Method | Path | Request | Success | Status |
|---|---|---|---|---|
| GET | `/todos` | query: `page` `limit` `sort` `search` `status` `priority` `dueBefore` `label` | `200` paginated | planned |
| POST | `/todos` | `{ title, description?, priority?, dueDate?, labels? }` | `201 { todo }` | planned |
| PATCH | `/todos/:id/status` | `{ status: "TODO" \| "IN_PROGRESS" \| "DONE" }` | `200 { todo }` | planned |
| GET | `/todos/overdue` | `page` `limit` | `200` paginated | planned |
| GET | `/labels` | — | `200 { data }` | planned |

Plus `GET/PUT/DELETE /todos/:id`, `/todos/:id/restore`, `/todos/:id/permanent`, `/todos/trash`.

## auth-service — admin (Phase 10)

All require `role = ADMIN`. A `USER` token gets `403`.

| Method | Path | Request | Success | Notes | Status |
|---|---|---|---|---|---|
| GET | `/admin/users` | `page` `limit` `search` | `200` paginated | | planned |
| PATCH | `/admin/users/:id/disable` | — | `200 { user }` | Revokes all their sessions immediately. Cannot target self. | planned |
| PATCH | `/admin/users/:id/enable` | — | `200 { user }` | | planned |
| PATCH | `/admin/users/:id/role` | `{ role }` | `200 { user }` | Cannot change own role. | planned |
| GET | `/admin/audit-logs` | `userId` `action` `from` `to` `page` `limit` | `200` paginated | | planned |

## notification-service (Phase 4)

Not routed through the gateway — internal only.

| Method | Path | Request | Success | Notes | Status |
|---|---|---|---|---|---|
| POST | `/internal/email` | `{ to, template, data }` | `202 { queued: true, messageId }` | Requires `x-internal-key` (timing-safe compare). `data` is validated per template via a discriminated union. | **built** |

Template payloads:

| `template` | `data` | Subject |
|---|---|---|
| `verifyEmail` | `{ verifyUrl: url }` | Verify your email address |
| `resetPassword` | `{ resetUrl: url }` | Reset your password |
| `otpCode` | `{ code: /^\d{6}$/ }` | `<code>` is your verification code |
| `accountLocked` | `{ minutes: int > 0 }` | Your account has been temporarily locked |

`202`, not `200`: SMTP accepted the message for relay. Delivery is not something this service can
observe.

## Health

Every service exposes `GET /health`, unauthenticated. It asserts the service's real dependencies
rather than returning a constant, and returns **503** when one is down — a check that cannot fail
carries no information.

| Service | Checks | Healthy | Degraded |
|---|---|---|---|
| notification-service | SMTP handshake | `200 { status: "ok", smtp: "up" }` | `503 { status: "degraded", smtp: "down" }` |

The gateway's version aggregates downstream health.
