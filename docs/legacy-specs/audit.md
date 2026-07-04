# Completeness Audit — JCKC Legacy Spec Suite

Auditor: completeness critic (independent pass against the real code at `C:\Projects\JCKC Web App\jckc-web-app-private`).
Date: 2026-07-02.
Specs audited: `core.md`, `auth-dashboards.md`, `students.md`, `classrooms.md`, `guardians.md`, `reports.md`, `ui-layout.md` (the seven named specs; `API-CONTRACT.md`, `DESIGN.md`, `conventions.md` also exist in the directory and were counted for coverage).

## Verdict

**PASS with two small corrections applied.** The spec suite is exceptionally accurate — every one of the five risky-detail spot checks matched the code line-for-line, including the deliberately preserved bugs. Two precise errors were found (one wrong failure-mode claim in `students.md`, one over-claim about method-override in `core.md`); both have been corrected in-place via appended `## Audit corrections` sections. Three repo-meta files (`README.md`, `CLAUDE.md`, `.gitignore`) were not covered by any spec; they contain no unique business logic, and a coverage note for them has been appended to `core.md`.

---

## 1. File coverage check

Method: enumerated every file in the repo excluding `.git/`, `node_modules/`, `package-lock.json`, and `public/reports/` output PDFs; grepped every basename across all spec files.

### Covered (all verified mentioned in at least one spec)

| File(s) | Covering spec(s) |
|---|---|
| `app.js` | core.md (bootstrap §2, helpers §5) + all feature specs |
| `config/db.js` | core.md §2.3 (exact: `useNewUrlParser`/`useUnifiedTopology`, `process.exit(1)` on error — verified) |
| `config/passport.js` | core.md §4, auth-dashboards.md §1.3 |
| `config/.env`, `config/.env.example` | core.md §6, DESIGN.md |
| `controllers/{auth,classroom,guardian,home,report,student}.js` | auth-dashboards.md, classrooms.md, guardians.md, auth-dashboards.md, reports.md, students.md respectively (+ core.md) |
| `middleware/auth.js` | core.md, auth-dashboards.md, all feature specs (behavior verified: `ensureAuth` redirect `/`, `ensureGuest` redirect `/dashboard`) |
| `models/{User,Student,Classroom,Guardian}.js` | core.md §7 + feature specs (verified — see spot check 2) |
| `routes/{auth,classroom,guardian,index,report,student}.js` | respective feature specs (all route tables verified against code) |
| `scripts/migrations/import-parent-guardians-2026-03-15.js` | core.md §8 (verified in detail: name-key normalization, `STUDENT_NAME_OVERRIDES` Hilliard→Hillard, `MANUAL_REVIEW_STUDENTS` Mara Cerone, phone typo `42306121245`→`4236121245`, mom/dad paired-phone regex, shared-last-name expansion, first-row-wins contact merge, `authorizedToPickUp: true` unconditional — all match) |
| `package.json` | core.md §1 (dependency list verified EXACT, incl. dead deps `express-handlebars`/`env`/`heroku` and missing `@tailwindcss/forms`) |
| `Procfile` (`web: node app.js`) | core.md (verified) |
| `tailwind.config.js` | core.md §1, ui-layout.md (content globs, sky/teal colors, forms plugin — verified) |
| `public/css/input.css`, `public/css/style.css` | ui-layout.md |
| `public/js/main.js` | ui-layout.md, auth-dashboards.md, guardians.md (hamburger toggle + `searchFilterGuardians` — verified) |
| `public/fonts/Roboto-*.ttf` (12 files) + `LICENSE.txt` | reports.md (the 4 used weights named individually) + ui-layout.md ("12 weights/styles", correctly noting they are pdfmake-only, not web fonts) |
| `public/google767ca53e2e77c247.html` | ui-layout.md |
| All 25 `views/*.ejs` + all 13 `views/partials/**/*.ejs` | students.md / classrooms.md / guardians.md / auth-dashboards.md / reports.md + ui-layout.md (every file name grep-confirmed) |

### NOT covered (gap — now noted in core.md "Audit corrections")

| File | Content | Risk |
|---|---|---|
| `README.md` | Version changelog v0.00.01 (2022-09-10) → v1.00.00 (2022-09-22), "PROJECT COMPLETE" | None — no behavior |
| `CLAUDE.md` | AI guidance restating architecture; itself contains an error (calls the `app.locals` EJS helpers "Handlebars helpers") | None — everything it says is specced elsewhere, correctly |
| `.gitignore` | `node_modules`, `.env` (verified via `git ls-files`: `config/.env` is untracked; only `.env.example` committed) | None |

---

## 2. Five risky-detail spot checks

### 2.1 Pagination math — CORRECT

