# Phase 1 — Docs skeleton + decisions

Status: **done, 2026-07-30.** The design is written down before any of it is built.

---

## 1. Progress

### Created

| File | Contents |
|---|---|
| `docs/architecture.md` | Mermaid request-flow diagram, service/port table, one paragraph per service, the two core design decisions, data-ownership table |
| `docs/technology-choices.md` | 40 decisions across backend / architecture / frontend / infra / tooling — each with *why* and *what was rejected* |
| `docs/api-contracts.md` | All ~45 endpoints with request body, response body, status codes; gateway prefix mapping; error and pagination envelopes |
| `docs/security-decisions.md` | SD-1 … SD-12, each with threat, cost and status; plus an explicit accepted-risks table |
| `docs/learning-notes.md` | Phase 0 and Phase 1 entries; appended every phase from here |

No code changed. `docs/.gitkeep` removed — the folder has real contents now.

### Verified

```
npm run lint       OK — 0 problems
npm run build      OK
npm run typecheck  OK
```

Mermaid: one `graph LR` block in `architecture.md`, copied verbatim from the plan's diagram, which
is standard GitHub-supported syntax. **Rendering is not machine-verified** — confirm it visually
in the VS Code markdown preview or after the first push. That is the phase's stated verification
step and it needs a human eye.

### Decisions taken while writing

- **Contracts before implementation.** Every endpoint is listed as `planned` with its shape now
  and flips to `built` as its phase ships. Generating docs from code afterwards means the API
  shape ends up being whatever was convenient to write.
- **One error envelope and one pagination envelope, fixed now.** `{ error: { code, message,
  details? } }` and `{ data, meta }`. This is what makes `packages/shared` possible in Phase 3 —
  four services left to invent four shapes cannot share helpers.
- **Numbered security decisions (SD-1 … SD-12)** with a status and an explicit cost each, instead
  of flat prose. Later phases can cite "SD-8", and the gaps stay as visible as the controls.
- **An accepted-risks table**, so the difference between "we decided to live with this" and "we
  forgot" is on the page.

---

## 2. Focus areas — what to learn here

Phase 1 produces no runnable code. What it teaches is **design-before-code as an engineering
technique**, and it pays off in three specific ways.

### 2.1 Contract-first API design

The value isn't tidy docs — it's that the frontend (Phase 11) can be designed against a contract
that exists in Phase 1, and that `packages/shared` (Phase 3) has something concrete to
standardise. Notice which decisions had to be made *before* any handler could be written:

- the error envelope, or the shared `errorHandler` has no shape to emit
- the pagination envelope, or `pagination.ts` can't exist
- 422-for-validation vs 400-for-malformed, or `validate()` has no status to return
- **404 for another user's resource**, or four services each pick something different

Learn to spot this category: decisions that are nearly free now and expensive to change once four
services depend on them.

### 2.2 A decision record is the "why", and only it survives

Code shows *what*. Git history shows *when*. Neither answers *why not the other thing* — and
that's the question that comes up in six months, or in an interview.

The format that does the work is three columns: **choice / why / rejected**. A row with an empty
"rejected" cell isn't a decision, it's a default you never examined. Look at how many rows in
`technology-choices.md` name a concrete cost of the thing we picked, not just a benefit.

### 2.3 Writing the threat model finds real bugs before the code exists

Two findings came out of writing `security-decisions.md`, not out of coding:

1. **SD-1 is only safe because of `networkpolicy.yaml`.** The gateway-header trust model means
   two HTTP headers grant admin to anything that can reach a downstream service directly. That
   promotes a Phase 14 YAML file from checklist item to load-bearing security control. Nothing in
   the auth code would ever tell you that.
2. **SD-8 (sanitise-on-render) has a cost the code can't carry.** Every future consumer must
   sanitise independently. An export-to-PDF job or email digest added in a year is an XSS vector
   unless someone checks it against that entry — so the entry says so explicitly.

The technique: for each control, write the sentence *"this fails if …"*. If you can't finish the
sentence, you don't understand the control yet.

### 2.4 The honesty test

`technology-choices.md` admits a **modular monolith is the better engineering answer** for an app
this size, and `security-decisions.md` lists risks we're choosing to accept. Documentation that
only lists strengths is marketing. The accepted-risks table is the most useful part of that file
precisely because it's the uncomfortable part.

### Not worth your time

Polishing prose, adding diagrams for their own sake, or filling in `api-contracts.md` response
bodies in more detail than the phase that builds them will need. These files are working
documents that get edited every phase — treating them as finished artifacts wastes the effort.

### Highest-leverage exercise

Pick three rows from `technology-choices.md` and try to argue the **rejected** side convincingly.
If you can, either the row's reasoning is too thin or the decision is genuinely close — both are
worth knowing. Then open `security-decisions.md` and finish "this fails if …" for SD-1, SD-3 and
SD-8 without looking at the text.

---

## 3. Why this is good documentation infra

1. **Written before the code, so it shapes the code.** Docs written afterwards describe whatever
   happened; these constrain what's allowed to happen.
