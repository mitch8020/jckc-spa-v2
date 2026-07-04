# Feature Spec: Guardians (Parent/Guardian Management + Parent Profile)

Legacy source: Express 4 + EJS + Mongoose app at `jckc-web-app-private`.
Files covered: `controllers/guardian.js`, `routes/guardian.js`, `views/guardian-details.ejs`, `views/guardian-details-edit.ejs`, `views/registration-guardian.ejs`, `views/profile-parent.ejs`, plus supporting context from `models/Guardian.js`, `models/Student.js`, `models/User.js`, `middleware/auth.js`, `app.js`, `controllers/home.js`, `routes/index.js`, `controllers/student.js`, `views/students-details.ejs`, `public/js/main.js`, and partials.

---

## 1. Domain Model

### 1.1 `Guardian` (Mongoose model, collection `guardians`)

```
guardianFirstName     String   required
guardianLastName      String   required
phoneNumber           String   required
guardianStreetAddress String   required
guardianCity          String   required
guardianState         String   required
guardianZIP           String   required   <-- stored as STRING even though forms use <input type="number">
students              Array    (untyped / Mixed — NO subdocument schema)
createdAt             Date     default Date.now
```

Each element of `students` is a plain object of shape (by convention only, not schema-enforced):

```
{
  student: ObjectId,              // Student _id (an actual ObjectId when written by the app)
  relationshipToStudent: String,  // free text, e.g. "Mother"
  authorizedToPickUp: Boolean
}
```

Key architectural facts:

- **Guardian is a standalone entity.** It has NO email field and NO reference to a `User` (login) account. Parents who log in (User with `accountType: 'parent'`) are completely unlinked from Guardian records. There is no "my guardian record" concept anywhere.
- The guardian↔student linkage is stored ONLY on the Guardian side (`guardian.students[]`). `Student` has no back-reference to guardians. To find a student's guardians, the app loads ALL guardians and filters in JS.
- Because `students` is `type: Array` (Mixed), Mongoose applies no casting/validation to link objects.

### 1.2 Related models (context)

- `Student`: `studentFirstName`, `studentLastName`, `dateOfBirth` (**String**, `YYYY-MM-DD` from `<input type="date">`), `studentStreetAddress/City/State/ZIP` (Strings), `teacherName`, `ageGroup`, `classroom` (ObjectId ref `Classroom`), `createdAt`.
- `User`: `googleId`, `displayName`, `firstNameGoog`, `lastNameGoog`, `firstNameApp`, `lastNameApp`, `dateOfBirth` (String), `phoneNumber`, `emailAddress`, `accountType` (String — values in use: `'parent'`, `'teacher'`, `'admin'`; NOT a schema enum), `image`, `parentPermission`/`teacherPermission`/`adminPermission` (Booleans), `registrationStatus` (Boolean), `createdAt`.

---

## 2. Auth & Access Model

- Auth is Google OAuth via Passport; session-based. `app.js` sets `res.locals.user = req.user || null` on every request so views reference `user` directly.
- `ensureAuth` middleware: if `req.isAuthenticated()` → `next()`; else **redirect to `/`** (login/landing page).
- `ensureGuest`: if authenticated → redirect `/dashboard`; else next. (Imported in `routes/guardian.js` but never used there.)
- **There is NO role/permission check on any guardian route.** Every guardian route uses only `ensureAuth`. A logged-in parent or teacher can open `/guardian/details/:id`, `/guardian/edit/:id`, and the registration flow by typing URLs. All guardian views hard-include the ADMIN navigation bar (`partials/navigation-admin`) regardless of the viewer's role. **Re-implementation should fix this: guardian CRUD is intended to be admin-only** (parents reach guardians only implicitly — see §6).
- `method-override` is configured with query-string token `_method`, so HTML forms POST to `...?_method=PUT` to invoke PUT routes.