Compared `students.md` §R4/§7 and `classrooms.md` §5 against `controllers/student.js` (lines 66–127) and `controllers/classroom.js` (lines 95–277), plus `views/partials/pagination.ejs`:

- `PAGE_SIZE = 10`; `page = Math.max(1, parseInt(req.query.page) || 1)`; `totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))`; `safePage = Math.min(page, totalPages)`; `skip((safePage - 1) * PAGE_SIZE).limit(PAGE_SIZE)` — all exactly as specced, including the "never 0 pages" and clamp-to-last-page behavior.
- `startIndex: totalCount > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0`, `endIndex: Math.min(safePage * PAGE_SIZE, totalCount)`, `hasPrevious`/`hasNext` — exact.
- classrooms.md's subtle claims verified: dual independent `addPage`/`removePage` tables; post-mutation re-clamping of only the affected table's page; **the other table's page passed through unclamped in the redirect** (harmless because the GET re-clamps) — this is precisely what the code does (classroom.js lines 231, 273).
- students.md's sort quirk (first-name-only, case-sensitive byte order, no secondary key) and the "footer hidden when totalCount == 0" claim match `sort({ studentFirstName: sortOrder })` and the `<% if (pagination.totalCount > 0) %>` guard in the partial.

### 2.2 Mongoose schema (Student, cross-checked Guardian/Classroom/User) — CORRECT

`students.md` §1.1 vs `models/Student.js`: all 11 fields match, including the load-bearing quirks: `dateOfBirth` is a **String** (`YYYY-MM-DD`), `studentZIP` String, `teacherName` dead field (never written anywhere — grep-confirmed), `ageGroup` written only by the classroom-assignment flow, `classroom` optional ObjectId ref driving derived Active/Inactive status, `createdAt` default `Date.now`. The claims "no `user` field" and "no `applicationApprovalStatus` field" are true (and the parent-dashboard queries against them correctly flagged as bugs elsewhere). §1.2's Guardian summary is right: `students` is an **untyped `Array`** (shape `{ student, relationshipToStudent, authorizedToPickUp }` by convention only), linkage lives entirely guardian-side.

### 2.3 Google OAuth callback — CORRECT

`auth-dashboards.md` §1.3/§2.2/§2.3 vs `config/passport.js` + `routes/auth.js`:

- `callbackURL`: `NODE_ENV == 'development'` (loose ==) → `http://localhost:3000/auth/google/callback`, else hardcoded `https://jckc-web-app-private.herokuapp.com/auth/google/callback` — exact.
- Scope `['profile']` only (no email) — exact; the spec's downstream inference (manual email entry on the registration form) is consistent.
- Verify callback: skeleton `newUser` with `googleId`, `displayName`, `firstNameGoog`/`lastNameGoog` from `profile.name`, empty app fields, all permission booleans `false`, `registrationStatus: false`, `image: profile.photos[0].value`; `findOne({ googleId })` then create-if-missing — exact. The spec's bug claim that the catch swallows DB errors without calling `done` (→ hang) is correct.
- `serializeUser` stores `user.id`; `deserializeUser` uses callback-style `User.findById(id, cb)` (Mongoose 6 API, flagged in core.md quirk 24) — exact.
- Callback route: `failureRedirect: '/auth/error/no-account'`; success → `registrationStatus` gate → `/auth/acct-registration` or `/dashboard` — exact, and the "belt-and-braces" claim (same gate re-checked in `home.getDashboard`) is verified.
- The IDOR claim on `PUT /auth/push-registration/:id` is real: the id comes from the URL with no comparison to `req.user.id`.

### 2.4 pdfmake report structure — CORRECT

`reports.md` §4 vs `controllers/report.js`, verified to the token level:

- Fonts dict: bold → `Roboto-Medium.ttf` (not Bold) — exact; the note that `Roboto-Bold.ttf` exists but is unused is true.
- Sign-in sheet: `pageOrientation: 'landscape'`; address line `408 W Market St, Johnson City, TN 37604` only on this report; meta table `widths: ['*','*']` borderless; main table `heights: 22`, `widths: ['*',125,60,80,125,60,80]`; IN/OUT colSpan-3 group header; 7-cell student rows — all exact.
- Roll-call sheet: portrait; `widths: [100,20,28,20,28,20,28,20,28,20,28,'auto']`; two rows per student with `rowSpan: 2` name and comments cells; DOB via `moment(e.dateOfBirth).utc().format('L')` with the literal spaces around `\n` — exact, and the UTC+ off-by-one-day warning is analytically sound.
- Quirks verified true in code: `'studentrow'` style referenced but **undefined** in the sign-in doc's styles (names render 12pt); `tableHeader` defined but unused in the roll-call doc; non-transitive infant/preschool comparator (returns 0 for the direct comparison) duplicated from `app.locals.sortClassrooms`; zero-classroom `reduce` with no initial value → throw → catch → hung request (`res.render('error/500')` commented out); fire-and-forget file writes before `res.render`; unauthenticated static exposure at `/reports/*.pdf` via `express.static('public')` (static is mounted before session/passport in app.js — verified); dead `let today = new Date()`; students sorted by LAST name here vs first name elsewhere.

