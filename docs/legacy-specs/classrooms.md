# Feature Spec: Classrooms

Legacy source: Express/EJS/Mongoose app at `jckc-web-app-private`.
Files covered: `controllers/classroom.js`, `routes/classroom.js`, `views/classrooms-summary.ejs`, `views/classrooms-details.ejs`, `views/classrooms-details-edit.ejs`, `views/classrooms-add-new.ejs`, `views/classrooms-student-list-edit.ejs`, plus supporting code they depend on (`app.js` view helpers, `models/Classroom.js`, `models/Student.js`, `middleware/auth.js`, `views/partials/pagination-classroom.ejs`).

---

## 1. Data Model

### 1.1 Classroom (`models/Classroom.js`, Mongoose model name `Classroom`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `classroomName` | String | yes (schema `required: true`) | — | Free text, no uniqueness constraint. Duplicate names allowed. |
| `ageGroup` | String | yes (schema `required: true`) | — | **No enum in the schema.** UI restricts to `'infant' | 'toddler' | 'preschool'` (lowercase), but the DB will accept any string. |
| `teacherName` | String | no (schema) | — | HTML form marks it `required`, but the schema does not. A single free-text name — NOT a ref to a User/teacher entity. |
| `createdAt` | Date | no | `Date.now` | Never displayed anywhere in the classroom views. |

No `students` array on Classroom. Membership lives entirely on the Student side.

### 1.2 Student fields relevant to classrooms (`models/Student.js`)

| Field | Type | Notes |
|---|---|---|
| `studentFirstName` | String, required | Used for sorting and search. |
| `studentLastName` | String, required | Used for search. |
| `dateOfBirth` | **String**, required | Stored as a string (HTML date input format `YYYY-MM-DD`), *not* a Date. Age math does `new Date(dateOfBirth)`. |
| `ageGroup` | String, optional | `'infant' | 'toddler' | 'preschool'`. **Recomputed and written only when a student is added to a classroom** (see §3.7). Never cleared on removal → can go stale. |
| `classroom` | ObjectId ref `"Classroom"`, optional | `null`/missing ⇒ unassigned. Each student belongs to at most one classroom. |
| `teacherName` | String, optional | Exists on the schema but is NEVER written or read by the classroom feature (dead field here). |

### 1.3 Auth model

- `middleware/auth.js` exports `ensureAuth`: if `req.isAuthenticated()` → `next()`, else **redirect to `/`** (the login/landing page). No JSON 401, no roles/permissions of any kind — any logged-in user can do everything.
- All classroom routes use `ensureAuth`. There are no role restrictions anywhere in the app.
- Router is mounted at `/classroom` (`app.use('/classroom', require('./routes/classroom'))` in `app.js`).
- App uses `method-override` with query key `_method`, so HTML forms `POST` to `...?_method=PUT` to reach PUT handlers.

---

## 2. Routes (all prefixed `/classroom`, all `ensureAuth`)

| # | Method | Path | Controller fn | Purpose |
|---|---|---|---|---|
| 1 | GET | `/classroom/classrooms-summary` | `getClassroomsSummary` | List all classrooms (card grid). |
| 2 | GET | `/classroom/classrooms-add-new` | `getClassroomsAddNew` | Render "Add New Classroom" form. |
| 3 | POST | `/classroom/push-classrooms-add-new` | `pushClassroomsAddNew` | Create classroom, redirect to summary. |
| 4 | GET | `/classroom/details/:id` | `getClassroomsDetails` | Classroom detail page + assigned-students table. |
| 5 | GET | `/classroom/edit/:id` | `getClassroomsDetailsEdit` | Render "Edit Classroom Details" form. |
| 6 | PUT | `/classroom/push-classroom-details-edit/:id` | `pushClassroomsDetailsEdit` | Update classroom, redirect to details. |
| 7 | GET | `/classroom/edit-student-list/:id` | `getClassroomsStudentListEdit` | Dual-pane Add/Remove students page (paginated + searchable). |
| 8 | PUT | `/classroom/push-student-list-add/:id` | `pushClassroomsStudentListAdd` | Assign selected students to classroom (+ recompute their `ageGroup`). |
| 9 | PUT | `/classroom/push-student-list-remove/:id` | `pushClassroomsStudentListRemove` | Unassign selected students (`classroom = null`). |

**There is NO delete-classroom route.** Classrooms can never be deleted through the UI or API. (Decide in re-implementation whether to add one; if added, it must handle orphaned `student.classroom` refs.)