### How admins reach these pages
- Admin nav: Dashboard → Students (`/student/students-summary`) → a student's details (`/student/details/:id`).
- Student details page has a "**+ Add Parent / Guardian**" button → `/guardian/registration-guardian/<studentId>/new-guardian`.
- Student details page's "Parent / Guardian Info" table lists each linked guardian: name links to `/guardian/details/<guardianId>`, and each row has an "Edit" link to `/guardian/edit/<guardianId>`.
- The student-details table's "Relationship" column is computed as `guardiansStudent[i].students.find(e => e.student.toString() === student._id.toString()).relationshipToStudent`.

### How parents reach these pages
- Parent nav (`partials/nav-links/parent.ejs`): **Dashboard** (`/dashboard/<user.id>`), **Students** (`/student/students-summary`), **Parent Profile** (`/profile/<user.id>`), plus Logout.
- Parents are only *intended* to see the Parent Profile page (§5). They have no intended path to guardian CRUD — but nothing technically blocks them (see quirk Q1).

---

## 3. Routes

Router mounted at **`/guardian`** (`app.use('/guardian', require('./routes/guardian'))`). All 5 routes use `ensureAuth` only.

| # | Method | Full Path | Controller fn |
|---|--------|-----------|---------------|
| R1 | GET | `/guardian/registration-guardian/:student/:guardian` | `registerNewGuardian` |
| R2 | POST | `/guardian/push-register-new-guardian/:student/:guardian` | `pushRegisterNewGuardian` |
| R3 | GET | `/guardian/details/:id` | `getGuardianDetails` |
| R4 | GET | `/guardian/edit/:id` | `getEditGuardianDetails` |
| R5 | PUT | `/guardian/push-guardian-details-edit/:id` (invoked via POST + `?_method=PUT`) | `pushGuardianDetailsEdit` |

Note: the controller doc-comment for R1 says `GET /guardian/register-new-guardian/...` — that comment is WRONG; the real path is `registration-guardian`. Also note there is **no DELETE route for guardians** and **no route to remove a guardian↔student link** anywhere in the app.

Related route (parent profile): `GET /profile/:id` (router `routes/index.js`, `ensureAuth`, `homeController.getProfile`) — see §5.

All controller error handlers only `console.error`/`console.log` the error; the `res.render('error/500')` lines are commented out, so **on any error the HTTP request hangs with no response** (until client timeout). Re-implementation should return proper 4xx/5xx.

### R1 — GET `/guardian/registration-guardian/:student/:guardian` ("Add Parent / Guardian" page)

`:student` = Student ObjectId. `:guardian` = either the literal string `new-guardian` or a Guardian ObjectId (used when the admin picks an existing guardian from the dropdown; the page reloads at the new URL).

Steps:
1. `Student.findById(req.params.student)` (no `.lean()`).
2. `guardianSelected = req.params.guardian === 'new-guardian' ? 'new-guardian' : await Guardian.findById(req.params.guardian)` — a string sentinel OR a full Guardian document.
3. `guardianID = guardianSelected._id || 'new-guardian'` (string `'new-guardian'` has no `._id`, so falls back).
4. `guardiansAll = await Guardian.find().sort({ guardianFirstName: 1 }).lean()` — **all** guardians, sorted ascending by `guardianFirstName` only (last name not a tiebreaker; MongoDB sort is case-sensitive byte order, so `'alice' > 'Zoe'`).
5. `guardiansStudent` = guardians already linked to this student: `guardiansAll.filter(g => g.students.some(child => child.student.toString() === student._id.toString()))`. (Throws if any guardian doc lacks a `students` array or has a link object missing `.student` — data written by this app always has both.)
6. `guardiansFiltered` = `guardiansAll` minus `guardiansStudent` minus the currently selected guardian (`guardianID.toString() !== guardian._id.toString()`). These populate the selectable dropdown.
7. Render `registration-guardian.ejs` with `{ student, guardianID, guardianSelected, guardiansAll, guardiansStudent, guardiansFiltered }` (`guardiansAll` and `guardiansStudent` are passed but unused by the view).

Error: caught, logged, no response (hang). An invalid `:guardian` ObjectId string throws a CastError → hang.

### R2 — POST `/guardian/push-register-new-guardian/:student/:guardian` (create guardian OR link existing)

