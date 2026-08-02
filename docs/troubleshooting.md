# Troubleshooting

Errors actually hit while building this, with the fix. Appended each phase.

---

## Phase 4 — notification service

### `TS2307: Cannot find module '@secure-notes/shared'` when building a fresh clone

`npm run build` worked yesterday and fails on a clean checkout. `--workspaces` runs scripts in
**directory order**, so `apps/*` compiles before `packages/shared/dist` exists. It passes on a
machine where a stale `dist/` is lying around, which is what makes it a clean-clone-only failure.

npm workspaces has no dependency-ordered task graph — that is one of the two things Turborepo would
add. Sequence it manually in the root `package.json` (`-w <dir>` selects every workspace under that
directory):

```json
"build": "npm run build -w packages --if-present && npm run build -w apps --if-present"
```

Reproduce before and after with `rm -rf packages/*/dist apps/*/dist && npm run build`.

---

### `GET /health` returns 503 `{"smtp":"down"}`

Working as intended — the probe opens a real SMTP connection. Check the dependency, not the
service:

```bash
docker compose ps                 # is mailhog running and healthy?
docker compose up -d --wait
```

No restart of the service is needed; the next probe recovers on its own.

---

### `POST /internal/email` returns 401 with a correct-looking key

The comparison is timing-safe and length-sensitive. Trailing whitespace or a newline in the header
value makes the lengths differ and fails the check before the byte comparison runs. Both "missing"
and "wrong" return the identical message on purpose, so the error text won't tell you which.

Check the value actually being sent, not the value in `.env`:

```bash
curl -v -H "x-internal-key: $KEY" ...   # -v echoes the header as sent
```

---

## Phase 3 — shared package

### `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter`

Express 5 made `req.query` **getter-only**, and `@types/express` does not model the missing setter
— so `req.query = something` compiles cleanly and fails at run time. TypeScript's `strict` implies
`alwaysStrict`, and assigning to a getter-only property throws in strict mode.

In plain sloppy-mode JavaScript the same line throws nothing and **silently does not stick**, so
coerced values vanish with no error at all. That variant is much harder to spot.

**Fix:** never write back to `req.query`. `validate()` puts the parsed result on `req.valid` for
all three sources (`body`, `query`, `params`) so there is no per-source exception. `req.body` and
`req.params` *are* assignable, but using one destination keeps the rule simple.

---

### A thrown error returns an HTML page instead of the JSON error envelope

`errorHandler` is probably not being recognised as error middleware. Express identifies those by
**function arity** — exactly four parameters. Removing the unused `_next` turns it into an ordinary
handler that is never called with an error, silently. Unit tests that invoke it directly still
pass.

Also check mount order: `app.use(errorHandler)` must come **after** every router.

---

## Phase 2 — local infrastructure

### `ports are not available: ... 127.0.0.1:5432 ... bind: An attempt was made to access a socket in a way forbidden by its access permissions`

A **native PostgreSQL server is already running on the host** and owns port 5432. Confirm:

```bash
netstat -ano | grep ":5432"                    # note the PID
powershell "Get-Process -Id <PID> | Select ProcessName"
```

Two fixes — pick one:

**A. Move the container to another port** (leaves your local Postgres alone). In `.env`:

```bash
POSTGRES_PORT=5433
AUTH_DATABASE_URL=postgresql://app:change-me@localhost:5433/auth_db
NOTES_DATABASE_URL=postgresql://app:change-me@localhost:5433/notes_db
TODO_DATABASE_URL=postgresql://app:change-me@localhost:5433/todo_db
```

The `*_DATABASE_URL` values are **not** derived from `POSTGRES_PORT` — change all four or Prisma
will silently connect to the wrong server.

**B. Stop the host service** and keep 5432:

```powershell
Stop-Service postgresql-x64-17     # name varies by installed version
```

---

### Postgres starts healthy-looking but `auth_db` / `notes_db` / `todo_db` don't exist

Check the container log for this line:

```
/usr/local/bin/docker-entrypoint.sh: ignoring /docker-entrypoint-initdb.d/*
```

`ignoring` with a literal `*` means **the glob matched nothing** — the init directory is empty
inside the container, so the bind mount didn't land. Verify what actually got mounted:

```bash
docker inspect secure-notes-postgres --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
docker compose config | grep -A2 postgres-init      # shows the resolved host path
```

**Cause:** the root `docker-compose.yml` includes the dev file with `project_directory: .`, which
makes Compose resolve **every relative path from the repo root**, not from the included file's
folder. A path written as `./postgres-init` therefore resolves to
`<repo>/postgres-init` — which doesn't exist. Docker Desktop then **auto-creates the missing
directory instead of failing**, so the only symptom is a database with no databases in it.

**Fix:** write the path relative to the repo root —
`./infrastructure/docker/postgres-init:/docker-entrypoint-initdb.d:ro` — and delete any stray
`<repo>/postgres-init` folder Docker created.

---

### Init SQL edits have no effect

`/docker-entrypoint-initdb.d/*` runs **only when the data directory is empty**, i.e. on the first
start of a fresh volume. Nothing you change in `01-create-databases.sql` applies to an existing
volume:

```bash
docker compose down -v && docker compose up -d --wait     # -v destroys the volume
```

A nastier variant: if the container is killed *between* `initdb` finishing and the init scripts
running, the volume holds a valid but empty cluster and the entrypoint skips init forever after.
The log gives it away — `database system was shut down at ...` on first boot instead of
`initdb: ... Success`. Same fix: `down -v`.

---

### `Conflict. The container name "/secude-notes-mailhog" is already in use`

Containers left over from an earlier run under a **different Compose project name** —
`docker compose down` only cleans up the project named in the current config. Remove them by the
old project name, or by container name:

```bash
docker compose -p <old-project-name> down -v
docker rm -f secure-notes-postgres secure-notes-redis secure-notes-mailhog
```

This happens after changing `name:` in the compose file. Volumes are prefixed with the project
name too, so watch for orphaned `<old-name>_pgdata`.

---

### `a network with name secure-notes exists but was not created for project "secure-notes"`

Same root cause — a network from a previous project name. `docker network rm secure-notes`, then
`up` again.