### Error handling — global quirk
Every controller wraps its body in `try/catch`; the `catch` only does `console.error(error)` / `console.log(error)` and the `res.render('error/500')` line is **commented out in every handler**. Consequence: on any error (bad ObjectId in `:id`, missing document, invalid regex from search input, DB failure) **the request hangs with no response sent** until the client times out. Re-implementation should FIX this: return proper 400/404/500 responses.

Passing a malformed `:id` (not a 24-char hex string) makes `findById` throw a `CastError` → caught → hang. Passing a well-formed but nonexistent id returns `null`, and the views then throw on `classroom.classroomName` etc. (EJS render error) → also effectively broken. Re-implementation: 404 on not-found.

---

## 3. Route-by-route behavior

### 3.1 GET `/classroom/classrooms-summary`
1. `const students = await Student.find()` — **loads every student in the DB** (no filter, no projection, no `.lean()`).
2. `const classrooms = await Classroom.find()` — all classrooms, no sort at query level (sorted in the view, see §4.1).
3. Renders `classrooms-summary.ejs` with `{ classrooms, students }`.
4. Per-classroom student counts are computed **in the view**: `students.filter(child => child.classroom == e.id).length` — a loose `==` comparing an ObjectId to the string virtual `id`; works because of ObjectId `toString` coercion, but it is O(classrooms × students). Re-implementation: use an aggregate/count per classroom (fix, keep behavior).

### 3.2 GET `/classroom/classrooms-add-new`
Renders the static form `classrooms-add-new.ejs`. No data loaded. (Its doc-comment block is correct; note the copy-pasted comment bug on route 4, §5.)

### 3.3 POST `/classroom/push-classrooms-add-new`
1. `Classroom.create({ classroomName: req.body.classroomName, ageGroup: req.body.ageGroup, teacherName: req.body.teacherName })`.
2. `console.log("New Classroom Created!")`.
3. `res.redirect('/classroom/classrooms-summary')`.

Server-side validation: only what Mongoose enforces (`classroomName` and `ageGroup` required). `ageGroup` value is NOT checked against the enum — a crafted request can store any string. `teacherName` may be empty/undefined server-side. Re-implementation: validate `ageGroup ∈ {infant, toddler, preschool}` and require non-empty `classroomName`; decide whether `teacherName` is required (HTML said yes, schema said no — recommend required to match UI).

### 3.4 GET `/classroom/details/:id`
1. `const classroom = await Classroom.findById(req.params.id)`.
2. `const students = await Student.find({ classroom: req.params.id })` — all students assigned to this classroom, unsorted at query level, no pagination (sorted in view by first name, §4.2).
3. Renders `classrooms-details.ejs` with `{ classroom, students }`.

### 3.5 GET `/classroom/edit/:id`
1. `Classroom.findById(req.params.id)`.
2. Renders `classrooms-details-edit.ejs` with `{ classroom }`.

### 3.6 PUT `/classroom/push-classroom-details-edit/:id`
1. `Classroom.findOneAndUpdate({ _id: req.params.id }, { classroomName, ageGroup, teacherName })` — values straight from `req.body`. **`runValidators` is not set**, so Mongoose `required` validators do NOT run on update: an empty `classroomName` can be persisted via a direct request (HTML `required` is the only guard). Nonexistent id → update matches nothing, no error, still redirects.
2. `console.log("Classroom Info Updated!")`.
3. `res.redirect('/classroom/details/' + req.params.id)`.

Note: changing a classroom's `ageGroup` does **not** touch any assigned students' `ageGroup` — no cascade.

### 3.7 GET `/classroom/edit-student-list/:id` — the Add/Remove page

Constants: `PAGE_SIZE = 10`.

Query params (all optional):
- `addPage` — page of the "Add Students" list. Parsed `Math.max(1, parseInt(req.query.addPage) || 1)` (non-numeric/`0`/negative → 1).
- `removePage` — same for "Remove Students" list.
- `addSearch` — search string for the Add list (default `''`).
- `removeSearch` — search string for the Remove list (default `''`).