Steps:
1. `Student.findById(req.params.student)`.
2. Same `guardianSelected` resolution as R1.
3. `guardiansAll = await Guardian.find().sort({ guardianFirstName: 1 }).lean()` — **fetched but never used** (dead query; drop in re-implementation).
4. Build link object: `studentInfo = { student: student._id, relationshipToStudent: req.body.relationshipToStudent, authorizedToPickUp: true }`.
   - **`authorizedToPickUp` is HARDCODED `true`.** The form's checkbox (`name="authorized-to-pick-up"`) is completely ignored — unchecking it has no effect. (Bug; re-implementation should honor the checkbox.)
5. If `guardianSelected === 'new-guardian'`: `Guardian.create({ guardianFirstName, guardianLastName, guardianStreetAddress, guardianCity, guardianState, guardianZIP, phoneNumber, students: [studentInfo] })` — all values straight from `req.body`, no server-side validation beyond Mongoose `required`. Logs `"Guardian created!"`.
6. Else (existing guardian): `Guardian.findOneAndUpdate({ _id: guardianSelected }, { students: [...guardianSelected.students, studentInfo] })` — appends the new link to the existing array (filter passes the whole doc; Mongoose casts it to its `_id`). Logs `"Guardian updated!"`. **No duplicate check** — the UI prevents picking an already-linked guardian, but a direct POST can create duplicate links for the same student. Guardian's personal fields are NOT updated in this branch (the form's info inputs are `disabled`, so they aren't submitted anyway).
7. Redirect → **`/student/details/<student._id>`** (both branches).

Body fields consumed: `guardianFirstName`, `guardianLastName`, `guardianStreetAddress`, `guardianCity`, `guardianState`, `guardianZIP`, `phoneNumber`, `relationshipToStudent`. (`authorized-to-pick-up` submitted by the form but ignored.)

### R3 — GET `/guardian/details/:id` (Guardian detail page)

1. `Guardian.findById(req.params.id)` (full document, no `.lean()`).
2. **N+1 sequential loop**: for each `guardian.students[i]`, `Student.findById(guardian.students[i].student)`, push result into `students` array. Deleted students yield `null` entries — the array stays index-aligned with `guardian.students`.
3. Render `guardian-details.ejs` with `{ guardian, students }`.

### R4 — GET `/guardian/edit/:id` (Edit guardian page)

1. `Guardian.findById(req.params.id).lean()`.
2. `studentIds = (guardian.students || []).map(link => link.student)`.
3. `Student.find({ _id: { $in: studentIds } }, { studentFirstName: 1, studentLastName: 1 }).lean()` — single batch query, name-only projection.
4. Build `studentsById` Map keyed by `_id.toString()`.
5. Walk `guardian.students` in order, splitting into:
   - `assignedStudents[]` (student exists): `{ studentId, studentName: `${studentFirstName} ${studentLastName}`, relationshipToStudent: link.relationshipToStudent || '', authorizedToPickUp: Boolean(link.authorizedToPickUp) }`.
   - `danglingStudentLinks[]` (student record deleted/missing): `{ studentId, relationshipToStudent, authorizedToPickUp }` — displayed read-only, preserved on save.
6. Render `guardian-details-edit.ejs` with `{ guardian, assignedStudents, danglingStudentLinks }`.

### R5 — PUT `/guardian/push-guardian-details-edit/:id` (save guardian edits)

Invoked by the edit form: `action="/guardian/push-guardian-details-edit/<id>?_method=PUT" method="POST"`.