2. **Each file answers one question.** *How does it fit together* (architecture) / *why these
   tools* (technology-choices) / *what exactly does it return* (api-contracts) / *what are we
   defending against and at what cost* (security-decisions). No file is the place where anything
   might be.
3. **Status columns make staleness visible.** An endpoint stuck at `planned` after its phase
   shipped is a visible bug in the docs. Prose can rot silently; a status table can't.
4. **Decisions are addressable.** "SD-8" can be cited from a code comment, a PR, or a later
   decision. Unnumbered prose can only be re-explained.
5. **Costs are recorded next to benefits.** Every SD entry has a cost line and there's a standing
   accepted-risks table — so a future reader can tell a deliberate trade-off from an oversight.
6. **It's the same repo, same PR, same review.** Docs in a wiki drift within a month because
   changing them isn't part of changing the code.
7. **Two layers, on purpose.** `docs/` is what a *contributor* needs (contracts, decisions);
   `LEARNING/` is what *you* need (focus areas, self-test). Mixing them would make `docs/` useless
   to anyone else and this file impossible to write freely.

Honest caveat: five markdown files are only as good as the discipline to update them. The
structural mitigations are the status columns and the per-phase `learning-notes.md` entry —
neither is automated, and Phase 17 exists because both will have drifted by then.

---

## 4. Five Q&A (self-test)

**Q1. What did fixing the error and pagination envelopes in Phase 1 actually buy, and what would
have broken without it?**

It's the precondition for `packages/shared` in Phase 3. `errorHandler` has to know the shape it
emits and `pagination.ts` has to know the shape it builds — neither can exist before the shape is
decided. Without it, auth-service ships `{ message }`, notes-service ships `{ error: "..." }`,
todo-service ships `{ errors: [] }`, and by Phase 11 the frontend's one `fetch` wrapper needs
per-service special cases to find an error message. The generalisable point: **shared code
requires a shared contract first, not the other way round.**

**Q2. Why does another user's note return 404 instead of 403, and why does that need to be
written down rather than just implemented?**

403 confirms the resource exists. An attacker walking UUIDs learns which IDs are real, turning
"unauthorised" into a working ID-enumeration oracle. 404 leaks nothing. It has to be *documented*
because it looks like a bug — the first well-meaning person to "fix the misleading status code"
reopens the hole. A code comment covers one call site; a contract entry covers everyone, and
`ownedNote(id, userId)` makes the correct behaviour the easy one.

**Q3. SD-1 says downstream services trust `x-user-id` from the gateway. Give the exact attack if
`networkpolicy.yaml` is missing in production, and name the two other controls that must also
hold.**

With no NetworkPolicy, any pod in the cluster (or anything that can reach the service's ClusterIP
— a compromised sidecar, a debug pod, a misconfigured Ingress, an SSRF in any service) sends
`curl notes-service:4002/notes -H 'x-user-id: <victim>' -H 'x-user-role: ADMIN'` and gets full
access with **no token at all**. The two other controls: (1) the gateway must **strip** inbound
`x-user-*` headers before setting its own, or a client just sends them through the front door;
(2) only ports 3000 and 4000 may be published, so the services aren't directly reachable from
the host. All three are required — any one missing collapses the model.

**Q4. Why is content sanitised at render time instead of before storage, and what's the standing
obligation that creates?**

Sanitising on write is lossy and irreversible: one over-aggressive rule and every affected note is
permanently mangled with no original to recover. Sanitising on render keeps storage faithful, so
tightening a rule retroactively fixes all existing content. The obligation: **every consumer must
sanitise independently.** Today there's one (`react-markdown` + `rehype-sanitize`). Add an
export-to-PDF job, an email digest, or a public API client, and each is an XSS vector unless it
sanitises too — which is why SD-8 says any new renderer must be checked against it.

**Q5. Phase 1 produces no working software. Justify it — and what would you cut if you had half
the time?**

It front-loads the decisions that are cheapest to make before code exists and most expensive
after four services depend on them (the two envelopes, the status-code table, the trust
boundary). It also produced two findings that coding wouldn't have: that `networkpolicy.yaml` is
load-bearing, and that sanitise-on-render creates a standing obligation on future consumers.

What to cut, in order: the per-service paragraphs in `architecture.md` (recoverable by reading
the code), then most of `technology-choices.md` (the *what* is visible in `package.json`; only the
*rejected* column is irreplaceable). What to keep at all costs: **`api-contracts.md`'s envelopes
and status codes**, and **SD-1**. Those two are what other phases are built on top of.

---

## 5. Next

Phase 2 — local infrastructure: `infrastructure/docker/docker-compose.dev.yml` (postgres, redis,
mailhog with healthchecks and named volumes), `postgres-init/01-create-databases.sql` creating
the three databases, and a root `docker-compose.yml` that includes it. Verified by
`docker compose up -d`, `psql -l` showing three databases, and the MailHog UI on
`localhost:8025`.