Steps:
1. `Classroom.findById(req.params.id)` → `classroom`.
2. **Add list** (candidates = unassigned students):
   - Filter: `{ classroom: null }` — in MongoDB this matches both `classroom: null` and documents where the field is missing entirely (intentional/required behavior).
   - If `addSearch` non-empty, add `$or: [{ studentFirstName: { $regex: addSearch, $options: 'i' } }, { studentLastName: { $regex: addSearch, $options: 'i' } }]` — case-insensitive **substring** match (`$regex` unanchored). ⚠ The user input is used as a raw regex — no escaping. Special chars (`(`, `*`, etc.) either behave as regex or throw (→ hung request per §2). Re-implementation: FIX — escape the input (treat as literal substring).
   - `addTotalCount = Student.countDocuments(addFilter)`.
   - `addTotalPages = Math.max(1, Math.ceil(addTotalCount / 10))` (never 0 pages).
   - `safeAddPage = Math.min(addPage, addTotalPages)` — clamps an out-of-range requested page down to the last page.
   - Query: `Student.find(addFilter).sort({ studentFirstName: 1 }).skip((safeAddPage - 1) * 10).limit(10)` — **sorted by first name only** (case-sensitive, byte-order Mongo sort; ties in first name have nondeterministic order — no secondary sort key).
   - Pagination object: `{ currentPage: safeAddPage, totalPages, totalCount, pageSize: 10, startIndex: totalCount > 0 ? (safeAddPage-1)*10 + 1 : 0, endIndex: Math.min(safeAddPage*10, totalCount), hasPrevious: safeAddPage > 1, hasNext: safeAddPage < totalPages }`.
3. **Remove list** (students currently in this classroom): identical logic with filter `{ classroom: req.params.id }`, params `removePage`/`removeSearch`, producing `removeStudents` + `removePagination`.
4. Renders `classrooms-student-list-edit.ejs` with `{ classroom, addStudents, removeStudents, addPagination, removePagination, currentAddPage: safeAddPage, currentRemovePage: safeRemovePage, currentAddSearch: addSearch, currentRemoveSearch: removeSearch }`.

**Important business rule (or lack thereof):** the Add list shows ALL unassigned students of every age, with no filtering or warning against the classroom's `ageGroup`. An infant can be assigned to a preschool room. The page header displays the classroom's age group purely as information for the operator.

### 3.8 PUT `/classroom/push-student-list-add/:id`