1. `Guardian.findById(req.params.id)` (live document).
2. Re-derive which student links are editable: fetch `Student.find({ _id: { $in: existingStudentIds } }, { _id: 1 }).lean()`; `editableStudentIds` = Set of found ids as strings. (Links whose student no longer exists are NOT editable.)
3. Overwrite the 7 personal fields directly from body: `guardianFirstName`, `guardianLastName`, `guardianStreetAddress`, `guardianCity`, `guardianState`, `guardianZIP`, `phoneNumber`. No trimming/validation; if a field is absent it becomes `undefined` and Mongoose `required` validation fails on `save()` → error → request hangs.
4. Rebuild `guardian.students` via `.map(link => ...)` per link:
   - If `link.student.toString()` not in `editableStudentIds` → return link unchanged (dangling links preserved verbatim).
   - Per-student dynamic field names: `relationshipToStudent_<studentId>` and `authorizedToPickUp_<studentId>`.
   - `hasRenderedFields = hasOwnProperty(req.body, relationshipField)`; if the relationship field wasn't submitted at all → return link unchanged (defensive against partial form submissions).
   - Otherwise return `{ ...link, relationshipToStudent: trimmedValue || link.relationshipToStudent, authorizedToPickUp: hasOwnProperty(req.body, pickupField) }`.
     - Relationship: value is `String(...).trim()`; **an empty/whitespace submission keeps the OLD relationship value** (cannot be blanked). The form marks it `required` anyway.
     - Pickup: standard HTML checkbox semantics — present ⇒ `true`, absent ⇒ `false`. This is the ONLY place `authorizedToPickUp` can ever be set to `false`.
5. `await guardian.save()`, log `"Guardian Info Updated!"`.
6. Redirect → **`/guardian/details/<req.params.id>`**.

**Note:** the edit flow cannot ADD or REMOVE student links — only mutate `relationshipToStudent` and `authorizedToPickUp` of existing ones. Links are added only via R2; there is no removal mechanism in the entire app.

---

## 4. UI Spec (EJS views)

Shared chrome for all three guardian views: `partials/dashboard-head` (`<title>JCKC Dashboard</title>`, Tailwind CDN, Font Awesome, Flowbite CSS), `partials/navigation-admin` (indigo-600 navbar: Dashboard `/dashboard/<user.id>`, Students `/student/students-summary`, Classrooms `/classroom/classrooms-summary`, Reports `/report/reports-summary`, Logout `/auth/logout`; mobile hamburger menu), and `partials/dashboard-close-tag` (Flowbite JS + `/js/main.js`).

### 4.1 `guardian-details.ejs` — "Parent / Guardian Details" (R3)

