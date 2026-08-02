# Technology choices

Every row: what we picked, why, and what we rejected. A choice without a rejected alternative
isn't a decision, it's a default.

## Backend

| Choice | Why | Rejected |
|---|---|---|
| **Express + TypeScript** | Plain functions and explicit `router.post(path, validate, handler)` wiring. Nothing between the request and the code. | **NestJS** — decorators, DI container, modules, providers. Powerful, but it teaches you *NestJS*, not HTTP. **Fastify** — faster, smaller ecosystem for the middleware we need. |
| **npm workspaces** | One install, one lockfile, local packages importable by name. Ships with npm — one less tool. | **Turborepo / Nx** — add build caching and dependency-ordered task graphs. Neither cost is felt at six packages; both can be added later without code changes. |
| **Prisma** | Typed client generated from the schema, readable migrations, and one `schema.prisma` per service that doubles as documentation. Raw SQL is still available for the one full-text query that needs it. | **TypeORM** — decorator/entity-heavy, pushes you toward the repository pattern. **Knex** — no types from the schema. **Raw `pg`** — you end up writing a worse Prisma. |
| **Redis** | The only sensible home for short-TTL state: email OTPs, `mfaToken`, rate-limit counters. TTL is a first-class feature; rate limits work correctly across replicas. | **In-memory (`Map`)** — breaks the moment there are two instances. **Postgres table + `expiresAt`** — works, but you own the sweeper and it puts write load on the primary for data you don't care about losing. |
| **`zod`** | Schema is the validator *and* the TypeScript type. One `validate(schema)` middleware, no class decorators. | **`class-validator`** — needs classes and `reflect-metadata`. **`joi`** — no type inference. |
| **`bcryptjs`** | Pure JavaScript — no `node-gyp`, no compiler in the Docker build stage, identical behaviour on every platform and in CI. bcrypt itself is 1999-vintage and has never been broken. Cost factor is tunable and travels inside the hash string. | **`argon2` (Argon2id)** — memory-hard and the current OWASP first choice, but a native module needing build tools in the image. **`bcrypt`** (native) — same build-tool cost. **`@node-rs/argon2`** — Argon2 with prebuilt binaries; the strongest option if the native-module question is revisited. **PBKDF2** — weakest of the acceptable set. **SHA-256** — not a password hash. |
| **`pino`** | Structured JSON logs with negligible overhead; drops straight into any log aggregator. | **winston** — slower, more configuration. **`console.log`** — unparseable in aggregate. |
| **Jest + Supertest** | Supertest exercises the real Express app without binding a port. Jest is the boring default. | **Vitest** — faster, but Jest's Prisma/ts ecosystem is better trodden. **Hand-rolled `http` calls** — you'd rebuild Supertest. |

## Architecture

| Choice | Why | Rejected |
|---|---|---|
| **Gateway-only JWT verification** | One place owns token validation. Notes and todo have no JWT library and no signing secret — the blast radius of a leaked secret is one service. | **Verify in every service** — duplicated logic and the signing secret in four places. **Opaque tokens + an introspection call per request** — correct for third-party clients, but a network hop on every request for no gain here. |
| **Database per service** | Each service owns its schema and migrations; you cannot accidentally couple two services through a shared table. | **One shared database** — the default in practice, and the thing that quietly turns microservices back into a distributed monolith. |
| **No foreign keys across services** | A UUID column is the only supported cross-service reference, which forces the boundary to be real. | **Cross-service FKs** — impossible across databases anyway; attempting it means one shared DB. |
| **HTTP between services** | Two calls total (auth → notification, gateway → everything). A broker would be more moving parts than logic. | **RabbitMQ / SQS** — the right answer once you need retries, fan-out, or the caller must not block. Cost of skipping it: if notification-service is down, the verification email is lost with no retry. Documented, accepted. |
| **`http-proxy-middleware` with a static route table** | Four lines of config, greppable, no runtime magic. | **Service discovery / Consul** — solves a problem that starts at dozens of services. |
| **Six services instead of a modular monolith** | The goal is to learn the mechanics: trust boundaries, data ownership, independent deploys. | **Modular monolith** — genuinely the better engineering answer for an app this size: no network between modules, real transactions, one deployable. Chosen against on purpose, for learning. |

## Frontend

