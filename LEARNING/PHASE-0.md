# Phase 0 — Repo skeleton

Status: **done, 2026-07-30.** Monorepo installs, lints, builds. No app code yet.

---

## 1. Progress

### Created

| Path | Purpose |
|---|---|
| `package.json` | npm workspaces (`apps/*`, `packages/*`), root scripts, dev deps |
| `tsconfig.base.json` | `strict: true` base config, extended by every workspace |
| `eslint.config.mjs` | Flat config: `js.recommended` + `typescript-eslint.recommended` + prettier |
| `.prettierrc`, `.prettierignore` | 100 cols, single quotes, trailing commas, LF |
| `.editorconfig` | LF + 2-space, so editors agree with Prettier |
| `.gitignore` | ignores `.env*`, un-ignores `.env.example` |
| `.env.example` | every var from PLAN.md section 3 |
| `commitlint.config.cjs` | conventional commits, 100-char subject cap |
| `.husky/pre-commit` | runs `npm run lint` |
| `.husky/commit-msg` | runs `commitlint --edit $1` |
| `README.md` | layout, quickstart, script table, conventions |
| `apps/`, `packages/`, `infrastructure/`, `docs/` | folders, `.gitkeep` notes what lands there |
| `packages/shared/` | `package.json`, `tsconfig.json`, `src/index.ts` with one `ping()` |
| `LEARNING/` | `PLAN.md` + this file |

### Root scripts

`dev`, `build`, `test`, `typecheck` fan out with `--workspaces --if-present`, so adding a
service in a later phase needs **no root change**. Plus `lint`, `lint:fix`, `format`,
`format:check`, `verify:workspace`.

### Verified from a clean state

`node_modules`, `packages/shared/dist` and `package-lock.json` deleted first:

```
npm install               OK — found 0 vulnerabilities
npm run lint              OK — 0 problems
npm run build             OK — packages/shared → dist/
npm run typecheck         OK
npm run verify:workspace  "shared-ok"      # workspace linking proven
npm test                  no test scripts yet (expected)
```

Hooks checked directly: `git config core.hooksPath` → `.husky/_`; commitlint rejects
`"bad message"` (type-empty, subject-empty), accepts `"chore: scaffold monorepo"`.

### Decisions

- **npm workspaces**, no Turborepo/Nx — as specced, one less tool.
- **`module: CommonJS` + `moduleResolution: node`** in the base tsconfig. Express, Prisma,
  ts-node and Jest all work with zero ESM plumbing. `apps/web` (Next.js) brings its own
  tsconfig and is unaffected.