### 2.5 Delete-cascade behavior — CORRECT

Verified against `controllers/student.js`, `controllers/classroom.js`, `controllers/guardian.js` and all route files:

- **Student delete** (`DELETE /student/delete-confirm/:id`): bare `Student.deleteOne({ _id })`, redirect to summary. **No cascade whatsoever** — exactly as students.md R8/Q8 and guardians.md §6/Q5 state: Guardian `students[]` keeps dangling entries; nothing to clean classroom-side (the ref lives on the deleted student); deleteOne on unknown id silently succeeds.
- **No classroom delete route** exists — classrooms.md states this explicitly ("Classrooms can never be deleted") and warns any added delete must handle orphaned `student.classroom` refs; verified: `routes/classroom.js` has no DELETE.
- **No guardian delete route and no link-removal route** exist — guardians.md states this and correctly notes the commented-out Delete button in `guardian-details.ejs`; verified: `routes/guardian.js` has GET/POST/GET/GET/PUT only.
- The dangling-link tolerance machinery in `getEditGuardianDetails` (`danglingStudentLinks` preserved verbatim on save) and the blank-`<tr>` rendering on the details page are described exactly as implemented.

---

## 3. Findings (errors in the specs)

### Finding 1 — students.md §R6: wrong failure mode ("hang" should be "500") — FIXED

- **Spec claim** (students.md line 137): "GET `/student/edit/:id` ... Nonexistent id → view throws on `student.studentFirstName` → hang."
- **Actual code behavior**: `views/students-details-edit.ejs` line 32 reads `student.studentFirstName` unguarded; the throw happens **during EJS render**, which Express's `res.render` catches and forwards to `next(err)` → **default Express 500 page**. The controller's try/catch never sees it, so the "hang" pattern (catch-and-never-respond) does not apply. The spec is internally inconsistent here: it correctly describes the identical error class as a 500 at line 91 (missing `students-summary-teacher.ejs`) and line 228 (Q11 teacher lookup throw). "Hang" is only correct for controller-body throws (invalid-ObjectId CastError, the R5 `.some()` TypeError).
- **Correction applied**: `## Audit corrections` §1 appended to `students.md` (also clarifies R7's analogous split: nonexistent id → 500, invalid ObjectId → hang).

### Finding 2 — core.md §2 item 8: method-override does NOT read a body field — FIXED

- **Spec claim**: `methodOverride("_method")` honors `?_method=...` in the query string "**or a `_method` body field**".
- **Actual behavior**: method-override v3 with a plain string getter builds a query-string-only getter (`createQueryGetter`); `req.body` is consulted only with a custom function getter. Harmless in practice (all legacy forms use the query-string form, as the specs themselves document), but wrong as stated.
- **Correction applied**: `## Audit corrections` §1 appended to `core.md`.

### Finding 3 — Coverage gap: `README.md`, `CLAUDE.md`, `.gitignore` uncovered — FIXED (noted)

- No spec mentioned these three files. Content review shows no unique business rules (changelog; restated architecture with one internal error — "Handlebars helpers" — that the specs do not repeat; two-line ignore file). Verified via `git ls-files` that `config/.env` is untracked (the slash-less `.env` pattern covers it), so no secrets-in-history implication.
- **Correction applied**: `## Audit corrections` §2 appended to `core.md` documenting all three.

### Non-findings (checked and confirmed accurate, listed for audit trail)

- Session config (`secret: 'keyboard mouse'`, connect-mongo v3 legacy API) — matches app.js exactly.
- `formatDate` dead-branch bug (throws on real `Date` input), `calcAgeGroup` 11/30-month boundaries with 365-day years, `convertAge` weeks/months-only — all match app.js helpers; the duplicated inline age computation in `pushClassroomsStudentListAdd` matches too.
- package.json dependency list, engines (`node 14.x`), scripts, version string — exact.
- `.env.example` contents and the NODE_ENV→callback-URL coupling — consistent with the spec's environment table.
- Migration script (§8 of core.md) — every hard-coded data quirk verified in source.
- Pagination partial markup claims (sm+-only "Showing X to Y", disabled gray spans, state-preserving links) — verified.

## 4. Bottom line

- 0 files with behavioral content missing from the specs.
- 2 factual errors found and corrected in-place; both were small (a failure-mode label and a middleware over-claim); neither would have changed data-model or API design decisions.
- All 5 spot checks passed at full precision, including preserved-bug documentation, which is the hardest part to get right. The suite is safe to re-implement from.