| Choice | Why | Rejected |
|---|---|---|
| **Next.js App Router** | Routing, bundling and server rendering without assembling them yourself. | **Vite + React Router** — leaner, but then you own the SSR story. |
| **React Query** | Server state has caching, retries and invalidation. Hand-rolled `useEffect` fetching re-invents all three badly. | **Redux Toolkit Query** — fine, but pulls in Redux for data we don't need in a global store. |
| **Zustand** | The only real client state is the in-memory access token. Zustand is ~1kB for that. | **Redux** — enormous for one string. **React Context** — re-renders the tree on token refresh. |
| **Tailwind + ~10 local components** | No component-library API to learn, and every style is visible at the call site. | **MUI / shadcn / Chakra** — faster to a polished look, but you learn their abstractions instead of CSS. |
| **`react-markdown` + `rehype-sanitize`** | Sanitising at **render** time, never `dangerouslySetInnerHTML`. Stored content stays raw so it can be re-rendered with better rules later. | **Sanitise on write** — one bad regex and the stored data is corrupted permanently. **`marked` + `innerHTML`** — an XSS hole by construction. |
| **Access token in memory, refresh token in an httpOnly cookie** | Nothing an XSS payload can read gives long-lived access. This is the entire mitigation story. | **Both in `localStorage`** — any XSS is a full, persistent account takeover. **Both in cookies** — workable, but then you need CSRF tokens for every mutation. |

## Infrastructure

| Choice | Why | Rejected |
|---|---|---|
| **Docker Compose for local dev** | One command brings up Postgres, Redis and MailHog with healthchecks and named volumes. | **Locally installed services** — "works on my machine" and version drift. |
| **MailHog** | Catches every outbound email and shows it in a browser, with a JSON API (`/api/v2/messages`) that tests can assert against. No real addresses, no deliverability config. | **`axllent/mailpit`** — a drop-in replacement that is actively maintained; MailHog has had no release since 2020. Worth switching if MailHog ever breaks, but it works and the plan names it. **A real SMTP account in dev** — leaks real mail and needs credentials in `.env`. |
| **Kubernetes (kind/minikube first)** | The NetworkPolicy is what makes the header-trust model safe, and that only exists in Kubernetes. Debugging locally is far cheaper than in EKS. | **ECS Fargate** — simpler to operate, no NetworkPolicy equivalent to learn. **Plain EC2 + Compose** — no rolling deploys or probes. |
| **Postgres StatefulSet in-cluster** | Learning how PVCs and StatefulSets behave. | **RDS** — the correct production answer (backups, PITR, Multi-AZ). Noted in the manifest. |
| **Git SHA as the deployable image tag** | Every running container maps to exactly one commit. `latest` is convenience only and never appears in a manifest. | **`latest` in manifests** — you cannot tell what's running or roll back deterministically. **Semver tags** — meaningful for libraries, not for a service deployed from `main`. |
| **GitHub Actions + OIDC role assumption** | No long-lived AWS keys in repo secrets; the role is assumed per run and expires. | **Stored `AWS_ACCESS_KEY_ID` secrets** — a permanent credential that leaks with the repo. **Jenkins** — a server to maintain. |
| **No Terraform (yet)** | The manual `eksctl` path is what teaches you what the cluster is made of. | **Terraform first** — you end up debugging HCL instead of understanding Kubernetes. Add it once the manual path is understood; without it, the cluster is not reproducible. |

## Tooling

| Choice | Why | Rejected |
|---|---|---|
| **ESLint 10 flat config** | Config is an array of plain objects: explicit ordering, real imports, no cascade. | **`.eslintrc` (ESLint 8)** — what the plan originally specified; it is EOL and ships 9 high-severity transitive advisories that Phase 16's `npm audit` gate would fail on. |
| **Prettier, unconfigured beyond 4 options** | Formatting stops being a discussion. | **ESLint formatting rules** — slower and fights the formatter. |
| **husky + commitlint** | `npm install` alone leaves a fresh clone correctly configured — lint on `pre-commit`, conventional commits on `commit-msg`. No setup step to forget. | **CI-only checks** — you find out after pushing. **`lint-staged`** — worth adding once linting the whole repo gets slow. |
| **`module: CommonJS`** | Express, Prisma, ts-node and Jest all work with zero ESM plumbing. | **ESM** — needs `type: "module"`, `.js` extensions in TS imports, and a Jest transform workaround. `apps/web` is unaffected; Next.js brings its own tsconfig. |