- **Stricter than `strict: true`**: also `noUncheckedIndexedAccess`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`.
- **`no-explicit-any: error`**, matching PLAN.md section 0.
- **Lint is not type-aware** — `npm run typecheck` covers types instead.
- **`packages/shared` exports only `ping()`** — it exists to prove linking; Phase 3 replaces it.

### Deviation from the plan

PLAN.md asked for `.eslintrc.cjs`. ESLint 8 is the last version supporting eslintrc, is EOL,
and pulled in **9 high-severity advisories** via `brace-expansion`/`minimatch` — which Phase
16's `security.yml` (`npm audit`) would fail on. Used **ESLint 10 + `eslint.config.mjs`** flat
config instead. Result: `found 0 vulnerabilities`.

### Open item

HEAD still contains the previous `MERN-AUTH-main` app (68 files), already deleted from the
working tree by an uncommitted deletion predating Phase 0. Nothing is committed yet — decide
whether that removal goes in the Phase 0 commit or a separate one.

---

## 2. Focus areas — what to learn here

Phase 0 has no business logic. Everything worth learning is tooling you'll stop thinking about
after this phase but will silently depend on for the next 17.

### 2.1 npm workspaces — how one repo hosts six packages

- `"workspaces": ["apps/*", "packages/*"]` makes `npm install` treat every subfolder with a
  `package.json` as one install.
- Deps hoist into **one root `node_modules`**; npm then **symlinks**
  `node_modules/@secure-notes/shared` → `packages/shared`.
- That's why `require('@secure-notes/shared')` works from anywhere — no relative paths, no
  `npm publish`.

The symlink points at the *folder*, and `main` is `dist/index.js` — so **shared must be built
before anything importing it runs.** That ordering bites in Phase 4.

### 2.2 The `--workspaces --if-present` fan-out

`--workspaces` runs a script in every workspace; `--if-present` skips ones that don't define
it. This is why adding `apps/auth-service` in Phase 5 needs zero root edits. Understand this
and you'll see what Turborepo would actually add: caching and dependency-ordered execution.

### 2.3 What `strict: true` turns on, and the four extras

`strict` is a bundle (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, …). The
extras beyond it:

| Flag | Catches |
|---|---|
| `noUncheckedIndexedAccess` | `arr[0]` is `T \| undefined` — forces handling empty arrays |
| `noImplicitReturns` | one branch returns, another falls through |
| `noFallthroughCasesInSwitch` | missing `break` |

`strictNullChecks` will change how you write code most.

### 2.4 ESLint flat config vs. eslintrc

Most tutorials still show `.eslintrc`, so know the difference:

- **eslintrc**: `extends` strings, cascades down directories, plugins resolved by magic string.
- **flat config**: a plain **array of config objects**; later objects override earlier ones,
  plugins are real imports, `files`/`ignores` are explicit, no cascade.

Two rules to internalize: `prettier` goes **last** (its job is switching *off* formatting rules
earlier configs enabled), and flat config has **no implicit environment** — CommonJS globals
must be declared, which is why there's a separate `**/*.cjs` block.

Also: lint is not type-aware, so **lint passing does not mean it compiles.**

### 2.5 Git hooks + secret hygiene

- `"prepare": "husky"` runs after `npm install` and sets `git config core.hooksPath` to
  `.husky/_`. That's the whole mechanism — hooks are executable files in a folder git points at.
- In `.gitignore`, `.env` / `.env.*` are ignored, then `!.env.example` un-ignores the template.
  **Negation must come after the pattern it overrides.**

### Not worth your time

Exact Prettier options, `.editorconfig`, the `ping()` placeholder (deleted in Phase 3), and the
ESLint-8-vs-10 detour.

### Highest-leverage exercise

```bash
rm -rf node_modules packages/shared/dist
npm install && npm run lint && npm run build && npm run verify:workspace
```

Predict what each step does before running it. If the build/link ordering makes sense, Phase 0
has done its job.

---

## 3. Why this is a good infra

1. **Adding a service costs one folder.** Root scripts fan out; no root file changes, no
   pipeline registration, no path aliases to maintain.
2. **One install, one lockfile, one lint config, one TS base.** Six services can't drift onto
   six different TypeScript or ESLint versions.
3. **Verification is a command, not a vibe.** `verify:workspace` proves linking; `typecheck`
   proves types; `lint` proves style. Each failure mode has its own signal.
4. **Mistakes are blocked at commit time, not review time.** `pre-commit` lints, `commit-msg`
   enforces conventional commits — both wired by `npm install` alone, so a new clone is
   correctly configured with no setup instructions to forget.
5. **Secrets can't leak by accident.** `.env*` ignored with an explicit `.env.example`
   exception makes "document the var, never the value" the path of least resistance — which is
   what makes the plan's rule (add to `.env.example` the moment a var appears) enforceable.
6. **Strictness is set before there's code to break.** Turning on `noUncheckedIndexedAccess`
   now costs nothing; turning it on at Phase 12 would mean hundreds of errors and you'd disable
   it instead.
7. **Zero known vulnerabilities at the starting line**, so Phase 16's `npm audit` gate is
   meaningful rather than something you learn to ignore.
8. **Boring on purpose.** No Turborepo, no Nx, no path aliases, no barrel files, no build
   orchestrator. Every failure has one obvious cause.

Honest caveat: this is good *repo* infra, not production *operations* infra. Observability,
secret management and deploy safety come in Phases 13–16, and some of those stay deliberately
simplified.

---

## 4. Five Q&A (self-test)

**Q1. When a service does `require('@secure-notes/shared')`, what actually resolves — and why
must shared be built first?**

Node walks up looking for `node_modules/@secure-notes/shared`, finds a **symlink** npm created
to `packages/shared/`, reads its `package.json`, and loads `main` → `dist/index.js`. Since
`main` points into `dist/`, the import fails until `tsc` has run. Prove both halves:

```bash
ls -l node_modules/@secure-notes/                        # the symlink
rm -rf packages/shared/dist && npm run verify:workspace  # breaks
npm run build && npm run verify:workspace                # works
```

**Q2. Why npm workspaces instead of Turborepo or Nx — and what do we give up?**

Workspaces solve the two problems this repo actually has: one install, and local packages
importable by name. We give up **build caching** (Turborepo would skip rebuilding unchanged
packages) and **dependency-ordered task graphs** (`--workspaces` runs in directory order, not
dependency order — so if a service ever needed shared built first as part of one `npm run
build`, we'd have to sequence it manually). At six packages, neither cost is felt; both tools
can be added later without changing any code.

**Q3. Why `module: CommonJS` instead of ESM, when ESM is the modern default?**

Because every backend tool here — Express, Prisma, ts-node, Jest — works with CJS and zero
configuration, while ESM in Node/TypeScript needs `type: "module"`, explicit `.js` extensions
in TS imports, and a Jest transform workaround. Picking one deliberately now avoids the single
most common category of confusing Node/TS errors. `apps/web` (Next.js) is unaffected — it ships
its own tsconfig and bundler.

**Q4. Why is `prettier` the last entry in the ESLint array, and why isn't lint type-aware?**

`eslint-config-prettier` contains almost nothing but **rule disablements** — its whole purpose
is switching off the formatting rules that `js.recommended` and `typescript-eslint.recommended`
turn on. Flat config is last-wins, so placing it earlier would let those configs re-enable
rules that then fight Prettier. Type-aware linting is off because it requires a TS project
reference per workspace and roughly triples lint time; `npm run typecheck` gives the same type
safety at a saner point in the loop. The consequence to remember: **green lint ≠ compiles.**

**Q5. Why is `!.env.example` placed after `.env.*` in `.gitignore`, and what breaks if you swap
them?**

Git applies patterns in order, last match wins. `.env.*` ignores everything, then
`!.env.example` re-includes the one file that's safe to commit. Swap them and the negation is
matched first, then overridden by `.env.*` — `.env.example` becomes untracked, the template
silently stops being shared, and the next person clones a repo with no idea which env vars
exist. (Note also: git cannot un-ignore a file inside an ignored **directory**, which is why
this works for files but wouldn't for `.env/`.)

---

## 5. Next

Phase 1 — docs skeleton in `docs/`: `architecture.md`, `technology-choices.md`,
`api-contracts.md`, `security-decisions.md`, `learning-notes.md`.