Request shape: the **body keys are the student ObjectIds to add** (urlencoded, each key's value is `'on'`, e.g. `64ab...ef=on&64cd...12=on`). Query params carry UI state: `addPage`, `removePage`, `addSearch`, `removeSearch` (plus `_method=PUT` for method-override).

Steps:
1. `PAGE_SIZE = 10`; `classroom = Classroom.findById(req.params.id)`.
2. Parse `addPage`/`removePage` as `parseInt(...) || 1` (note: **no `Math.max(1, ...)` clamp here**, unlike the GET — a negative value would pass through, but the subsequent GET clamps it anyway) and `addSearch`/`removeSearch` defaulting `''`.
3. `const studentIds = Object.keys(req.body)` — **every body key is treated as a student id, with zero validation.** For each id, sequentially (`for...of` with awaits):
   - `student = await Student.findById(studentId)` (a bogus key → CastError → caught → hung request; a valid-format-but-missing id → `student` is `null` → `student.dateOfBirth` throws → same).
   - Compute age in years: `age = (Date.now-ish today − new Date(student.dateOfBirth)) / 1000/60/60/24/365` (365-day year, ignores leap years).
   - Derive **student** age group (age is in years, so `age * 12` = age in months):
     - `age * 12 < 11` → `'infant'`
     - `age * 12 < 30` → `'toddler'`
     - else → `'preschool'`
     (Boundaries: infant = under 11 months; toddler = 11 to <30 months; preschool = 30+ months. Same formula as the `calcAgeGroup` view helper in `app.js`.)
   - `Student.findOneAndUpdate({ _id: studentId }, { ageGroup: <derived>, classroom: classroom.id })` — sets both fields. Note `classroom.id` (string) is cast by Mongoose to ObjectId. If the student was already in another classroom this silently **moves** them (though the UI only offers unassigned students, a stale/forged request can move an assigned student).
4. Recompute the Add-list page clamp so the redirect doesn't land on a now-empty page: rebuild `addFilter = { classroom: null }` (+ the same `addSearch` `$or` regex), `remainingAddCount = countDocuments`, `maxAddPage = Math.max(1, Math.ceil(remainingAddCount / 10))`, `safeAddPage = Math.min(addPage, maxAddPage)`.
5. `console.log('Students added to classroom!')`.
6. Redirect: `/classroom/edit-student-list/:id?addPage=<safeAddPage>&removePage=<removePage>&addSearch=<encodeURIComponent(addSearch)>&removeSearch=<encodeURIComponent(removeSearch)>` — note `removePage` is passed through **unclamped** (the GET clamps it again, so harmless).

Submitting with nothing selected: body is empty → loop over `[]` → no-op, still recounts and redirects.

### 3.9 PUT `/classroom/push-student-list-remove/:id`

Same request shape (body keys = student ids; query carries `addPage`, `removePage`, `addSearch`, `removeSearch`).

Steps:
1. `PAGE_SIZE = 10`; parse the four query params (`parseInt(...) || 1`, `|| ''`). **Never loads the classroom** and never verifies the students being removed actually belong to `:id` — any student id in the body is unassigned globally.
2. For each `studentId` of `Object.keys(req.body)`: `Student.findOneAndUpdate({ _id: studentId }, { classroom: null })`. **`ageGroup` is NOT cleared** — the student keeps the age group computed at their last assignment (goes stale as they age; it is recomputed on next add).
3. Recompute Remove-list clamp: `removeFilter = { classroom: req.params.id }` (+ `removeSearch` `$or` regex), `remainingRemoveCount`, `maxRemovePage = Math.max(1, ceil(count/10))`, `safeRemovePage = Math.min(removePage, maxRemovePage)`.
4. `console.log('Students removed from classroom!')`.
5. Redirect: `/classroom/edit-student-list/:id?addPage=<addPage>&removePage=<safeRemovePage>&addSearch=...&removeSearch=...` (here `addPage` is passed through unclamped; again the GET re-clamps).

---

## 4. View helpers (defined as `app.locals.*` in `app.js`) used by classroom views

- **`properNoun(name)`**: `name.toLowerCase()` then uppercase first char. `'infant'` → `'Infant'`. Throws on empty string (never happens because `ageGroup` is required).
- **`formatDate(date)`**: if `date` is a string (the normal case — `dateOfBirth` is stored `'YYYY-MM-DD'`), splits on `'-'` and returns `` `${month}/${day}/${year}` `` — i.e. `'2023-04-09'` → `'04/09/2023'` (**leading zeros preserved**, so it's `MM/DD/YYYY` as stored). If called with no argument (falsy), returns today's date as `M/D/YYYY` (no padding) — used in the shared header partial. **BUG:** if passed a truthy non-string (e.g. a real `Date`), `dateToFormat` is never assigned → `TypeError`. Not hit by classroom views (they always pass the string `dateOfBirth`), but do not replicate the bug.
- **`convertAge(birthday)`**: `age = (today − new Date(birthday)) / 1000/60/60/24/365` years. If `age*12 < 1` → `` `${Math.floor(age*52)} week${s} old` `` else `` `${Math.floor(age*12)} month${s} old` ``. Always months, even for older kids (e.g. a 4-year-old shows as `"48 months old"`). Pluralization: `'s'` appended only when value `> 1`, so `0` renders as `"0 week old"` / `"0 month old"` (grammar bug at 0; a newborn shows `"0 week old"`). Re-implementation: preserve month-based display (it's a daycare) but you may fix the `0`-pluralization; flagged as cosmetic.
- **`calcAgeGroup(birthday)`**: same infant/<11mo, toddler/<30mo, preschool formula as §3.8 — exists as a helper but the classroom controller re-implements the identical logic inline instead of calling it.
- **`sortClassrooms(objArray)`** (used only by classrooms-summary):
  ```js
  objArray.sort((a,b) => a.classroomName.localeCompare(b.classroomName))
    .sort((a,b) => {
      if ((a.ageGroup=='infant' && b.ageGroup=='toddler') || (a.ageGroup=='toddler' && b.ageGroup=='preschool')) return -1
      else if ((a.ageGroup=='preschool' && b.ageGroup=='toddler') || (a.ageGroup=='toddler' && b.ageGroup=='infant')) return 1
      else return 0
    })
  ```
  Intent: order groups infant → toddler → preschool, alphabetical by `classroomName` within each group (the first sort is stable in Node, so within-group name order survives the second sort *when the second comparator behaves*). **BUG:** the second comparator returns `0` for `infant` vs `preschool` — it is **not transitive**, so with certain mixes of the three groups the final order can interleave groups incorrectly (e.g. a preschool room can sort before an infant room if no toddler comparison forces them apart). Also any classroom whose `ageGroup` is not one of the three strings always compares `0`. Re-implementation: FIX with an explicit rank map `{infant: 0, toddler: 1, preschool: 2}` then `classroomName` ascending — that is clearly the intended order.
- **`sortName(objArray)`** (used by classrooms-details): sorts students by `studentFirstName.localeCompare(...)` — **first name only**, no last-name tiebreak (ties keep query order, which is unspecified). This matches the Mongo sort used in the student-list-edit page (`{ studentFirstName: 1 }`), though `localeCompare` vs Mongo byte-order can disagree on case/accents. Re-implementation: pick one collation; recommend case-insensitive first-name then last-name.

Shared layout note: every classroom view includes `partials/dashboard-head` (HTML head/Tailwind), `partials/navigation-admin` (indigo top nav with admin links + logout + mobile hamburger), and `partials/dashboard-close-tag`. Summary and details also include `partials/header` ("Hello, `<user.firstNameApp>`!" + today's date via `formatDate()`); the add-new, details-edit, and student-list-edit pages do NOT include the header partial.

---

## 5. UI spec per view

### 5.1 `classrooms-summary.ejs` — "Classrooms Summary"

- Layout: nav + greeting header + centered `<h1>Classrooms Summary</h1>`; section heading "Classrooms".
- Top-right button/link: **"+ New Classroom"** → `GET /classroom/classrooms-add-new` (indigo button style).
- Body: if `classrooms.length > 0`, a responsive card grid (1 col mobile / 2 sm / 3 lg), iterating `sortClassrooms(classrooms)` (see §4 sort semantics). Each card shows:
  - Classroom name as a link → `/classroom/details/<id>`.
  - A green pill badge with `properNoun(ageGroup)` (e.g. "Infant").
  - Line: `Teacher: <teacherName>`.
  - Line: `No. of Students: <count>` where count = `students.filter(child => child.classroom == e.id).length` (computed in-view from the full student list).
  - A 16×16 colored square with the first 3 letters of the age group uppercased (`e.ageGroup.substring(0,3).toUpperCase()` → `INF` / `TOD` / `PRE`). Background color: `infant` → `bg-pink-600`, `toddler` → `bg-yellow-500`, anything else (incl. preschool) → `bg-green-500`.
  - Card footer: two half-width links — **"Details"** → `/classroom/details/<id>` and **"Edit"** → `/classroom/edit/<id>`.
- If no classrooms: plain text **"No Classrooms Available"**.
- No pagination, no search on this page.

### 5.2 `classrooms-details.ejs` — "Classroom Details"

- Layout: nav + greeting header + centered `<h1>Classroom Details</h1>`. Two-panel 12-col grid: left (md 5/12) "Classroom Info" card, right (md 7/12) "Assigned Students" card; both full-width stacked on mobile.
- **Classroom Info card**: heading "Classroom Info", top-right **"Edit Info"** button → `/classroom/edit/<classroom.id>`. Definition list rows:
  1. "Classroom Name" → `classroom.classroomName`
  2. "Age Group" → green pill with `properNoun(classroom.ageGroup)`
  3. "Teacher" → `classroom.teacherName`
- **Assigned Students card**: heading "Assigned Students", top-right **"Edit Student List"** button → `/classroom/edit-student-list/<classroom.id>`. Table columns:
  | Column | Content | Notes |
  |---|---|---|
  | Name | link → `/student/details/<student.id>`, text `studentFirstName + ' ' + studentLastName` | On small screens (`lg:hidden`) a sub-line shows `DOB: <formatDate(dateOfBirth)>` beneath the name (and a `sr-only` `<dt>` oddly contains the date too). |
  | DOB | `formatDate(dateOfBirth)` (`MM/DD/YYYY`) | Hidden below `lg` breakpoint. |
  | Age | `convertAge(dateOfBirth)` (e.g. "18 months old") | Always visible. |
  | (Edit) | link "Edit" → `/student/edit/<student.id>` | `sr-only` header "Edit". |
- Rows iterate `sortName(students)` (first-name ascending). Full list, **no pagination and no search** on this page.
- Empty state: a table row whose first cell reads **"No Assigned Students Available"** (followed by 4 stray empty `<td>`s — one more cell than there are columns; harmless markup bug, don't preserve).

### 5.3 `classrooms-add-new.ejs` — "Add New Classroom"

- Layout: nav (no greeting header) + centered `<h1>Add New Classroom</h1>`; white card with form heading "New Classroom Form" and subtitle "Add new classroom for the daycare".
- Form: `method="POST"`, `action="/classroom/push-classrooms-add-new"` (plain POST, no method override).
- Fields:
  | Label | name / id | Type | Required (HTML) | Options / default |
  |---|---|---|---|---|
  | Classroom Name | `classroomName` | text | yes | — |
  | Age Group | `ageGroup` | select | yes | `infant` (label **"Infant/Toddler"**, `selected` default), `toddler` (label "Toddler"), `preschool` (label "Preschool") |
  | Teacher Name | `teacherName` | text | yes | — |
- ⚠ Label quirk: the `infant` option is labeled **"Infant/Toddler"** on this form only; the edit form labels it "Infant" (via `properNoun`). Almost certainly a leftover; recommend FIX to a consistent "Infant" unless the daycare genuinely calls that room "Infant/Toddler".
- Buttons (bottom right): **Cancel** — a `type="button"` wrapped in `<a href="/classroom/classrooms-summary">` — and **Submit** (`type="submit"`).

### 5.4 `classrooms-details-edit.ejs` — "Edit Classroom Details"

- Layout: nav (no greeting header) + centered `<h1>Edit Classroom Details</h1>`; card heading **"Edit Classroom Info"** with subtitle "Update a classroom's information".
- Form: `method="POST"`, `action="/classroom/push-classroom-details-edit/<classroom.id>?_method=PUT"` (method-override → PUT).
- Fields (all prefilled from the classroom):
  | Label | name | Type | Required (HTML) | Value/options |
  |---|---|---|---|---|
  | Classroom Name | `classroomName` | text | yes | `value="<classroom.classroomName>"` |
  | Age Group | `ageGroup` | select | yes | First option = current value, `selected`, labeled `properNoun(current)`; then the remaining values from `['infant','toddler','preschool']` excluding the current one, each labeled via `properNoun` ("Infant"/"Toddler"/"Preschool"). Net effect: current value pinned to top, others in canonical order. |
  | Teacher Name | `teacherName` | text | yes | `value="<classroom.teacherName>"` |
- Buttons: **Cancel** → `<a href="/classroom/details/<classroom.id>">` wrapping a button; **Submit** submits the form.
- Stray comment `<!-- Student Info -->` above the fields (copy-paste from a student form; ignore).

### 5.5 `classrooms-student-list-edit.ejs` — "Add / Remove Students"

- Layout: nav (no greeting header); full-height flex page (`h-screen` column) so the two lists scroll internally. Titles (all centered):
  - `<h1>` **Add / Remove Students**
  - `<h2>` **Classroom: `<classroom.classroomName>`**
  - `<h2>` **Age Group: `<properNoun(classroom.ageGroup)>`**
- Two side-by-side cards (md 6/12 each, stacked on mobile): left = **Add Students**, right = **Remove Students**. Each card is one `<form method="POST">`:
  - Add form id `addStudentsForm`, action `/classroom/push-student-list-add/<classroom.id>?addPage=<currentAddPage>&removePage=<currentRemovePage>&addSearch=<enc(currentAddSearch)>&removeSearch=<enc(currentRemoveSearch)>&_method=PUT`.
  - Remove form id `removeStudentsForm`, action `/classroom/push-student-list-remove/<classroom.id>?<same four params>&_method=PUT`.
  (Current page/search state is baked into the form action's query string so it survives submission.)

Each card, top to bottom:
1. **Header row**: legend "Add Students" / "Remove Students"; right side has a hidden-by-default selection counter `<span id="addSelectionCount">` ("N selected", indigo) and a hidden **Clear** button (`clearAddSelections` / `clearRemoveSelections`) — both shown only when ≥1 selection.
2. **Search input**: `id="addSearchInput"` / `id="removeSearchInput"`, placeholder **"Search by name..."**, magnifier icon at left, prefilled with the current search value. When a search is active, an "X" clear button (`clearAddSearch` / `clearRemoveSearch`) appears inside the input on the right. Behavior (client JS): on `input`, debounce **500 ms** then full-page navigate to a rebuilt URL; on Enter, navigate immediately; clear button navigates with empty search. The rebuilt URL **resets the searched table to page 1** and preserves the other table's current page and search: e.g. searching the add table goes to `/classroom/edit-student-list/<id>?addPage=1&removePage=<current>&addSearch=<enc(value)>&removeSearch=<enc(other)>`. ⚠ Because it's a full navigation, the input loses focus after every debounce tick — typing continuously is janky (SPA re-implementation naturally fixes this; do fix). Minor dead code: `buildSearchUrl` declares a 5th param `pageParam` that no caller passes.
3. **Student list** (scrollable): one row per student of the current page — a label `"<studentFirstName> <studentLastName>, <convertAge(dateOfBirth)>"` (e.g. "Ada Lovelace, 14 months old") with a checkbox on the right. Checkbox: `id="add-<studentId>"`/`id="remove-<studentId>"`, `data-student-id="<studentId>"`, class `add-checkbox`/`remove-checkbox`, **no `name` attribute initially** (see selection-persistence JS below).
   - Empty state text: if a search is active → **"No students match your search"**, else → **"No Students Available"**.
4. **Hidden inputs container** `#addHiddenInputs` / `#removeHiddenInputs` — populated by JS with off-page selections.
5. **Pagination bar** (partial `partials/pagination-classroom.ejs`; rendered only when `pagination.totalCount > 0`):
   - Left (sm+ only): "Showing **startIndex** to **endIndex** of **totalCount** students".
   - Right: "Page **currentPage** of **totalPages**" plus **Previous** / **Next**. Enabled ones are links to `/classroom/edit-student-list/<id>?<pageParam>=<currentPage±1>&<otherPageParam>=<otherPageValue>&<searchParam>=<enc(searchValue)>&<otherSearchParam>=<enc(otherSearchValue)>` — i.e. paging one table preserves the other table's page and both searches. Disabled ones render as gray non-clickable `<span>`s.
6. **Button row** (rendered only when that table's `totalCount > 0`): **Cancel** → `<a href="/classroom/details/<classroom.id>">` and **Add** (add form) / **Remove** (remove form) submit buttons. ⚠ Quirk: when a search yields 0 matches, `totalCount` is 0 so the submit button disappears even if the user has selections persisted from earlier pages — they must clear the search to submit. Cosmetic; recommend fixing in re-implementation.

**Selection persistence JS** (inline `<script>`, IIFE):
- `sessionStorage` keys: `` `classroom_<classroomId>_add_selections` `` and `` `classroom_<classroomId>_remove_selections` ``, each a JSON array of student id strings.
- On `DOMContentLoaded`, for each table: restore checked state for visible checkboxes whose ids are in storage; show the "N selected" counter and Clear button when N > 0; populate the hidden-inputs container with `<input type="hidden" name="<studentId>" value="on">` for every stored id whose checkbox is **not** on the current page (so off-page selections still submit).
- Checkbox change: add/remove the id in the stored array, re-render counter and hidden inputs.
- Clear button: empties the array, unchecks visible boxes, hides counter.
- On form submit: every **visible checked** checkbox gets `name = data-student-id` assigned (this is why they start nameless — unchecked boxes never submit anyway, but named-on-submit + hidden inputs is how the body ends up as `{<studentId>: 'on', ...}`), then that table's sessionStorage key is removed.
- Net protocol: **the PUT body is a flat urlencoded map whose KEYS are student ObjectIds** (values all `'on'`). The re-implemented REST API should replace this with an explicit `{ studentIds: [...] }` array — flagged as a FIX (the key-as-id protocol also means any unexpected body key is treated as a student id, see §3.8).
- Selections survive pagination and search navigations (sessionStorage), are scoped per classroom and per tab session, and are cleared on submit. They are NOT validated against the current filter — e.g. a student selected before a search remains selected while hidden.

---

## 6. Business rules summary

1. **Age-group taxonomy** (both classrooms and students): `infant`, `toddler`, `preschool` — lowercase strings; displayed via `properNoun` capitalization.
2. **Student age-group derivation** (only at assignment time): age in months = years×12 where years = ms-diff / (1000·60·60·24·365). `< 11` months → infant; `< 30` months → toddler; `≥ 30` → preschool.
3. **Age display**: under 1 month-equivalent (age×12 < 1) → floor(age×52) "week(s) old"; otherwise floor(age×12) "month(s) old" (never years).
4. **Classroom ordering** (summary page): intended infant → toddler → preschool, then classroomName A→Z within group (see §4 for the buggy comparator; fix with rank map).
5. **Student ordering**: first name ascending everywhere (details page via `localeCompare` in JS; student-list-edit via Mongo `sort({ studentFirstName: 1 })`). No last-name tiebreak.
6. **Assignment model**: student→classroom is a single nullable ref on Student; adding sets `classroom` + recomputes `ageGroup`; removing sets `classroom: null` and leaves `ageGroup` stale; no capacity limits; no age-group compatibility enforcement; a student can only be in one classroom.
7. **Pagination**: only on the student-list-edit page; page size 10; independent page + search state per pane, carried as 4 query params; requested pages clamped to `[1, totalPages]`; after add/remove the acting pane's page is re-clamped against the new count so you don't land on an empty page.
8. **Search**: case-insensitive substring against `studentFirstName` OR `studentLastName`; resets that pane to page 1; raw-regex injection bug to fix.
9. **Auth**: session-authenticated user required for everything; unauthenticated → redirect `/`; no roles.
10. **Dates**: `dateOfBirth` is a `YYYY-MM-DD` string; displayed as `MM/DD/YYYY` by string splitting (no timezone math on display; age math uses `new Date(string)` which parses as UTC midnight).

---

## 7. Quirks & bugs ledger (preserve vs fix)

| # | Item | Where | Recommendation |
|---|---|---|---|
| 1 | All error paths swallow the error and never respond (500 render commented out) → hung requests on bad ids, invalid regex, DB errors | every controller fn | FIX: proper 400/404/500 |
| 2 | No DELETE classroom route at all | routes | Decide: legacy parity = no delete; if adding, must null out `student.classroom` refs |
| 3 | `sortClassrooms` second comparator is non-transitive (infant vs preschool → 0) → group ordering can interleave | `app.js` | FIX with rank map {infant:0,toddler:1,preschool:2}, then name |
| 4 | Student `ageGroup` not cleared/recomputed on removal or over time — only on add | `pushClassroomsStudentListRemove` | FIX ideally (derive at read time); at minimum document staleness |
| 5 | Changing a classroom's `ageGroup` doesn't cascade to assigned students | `pushClassroomsDetailsEdit` | Preserve (student ageGroup is independent of classroom's) |
| 6 | PUT body protocol: body **keys** are student ids, values `'on'`; zero validation of keys | add/remove handlers | FIX: explicit `studentIds: string[]` payload + validate each id |
| 7 | No check that removed students belong to classroom `:id`; add can silently move a student from another classroom | add/remove handlers | FIX: validate membership/unassigned status |
| 8 | Search input used as raw regex (`$regex` with user string, unescaped) | `getClassroomsStudentListEdit` + both push handlers | FIX: escape regex metacharacters |
| 9 | `findOneAndUpdate` without `runValidators` → required fields bypassable on edit | `pushClassroomsDetailsEdit` | FIX: validate DTO |
| 10 | `ageGroup` has no enum at schema level | Classroom + Student models | FIX: enforce enum {infant,toddler,preschool} |
| 11 | Add-new form labels `infant` as "Infant/Toddler"; edit form labels it "Infant" | `classrooms-add-new.ejs` | FIX to consistent label (confirm product wording) |
| 12 | Summary page loads ALL students just to count per classroom (in-view `filter` with loose `==` on ObjectId vs string) | `getClassroomsSummary` + view | FIX: server-side counts (behavior identical) |
| 13 | `teacherName` required in HTML forms but optional in schema; free text, not a User ref | forms/model | Decide; recommend required, keep as free text for parity |
| 14 | `convertAge` says "0 week old"/"0 month old" (pluralization only for >1); months even for 4-year-olds; 365-day year math | `app.js` | Preserve months-based display; fixing "0/1" grammar is safe |
| 15 | `formatDate` crashes on a real Date argument (unassigned `dateToFormat`); works only for strings or no-arg | `app.js` | FIX (moot if API returns ISO dates) |
| 16 | Controller comment bugs: `getClassroomsDetails` doc-comment says "Show Add New Classroom Page / @route GET /classroom/classrooms-add-new" (copy-paste) | `controllers/classroom.js` | Ignore |
| 17 | Empty-state row on details page has 5 `<td>`s vs 4 columns | `classrooms-details.ejs` | Ignore/fix |
| 18 | Submit buttons hidden when a search yields 0 results even if off-page selections exist | student-list-edit view | FIX |
| 19 | Debounced search does full page navigation → input loses focus mid-typing | student-list-edit JS | FIX (natural in SPA) |
| 20 | `buildSearchUrl` dead `pageParam` parameter; `add/remove` push handlers don't `Math.max(1,…)` their page params (GET re-clamps) | view JS / controllers | Ignore |
| 21 | Duplicate classroom names allowed (no unique index) | model | Preserve unless product says otherwise |
| 22 | `Student.teacherName` field never used by this feature | model | Ignore (other feature areas may use it) |
| 23 | Add list shows students of ANY age for ANY classroom ageGroup; header shows classroom's age group as guidance only | student-list-edit | Preserve (operator freedom is likely intentional) |
| 24 | Selections persisted in per-classroom `sessionStorage` keys; hidden inputs carry off-page picks; storage cleared on submit | student-list-edit JS | Reproduce equivalent UX in SPA (multi-page selection with count + clear) |