- The ONLY guardian view that also includes `partials/header` (grey banner: "Hello, `<user.firstNameApp>`!" left, today's date via `formatDate()` right).
- H1 (centered): **"Parent / Guardian Details"**.
- **Card 1 — "Parent / Guardian Info"**:
  - Header row: title left; right side has an **"Edit Info"** button (indigo) → `/guardian/edit/<guardian._id>`. A **Delete** button exists in the markup but is COMMENTED OUT (no delete feature).
  - Definition list rows (label / value):
    1. "Parent / Guardian Name" → `guardianFirstName + ' ' + guardianLastName`
    2. "Address" → `guardianStreetAddress + ', ' + guardianCity + ', ' + guardianState + ' ' + guardianZIP`
    3. "Phone Number" → `phoneNumber`
- **Card 2 — "Assigned Students"** (a "+ Add Guardian" button is commented out):
  - Table columns: **Name** | **Date of Birth** (hidden below `lg`) | **Age** (hidden below `md`) | **Relationship to Student** (hidden below `sm`, centered) | **Authorized for Pickup** (centered).
  - One row per `students[i]` (index-aligned with `guardian.students[i]`):
    - Name cell: link to `/student/details/<students[i]._id>` showing `studentFirstName + ' ' + studentLastName`; on small screens a stacked `<dl>` repeats DOB, age, relationship responsively.
    - DOB: `formatDate(students[i].dateOfBirth)` → `M/D/YYYY`-style (see §7 helper notes; DOB is a `YYYY-MM-DD` string, so output keeps leading zeros, e.g. `07/02/2020`).
    - Age: `convertAge(students[i].dateOfBirth)` → `"N weeks old"` if under ~1 month else `"N months old"` (always months, even for 5-year-olds — e.g. "62 months old").
    - Relationship: `guardian.students[i].relationshipToStudent`.
    - Pickup: `guardian.students[i].authorizedToPickUp ? 'Yes' : 'No'`.
    - Each row's content is wrapped in `<% if (students[i]) { %>` — a dangling link (deleted student) renders an **empty `<tr>`** (blank row).
  - If `students.length === 0`: single row "No Assigned Students Available" (first td has a meaningless `col-span-4` CSS class plus 4 empty `<td>`s).
  - Markup bug: pickup `<td>` ends with a stray `</a>` closing tag.

### 4.2 `guardian-details-edit.ejs` — "Edit Parent / Guardian Details" (R4 → posts R5)

- H1 (centered): **"Edit Parent / Guardian Details"**. No header partial.
- Single `<form method="POST" action="/guardian/push-guardian-details-edit/<guardian._id>?_method=PUT">` wrapping everything.
- **Section "Edit Parent / Guardian Info"** (subtitle "Update a parent's / guardian's information"), fields all pre-filled from `guardian`:

| Label | name/id | Type | Required | Notes |
|---|---|---|---|---|
| Parent / Guardian First Name | `guardianFirstName` | text | yes | value=`guardian.guardianFirstName` |
| Parent / Guardian Last Name | `guardianLastName` | text | yes | |
| Parent / Guardian Address | `guardianStreetAddress` | text | yes | full width |
| City | `guardianCity` | text | yes | |
| State / Province | `guardianState` | select | yes | 57 options in exact order: `AL,AK,AZ,AR,AS,CA,CO,CT,DE,DC,FL,GA,GU,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,CM,OH,OK,OR,PA,PR,RI,SC,SD,TN,TX,TT,UT,VT,VA,VI,WA,WV,WI,WY` (includes territories; `CM` and `TT` are archaic codes). Current `guardian.guardianState` rendered `selected`; if stored value isn't in the list, nothing is selected and browser defaults to `AL` — saving would silently change the state. |
| ZIP / Postal Code | `guardianZIP` | **number** | yes | stored as String; number input drops leading zeros (bad for e.g. `02134`) |
| Phone Number (i.e. 423-926-2221) | `phoneNumber` (id `phone-number`) | tel, `pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"` | yes | client-side pattern only |

- **Section "Assigned Students"** (subtitle "Update this parent / guardian's relationship and pickup permission for each assigned student."): one bordered card per `assignedStudents[i]`:
  - "Student": disabled text input showing `studentName` (display-only, not submitted).
  - "Relationship to Student": text input, **required**, `name="relationshipToStudent_<studentId>"`, value pre-filled.
  - "Authorized for Pickup": checkbox `name="authorizedToPickUp_<studentId>"`, `checked` iff currently true; label "Allow pickup for `<studentName>`".
  - If `assignedStudents` empty: dashed box "No assigned students available to edit."
- **"Unresolved Student Links"** amber warning panel, rendered only if `danglingStudentLinks.length > 0`: explains links "could not be matched to an active student record… will be preserved unchanged"; per link shows monospace `studentId`, "Relationship: `<value or 'Not set'>`", "Authorized for pickup: Yes/No". Read-only.
- Footer buttons: **Cancel** (link → `/guardian/details/<guardian._id>`; note it's an `<a>` wrapping a `<button type="button">`) and **Submit** (submits form → R5 → redirect to details).

### 4.3 `registration-guardian.ejs` — "Add Parent / Guardian" (R1 → posts R2)

- H1 (centered): **"Add Parent / Guardian"**. No header partial.
- Intro card: "Parent / Guardian Info" / "Add a parent / guardian for `<studentFirstName> <studentLastName>`".
- **Existing-guardian picker** (outside the form): label "Parent / Guardian List (Select a Parent / Guardian from previously created Parents / Guardians)".
  - Button "List of Parents / Guardians ▼" — Flowbite dropdown (`data-dropdown-toggle="dropdownGuardianNames"`) revealing panel `#dropdownGuardianNames` containing:
    - Search input `#guardianNameSearch` (placeholder "Guardian Name") with `onkeyup`/`oninput` → global `searchFilterGuardians()` (in `public/js/main.js`): client-side case-insensitive substring filter that hides `<li>`s whose first `<a>`'s text doesn't contain the query. **Bug:** the "NO OTHER…" placeholder `<li>` contains no `<a>`, so typing anything while the list is empty throws a TypeError (`a` is undefined) and the filter silently breaks.
    - If `guardianSelected !== 'new-guardian'`: a pinned `<li>` at top showing the currently selected guardian's name in bold with a check icon (its `<a href="#">` is inert).
    - One `<li>` per `guardiansFiltered[i]`: link → `/guardian/registration-guardian/<student._id>/<guardiansFiltered[i]._id>` (full page reload with that guardian selected), text `guardianFirstName + ' ' + guardianLastName`. All `<li>`s share duplicate `id="option-0"` (invalid HTML, harmless).
    - If `guardiansFiltered` empty: `<li>` "NO OTHER PARENTS / GUARDIANS AVAILABLE".
    - Always: final link "**+ New Guardian**" → `/guardian/registration-guardian/<student._id>/new-guardian` (switches back to blank new-guardian mode).
- **Form** `method="POST" action="/guardian/push-register-new-guardian/<student._id>/<guardianID>"`:
  - **Mode A — `guardianSelected === 'new-guardian'`** (blank, editable Guardian Info):
    - Same 7 fields as the edit view (`guardianFirstName`, `guardianLastName`, `guardianStreetAddress` — label here is "Parent / Guardian's Address", `guardianCity`, `guardianState` select with same 57-state list, `guardianZIP` number, `phoneNumber` tel with same pattern), all `required`, all empty except the state select which pre-selects **`TN`** (business default: Tennessee daycare).
  - **Mode B — existing guardian selected**: the same 7 fields rendered `disabled` (grey `bg-gray-200`), pre-filled from `guardianSelected`, so they are NOT submitted; only the link fields below are. (State-select rendering bug in this mode: the loop renders `guardianSelected.guardianState` as the selected option *in TN's slot*, so if the guardian's state ≠ TN it appears twice and TN never appears — cosmetic only since the control is disabled.)
  - **"Additional Info" section** (both modes):
    - "Relationship to Student": text input, `name="relationshipToStudent"`, id `relationship-to-student`, **required**.
    - Checkbox `name="authorized-to-pick-up"` (id `authorized-to-pick-up`), default **checked**, label "Authorized to Pick Up `<studentFirstName> <studentLastName>`". **Ignored by the server** (see R2 step 4) — value is always saved as `true`.
  - Footer: **Cancel** (link → `/student/details/<student._id>`) and **Submit**.

### 4.4 `profile-parent.ejs` — Parent Profile (see §5)

- Includes `partials/navigation-parent` (Dashboard `/dashboard/<user.id>`, Students `/student/students-summary`, Parent Profile `/profile/<user.id>`, Logout) — no header partial.
- H1 (centered): `<%= user.accountType.toUpperCase() %> PROFILE` → renders "**PARENT PROFILE**".
- Card with a form: heading "Profile", subtitle "Change your profile information".
- **The entire form is non-functional (placeholder UI):** `action="#" method=""`, no field is pre-filled with the user's current data, and no route exists to process a submission (Save just navigates to `#` via default GET). Cancel is `type="button"` and does nothing.
- Fields (all optional, all empty):

| Label | name/id | Type | Notes |
|---|---|---|---|
| First name | `first-name` | text | autocomplete="given-name"; kebab-case name does NOT match User field `firstNameApp` |
| Last name | `last-name` | text | autocomplete="family-name" |
| Date Of Birth | `date-of-birth` | date | |
| Phone Number | `phone-number` | tel | |
| Email | `email` | email | |

- Buttons: Cancel (inert), Save (submits nowhere).

---

## 5. Parent Profile route (context from `controllers/home.js` / `routes/index.js`)

- `GET /profile/:id` — `ensureAuth` → `homeController.getProfile`.
- **The `:id` path param is completely ignored.** The controller switches on `req.user.accountType`:
  - `'parent'` → render `profile-parent.ejs` (no data passed; view reads global `user` local)
  - `'teacher'` → `profile-teacher.ejs` (**file does not exist** — render throws → hang)
  - `'admin'` → `profile-admin.ejs` (**file does not exist** — same)
  - any other/unset accountType → no branch taken → request hangs with no response.
- Re-implementation: a parent profile endpoint should return/update the authenticated user's own record (`firstNameApp`, `lastNameApp`, `dateOfBirth`, `phoneNumber`, `emailAddress`) and actually persist edits — the legacy page never did.

---

## 6. Business Rules Summary

1. **Guardians exist only in the context of students.** The only creation path is from a student's page; a new guardian is always born with exactly one student link. There is no standalone guardian list page, no guardian search page, and no orphan-guardian creation.
2. **One guardian, many students; one student, many guardians.** Many-to-many, stored solely as `guardian.students[]` link objects.
3. **A guardian may be linked to a student at most once** — enforced only by UI filtering (dropdown excludes already-linked guardians), not by the server.
4. **`authorizedToPickUp` defaults to true at link creation** (hardcoded server-side, checkbox ignored) and can only be turned off later via the guardian edit page.
5. **`relationshipToStudent`** is free text, required in both forms; on edit, blank submissions preserve the previous value.
6. **No deletion:** guardians can never be deleted; guardian↔student links can never be removed. Deleting a student (`Student.deleteOne` in `controllers/student.js`) does **NOT** cascade — it leaves dangling `guardian.students[]` entries pointing at missing students. The details page renders blank rows for them; the edit page surfaces them in the "Unresolved Student Links" panel and preserves them on save. Re-implementation should either cascade-remove links on student deletion or provide explicit link removal (recommended fix), while remaining tolerant of dangling data during migration.
7. **Guardian lists sort by `guardianFirstName` ascending** (MongoDB collation-less, case-sensitive; no last-name tiebreak).
8. **Address format** for display: `street, city, STATE ZIP`. State default for new guardians: `TN`. Phone display/entry convention: `NNN-NNN-NNNN` (client-side pattern only).
9. **Redirect conventions:** create/link → back to `/student/details/:studentId`; edit save → `/guardian/details/:guardianId`; unauthenticated → `/`.
10. Derived student values on the details page: `formatDate(dateOfBirth)` (string split of `YYYY-MM-DD` → `MM/DD/YYYY` with leading zeros preserved) and `convertAge(dateOfBirth)` (year ≈ 365 days; `< 1 month` ⇒ `floor(age*52)` "weeks old"; otherwise `floor(age*12)` "months old" — always months, never years).

---

## 7. Quirks & Bugs (preserve vs. fix)

| ID | Quirk / Bug | Recommendation |
|----|-------------|----------------|
| Q1 | No role checks: any authenticated user (parent/teacher) can view/edit/create guardians via URL; guardian views always show the admin navbar. | **Fix**: restrict guardian CRUD to admins. |
| Q2 | R2 hardcodes `authorizedToPickUp: true`; the form checkbox `authorized-to-pick-up` is ignored. | **Fix**: honor the checkbox (default checked). |
| Q3 | No duplicate-link guard server-side; direct POST can link the same guardian to a student twice. | **Fix**: enforce uniqueness of `(guardian, student)`. |
| Q4 | No guardian delete and no link removal anywhere; Delete/"+ Add Guardian" buttons exist commented-out in `guardian-details.ejs`. | **Fix**: add delete + link removal in the new API (product decision), or at minimum keep parity and document. |
| Q5 | Student deletion leaves dangling guardian links (no cascade). Edit page tolerates and preserves them; details page shows blank `<tr>`s. | **Fix** cascade going forward; keep tolerance for legacy dangling data. |
| Q6 | Error handling: every catch only logs; `res.render('error/500')` commented out → requests hang on any error (bad ObjectId, missing doc, validation failure). | **Fix**: proper 400/404/500 responses. |
| Q7 | `GET /profile/:id` ignores `:id`; `profile-teacher.ejs`/`profile-admin.ejs` don't exist (render error → hang for those roles). | **Fix**: profile is "current user"; implement per-role responses. |
| Q8 | Parent profile form is a dead stub: `action="#"`, empty `method`, no pre-filled values, kebab-case field names (`first-name`, etc.) matching nothing in the User model, no handler route. | **Fix**: implement a real self-profile read/update. |
| Q9 | `guardianZIP` stored as String but input is `type="number"` (leading zeros lost; ZIP+4 impossible). | **Fix**: text input / string validation. |
| Q10 | Guardian sort is first-name only, case-sensitive byte order. | **Fix**: sort case-insensitively by first+last name (or keep parity if exact ordering matters). |
| Q11 | `searchFilterGuardians()` throws when a `<li>` has no `<a>` (the "NO OTHER PARENTS / GUARDIANS AVAILABLE" row), breaking the dropdown filter. Filter also matches against the pinned selected-guardian row and the "+ New Guardian" anchor (that anchor is outside any `<li>` so it's never hidden). | Fix naturally in the SPA (proper typeahead). |
| Q12 | Existing-guardian mode state `<select>` renders the guardian's state in TN's slot: state duplicated / TN missing when state ≠ TN. Harmless (control disabled). | Fix naturally. |
| Q13 | State option list includes archaic codes `CM` and `TT` (plus territories `AS`, `GU`, `PR`, `VI`, `DC`, `TT`) in a fixed non-alphabetical-at-the-end order. | Re-implementer's choice; keep the value set for data compatibility. |
| Q14 | `guardian-details.ejs`: stray `</a>` in pickup cell; duplicate `id="option-0"` on all dropdown `<li>`s in registration view; empty-state row has bogus `col-span-4` class on a `<td>`. | Fix naturally. |
| Q15 | Controller comments claim wrong route paths (`register-new-guardian` vs. real `registration-guardian`; comment on R5 says "PUT" route path without noting method-override). | Informational. |
| Q16 | Dead code: `guardiansAll` fetched in R2 but unused; `User`/`Classroom` imports unused in `controllers/guardian.js`; `guardiansAll`/`guardiansStudent` passed to registration view but unused. | Drop. |
| Q17 | R3 fetches students with a sequential N+1 `findById` loop; R4/R5 use batched `$in` queries. | Use batched queries everywhere. |
| Q18 | `students` array is schemaless (Mixed): no ObjectId casting, no required fields on links. Legacy data may contain surprises. | **Fix**: typed subdocument/junction table; migrate defensively. |
| Q19 | `convertAge` never switches to years ("62 months old" for a 5-year-old); `formatDate` throws if passed a real `Date` object (only safe for falsy or `YYYY-MM-DD` strings) — works here because `dateOfBirth` is a String. | Product decision; at least keep weeks/months buckets for infants/toddlers. |
| Q20 | `guardian-details.ejs` includes the "Hello, name / date" header partial; the edit and registration pages do not. | Cosmetic parity choice. |
| Q21 | Edit save cannot blank a relationship (empty string keeps old value server-side). | Keep or fix; form requires the field anyway. |
| Q22 | If a guardian's stored `guardianState` isn't in the 57-option list, the edit select silently falls back to `AL` and saving overwrites the state. | Fix with proper select binding. |

---

## 8. Re-implementation Sketch (REST mapping)

| Legacy | Suggested REST |
|---|---|
| R1 (page data) | `GET /students/:studentId` + `GET /guardians?availableForStudent=:studentId` (list minus already-linked) |
| R2 new-guardian branch | `POST /guardians` body `{ ...personalFields, link: { studentId, relationshipToStudent, authorizedToPickUp } }` (or `POST /students/:id/guardians`) |
| R2 existing-guardian branch | `POST /guardians/:id/students` body `{ studentId, relationshipToStudent, authorizedToPickUp }` (409 on duplicate) |
| R3 | `GET /guardians/:id` (embed links with resolved student name/dob/age; include dangling links flagged) |
| R4/R5 | `PATCH /guardians/:id` (personal fields) + `PATCH /guardians/:id/students/:studentId` (relationship/pickup) |
| missing | `DELETE /guardians/:id/students/:studentId`, `DELETE /guardians/:id` (new capabilities) |
| Parent profile | `GET /me` / `PATCH /me` (firstNameApp, lastNameApp, dateOfBirth, phoneNumber, emailAddress) |

Guardian routes: admin-only. Parent profile: any authenticated user, self-scoped.
