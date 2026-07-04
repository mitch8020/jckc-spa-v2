# Feature Spec: Students (Legacy Express/EJS/Mongoose → NestJS + React re-implementation)

Source files (legacy app root `C:\Projects\JCKC Web App\jckc-web-app-private`):
- `controllers/student.js`, `routes/student.js`
- `views/students-summary-admin.ejs`, `views/students-summary-parent.ejs`, `views/students-details.ejs`, `views/students-details-edit.ejs`, `views/students-delete.ejs`, `views/registration-student.ejs`, `views/registration-student-success.ejs`
- Supporting context read for accuracy: `models/Student.js`, `models/Guardian.js`, `models/Classroom.js`, `models/User.js`, `middleware/auth.js`, `app.js` (global EJS helpers), `views/partials/pagination.ejs`, `views/partials/dashboard-head.ejs`, `views/partials/login-head.ejs`, `views/partials/header.ejs`, `views/partials/navigation-admin.ejs`, `views/partials/nav-links/admin.ejs`, `views/partials/nav-links/parent.ejs`, `controllers/guardian.js`, `controllers/classroom.js`, `routes/guardian.js`, `routes/index.js`

---

## 1. Data Model

### 1.1 Student schema (`models/Student.js`, collection `students`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `studentFirstName` | String | yes | — | |
| `studentLastName` | String | yes | — | |
| `dateOfBirth` | **String** | yes | — | Stored as the raw HTML `<input type="date">` value, i.e. `"YYYY-MM-DD"`. NOT a Date. |
| `studentStreetAddress` | String | yes | — | |
| `studentCity` | String | yes | — | |
| `studentState` | String | yes | — | 2-letter code from the state `<select>` (see §6.1). |
| `studentZIP` | String | yes | — | Stored as String even though the form input is `type="number"`. |
| `teacherName` | String | no | — | **Never written anywhere in the codebase.** Dead field. |
| `ageGroup` | String | no | — | One of `'infant' | 'toddler' | 'preschool'`. Written ONLY by the classroom "add student to classroom" flow (see §5.2). Never recalculated otherwise; goes stale as the child ages. |
| `classroom` | ObjectId ref `"Classroom"` | no | — | Presence of a non-null value = student is "Active"; null/missing = "Inactive". Set/cleared only by the classroom student-list flows (§5.2). |
| `createdAt` | Date | no | `Date.now` | Used as "Registration Date" on the parent view. |

There is **no `user` field** and **no `applicationApprovalStatus` field** in the schema, even though controller/view code references both (see quirks Q1, Q2).

### 1.2 Related schemas (fields relevant to this feature)

- **Guardian** (`models/Guardian.js`): `guardianFirstName` (req), `guardianLastName` (req), `phoneNumber` (req), `guardianStreetAddress` (req), `guardianCity` (req), `guardianState` (req), `guardianZIP` (req), `students` (untyped `Array`; in practice each element is `{ student: ObjectId, relationshipToStudent: String, authorizedToPickUp: Boolean }`), `createdAt` (Date, default now). Guardian→Student linkage lives entirely on the Guardian side; the Student document has no back-reference to guardians.
- **Classroom** (`models/Classroom.js`): `classroomName` (req), `ageGroup` (req), `teacherName` (optional), `createdAt`. Student→Classroom linkage lives on the Student (`student.classroom`); Classroom has no student list.
- **User** (`models/User.js`): Google-OAuth account with `accountType` String (values used: `'parent'`, `'teacher'`, `'admin'`), `firstNameApp`, etc. Students are NOT linked to Users in the schema.

---

## 2. Auth & Roles

- All student routes are mounted at prefix **`/student`** (`app.js`: `app.use('/student', require('./routes/student'))`).
- Every student route uses `ensureAuth` (`middleware/auth.js`): if `req.isAuthenticated()` → `next()`, else **redirect to `/`** (the login page). That is the ONLY protection.
- **There is NO role/permission check on any student route.** Any authenticated user (parent, teacher, admin) can hit every route including edit and delete. Role separation is done purely by:
  1. `getStudentsSummary` branching on `req.user.accountType` to render different views, and
  2. which nav links each role sees (`nav-links/admin.ejs` shows Dashboard/Students/Classrooms/Reports; `nav-links/parent.ejs` shows Dashboard/Students/Parent Profile).
- `ensureGuest` is imported in `routes/student.js` but never used (dead import).
- Method override: the app uses `method-override` with query token `_method`, so HTML forms `POST` to `...?_method=PUT` / `...?_method=DELETE` and Express dispatches them as PUT/DELETE.
- **Re-implementation recommendation:** enforce admin role on details/edit/delete/summary-admin endpoints; parent endpoints should scope to the parent's own students (FIX — see Q1).

---

## 3. Routes (exact, from `routes/student.js`)

All paths below are relative to the `/student` mount. All use `ensureAuth`.

| # | Method | Full path | Controller fn | Purpose |
|---|---|---|---|---|
| R1 | GET | `/student/registration-student` | `registerNewStudent` | Render new-student registration form |
| R2 | POST | `/student/push-registration-student` | `pushStudentApplication` | Create student |
| R3 | GET | `/student/registration-student-success` | `studentApplicationSubmitted` | Render success page |
| R4 | GET | `/student/students-summary` | `getStudentsSummary` | Role-branched student list |
| R5 | GET | `/student/details/:id` | `getStudentDetails` | Student detail page (+guardians) |
| R6 | GET | `/student/edit/:id` | `getStudentDetailsEdit` | Render edit form |
| R7 | GET | `/student/delete/:id` | `getStudentDelete` | Render delete-confirmation page |
| R8 | DELETE | `/student/delete-confirm/:id` | `deleteStudentConfirm` | Delete student |
| R9 | PUT | `/student/push-student-details-edit/:id` | `pushStudentDetailsEdit` | Update student |

NOTE: The JSDoc comments in `controllers/student.js` document WRONG paths for several handlers (`/student/register-new-student`, `/student/push-student-application`, `/student/student-application-submitted`, and the delete handler comment says `DELETE /student/push-student-details-edit/:id`). The route table above (from `routes/student.js`) is authoritative.

### R1 — GET `/student/registration-student`
- Renders `registration-student.ejs` with no view data. Wrapped in try/catch that only `console.error`s (the `res.render('error/500')` is commented out everywhere in this controller — a failed render produces no custom error page).

### R2 — POST `/student/push-registration-student`
- Body (urlencoded form): `studentFirstName`, `studentLastName`, `dateOfBirth` (string `YYYY-MM-DD`), `studentStreetAddress`, `studentCity`, `studentState`, `studentZIP`.
- Executes `Student.create({ ...those 7 fields exactly })`. **No other fields are set**: no `classroom` (so every new student is "Inactive"), no `ageGroup`, no `teacherName`, no link to the creating user, no approval status.
- No server-side validation beyond Mongoose `required` on the 7 fields (client-side `required` attributes on all inputs).
- `console.log("Student Application Submitted!")`, then **redirect → `/student/registration-student-success`**.
- On error: `console.log(error)`; **no response is sent** (request hangs until client timeout). Same pattern for all handlers below.

### R3 — GET `/student/registration-student-success`
- Renders `registration-student-success.ejs` (no data).

### R4 — GET `/student/students-summary`
Branches on `req.user.accountType`:

**(a) `accountType === 'parent'`**
- Query: `Student.find({ user: req.user.id })`.
- **BUG (Q1):** `user` is not a Student schema field and is never written, so this matches zero documents. Parents always see empty tables.
- Renders `students-summary-parent.ejs` with `{ students, user: req.user }`.

**(b) `accountType === 'teacher'`**
- `res.render('students-summary-teacher.ejs')` — **this view file does not exist** (Q3). Render throws "Failed to lookup view"; Express returns its default 500 error. Teachers cannot view a student summary.

**(c) `accountType === 'admin'`** — the paginated/searchable/filterable list:
- Constants: `PAGE_SIZE = 10`.
- Query params:
  - `page`: `Math.max(1, parseInt(req.query.page) || 1)` → non-numeric/absent/`0`/negative → `1`.
  - `status`: must be exactly one of `'active' | 'inactive' | 'all'` (case-sensitive), otherwise defaults to `'active'`.
  - `search`: `req.query.search || ''` (no trimming, no regex-escaping — see Q6).
  - `order`: `req.query.order === 'desc' ? -1 : 1` → anything other than exactly `'desc'` (including absent) is ascending.
- Filter construction:
  - `status === 'active'` → `filter.classroom = { $ne: null }` (excludes both `null` and missing-field docs).
  - `status === 'inactive'` → `filter.classroom = null` (matches `null` AND missing field).
  - `status === 'all'` → no classroom condition.
  - If `search` non-empty → `filter.$or = [ { studentFirstName: { $regex: search, $options: 'i' } }, { studentLastName: { $regex: search, $options: 'i' } } ]` (case-insensitive, unanchored substring match on EITHER name).
- Data fetches (in order):
  1. `Classroom.find()` — ALL classrooms, unfiltered, used only to display teacher names in the table.
  2. `totalCount = Student.countDocuments(filter)`.
  3. `totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))` (never 0; an empty result set still reports "Page 1 of 1").
  4. `safePage = Math.min(page, totalPages)` (over-large page clamps to last page).
  5. `students = Student.find(filter).sort({ studentFirstName: sortOrder }).skip((safePage - 1) * PAGE_SIZE).limit(PAGE_SIZE)`.
     - Sort is by `studentFirstName` ONLY (no secondary key on last name / _id — ties have unstable order across pages). MongoDB default collation → **case-sensitive byte-order sort**: all uppercase-initial names sort before lowercase-initial ones (Q7).
- Pagination metadata object passed to the view:
  ```js
  {
    currentPage: safePage,
    totalPages,
    totalCount,
    pageSize: 10,
    startIndex: totalCount > 0 ? (safePage - 1) * 10 + 1 : 0,   // 1-based
    endIndex: Math.min(safePage * 10, totalCount),
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages
  }
  ```
- Renders `students-summary-admin.ejs` with `{ classrooms, students, pagination, currentStatus: status, currentSearch: search, currentOrder: sortOrder === 1 ? 'asc' : 'desc' }`.

**(d) any other `accountType`** (or undefined): falls through all branches — **no response sent, request hangs** (Q4).

### R5 — GET `/student/details/:id`
1. `student = Student.findById(req.params.id)`.
2. `guardiansAll = Guardian.find().sort({ guardianFirstName: 1 }).lean()` — ALL guardians in the DB, sorted ascending by first name, plain objects.
3. `guardiansStudent = guardiansAll.filter(g => g.students.some(child => child.student.toString() === student._id.toString()))` — in-memory join: guardians whose embedded `students` array contains an entry whose `student` ObjectId equals this student's id.
4. Renders `students-details.ejs` with `{ student, guardiansAll, guardiansStudent }`. **`guardiansAll` is passed but never used by the view** (dead data).
- Failure modes: invalid ObjectId → CastError → caught → hang. Valid-but-nonexistent id → `student` is `null` → `.some(...student._id...)` throws TypeError → caught → hang. A guardian document whose `students` entry lacks a `student` key would also throw.

### R6 — GET `/student/edit/:id`
- `student = Student.findById(req.params.id)`; render `students-details-edit.ejs` with `{ student }`. Nonexistent id → view throws on `student.studentFirstName` → hang.

### R9 — PUT `/student/push-student-details-edit/:id`
- `Student.findOneAndUpdate({ _id: req.params.id }, { <the same 7 fields as create, from req.body> })`.
- Only those 7 fields are updated; `classroom`, `ageGroup`, `teacherName`, `createdAt` untouched. No `runValidators` option (empty strings could slip past `required` on update). No upsert.
- `console.log("Student Info Updated!")`, then **redirect → `/student/details/:id`** (same id).

### R7 — GET `/student/delete/:id`
- `student = Student.findById(req.params.id)`; render `students-delete.ejs` with `{ student }`.

### R8 — DELETE `/student/delete-confirm/:id`
- `Student.deleteOne({ _id: req.params.id })`.
- **No cascade of any kind** (Q8):
  - Guardian documents keep dangling `students[]` entries pointing at the deleted id. (The guardian edit controller explicitly tolerates these as `danglingStudentLinks`.)
  - Nothing to clean on the classroom side because the reference lives on the (now-deleted) student.
- `console.log("Student Deleted!")`, then **redirect → `/student/students-summary`**.
- Deleting an already-deleted/nonexistent id silently succeeds (deleteOne matches 0 docs) and still redirects.

---

## 4. Global EJS helpers used by these views (`app.js` → `app.locals`)

- `formatDate(date)`:
  - If `date` falsy → uses `new Date()` (today).
  - If `typeof date == 'string'` → `date.split('-')` → returns `` `${parts[1]}/${parts[2]}/${parts[0]}` `` i.e. `"YYYY-MM-DD"` → `"MM/DD/YYYY"` **keeping zero-padding** (e.g. `"2020-05-09"` → `"05/09/2020"`).
  - Else (Date object path) → `month = getMonth()+1`, `day = getDate()`, `year = getFullYear()`, NO zero padding (e.g. `7/2/2026`). **BUG:** for a truthy non-string (actual Date) argument, `dateToFormat` is never assigned (only assigned when `!date`), so `dateToFormat.getMonth()` throws TypeError. In practice it is only ever called with a string or no argument, so it works.
- `convertAge(birthday)`: `age = (Date.now() - new Date(birthday)) / 1000/60/60/24/365` (years, using 365-day years; DST/leap ignored).
  - If `age * 12 < 1` (under ~1 month): returns `` `${Math.floor(age*52)} week${Math.floor(age*52) > 1 ? 's' : ''} old` `` (so `"1 week old"`, `"0 week old"` — no plural for 0).
  - Else: `` `${Math.floor(age*12)} month${...>1?'s':''} old` `` — **always months, never years** (a 5-year-old shows "60 months old").
- `calcAgeGroup(birthday)` (available to views; same math duplicated inline in the classroom controller): `age*12 < 11` → `'infant'`; `age*12 < 30` → `'toddler'`; else `'preschool'`. (Boundaries: <11 months infant; 11–<30 months toddler; ≥30 months preschool.)
- `res.locals.user = req.user || null` is set globally by middleware, so every view can read `user` even when the controller doesn't pass it.

---

## 5. Cross-feature linkage (how students connect to guardians & classrooms)

### 5.1 Guardians
- Link direction: `Guardian.students` = array of `{ student: <Student ObjectId>, relationshipToStudent: <String>, authorizedToPickUp: <Boolean> }`.
- Created from the student details page: "+ Add Parent / Guardian" → `GET /guardian/registration-guardian/:studentId/new-guardian`. The guardian flow either creates a new Guardian with `students: [{ student, relationshipToStudent: req.body.relationshipToStudent, authorizedToPickUp: true }]` or appends that entry to an existing guardian's array, then redirects back to `/student/details/:studentId`.
- Displaying a student's guardians is always a **full-collection scan + in-JS filter** (no Mongo query on the array). Relationship shown per-student is looked up via `guardian.students.find(e => e.student.toString() === student._id.toString()).relationshipToStudent`.
- Student deletion does NOT remove the guardian-side entries (dangling links, Q8).

### 5.2 Classrooms (out of scope but affects student data)
- `student.classroom` and `student.ageGroup` are written ONLY by `PUT /classroom/push-student-list-add/:id` (sets `classroom` to the classroom id and `ageGroup` computed from DOB at assignment time) and `PUT /classroom/push-student-list-remove/:id` (sets `classroom: null`; leaves `ageGroup` stale).
- The student admin list derives Active/Inactive status purely from `classroom` being non-null.

---

## 6. UI Spec (per view)

Shared layout notes:
- `partials/dashboard-head.ejs`: `<title>JCKC Dashboard</title>`, loads `/css/style.css`, Tailwind CDN script, Font Awesome 6.2.0, Flowbite 1.5.5 CSS. `partials/login-head.ejs`: `<title>JCKC Login</title>` (no Tailwind CDN — commented out).
- `partials/navigation-admin.ejs` → indigo-600 navbar with `nav-links/admin` (links: Dashboard → `/dashboard/<user.id>`, Students → `/student/students-summary`, Classrooms → `/classroom/classrooms-summary`, Reports → `/report/reports-summary`) + logout dropdown; has a mobile hamburger menu. `navigation-parent.ejs` uses `nav-links/parent` (Dashboard, Students, Parent Profile → `/profile/<user.id>`).
- `partials/header.ejs`: white bar with `Hello, <user.firstNameApp>!` (left) and today's date via `formatDate()` (right, `M/D/YYYY`, unpadded).

### 6.1 `registration-student.ejs` — GET /student/registration-student
- Layout: dashboard-head + **navigation-admin** (even if a parent opens it — Q9) + NO header partial.
- H1 (centered): **"Student Registration"**. Card heading: "Student Application" / subtext "Submit a new student application".
- Form: `method="POST" action="/student/push-registration-student"`. Fields (all with `required` attribute):

| Label | name/id | Type | Notes |
|---|---|---|---|
| Student First Name | `studentFirstName` | text | half-width (sm) |
| Student Last Name | `studentLastName` | text | half-width (sm) |
| Date Of Birth | `dateOfBirth` | date | full width |
| Student's Main Residence | `studentStreetAddress` | text | full width |
| City | `studentCity` | text | |
| State / Province | `studentState` | select | 57 options, exact order: `AL,AK,AZ,AR,AS,CA,CO,CT,DE,DC,FL,GA,GU,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,CM,OH,OK,OR,PA,PR,RI,SC,SD,TN,TX,TT,UT,VT,VA,VI,WA,WV,WI,WY` (includes territories AS, GU, PR, VI, DC, plus archaic `CM` and `TT`). **Default selected: `TN`.** |
| ZIP / Postal Code | `studentZIP` | number | stored as String server-side |

- Buttons: "Cancel" (anchor-wrapped button → `/student/students-summary`), "Submit" (submits form).

### 6.2 `registration-student-success.ejs` — GET /student/registration-student-success
- Layout: **login-head** (title "JCKC Login", no navbar — Q10).
- H2: "Student Application Submitted!"; text "Go back to your Students Page."; indigo button link **"Students"** → `/student/students-summary`.

### 6.3 `students-summary-admin.ejs` — GET /student/students-summary (admin)
- Layout: dashboard-head + navigation-admin + header partial.
- H1 (centered): **"Students Summary"**; section heading "All Students".
- Toolbar (right side):
  1. **Search form** (`method="GET"`, submits to same URL): hidden `status`=currentStatus, hidden `order`=currentOrder, text input `name="search"` (placeholder `"Search by name..."`, value = currentSearch), "Search" submit button; if `currentSearch` non-empty, a **"Clear"** link → `?status=<currentStatus>&order=<currentOrder>`. Submitting the search **omits `page`** → resets to page 1.
  2. **Status filter** `<select id="status-filter">` with label "Status:"; options `active` → "Active", `inactive` → "Inactive", `all` → "All Students" (current one `selected`). `onchange` navigates to `?status=<value>&order=<currentOrder>&search=<encodeURIComponent(currentSearch)>` — drops `page` (reset to 1).
  3. **"+ New Student"** button link → `/student/registration-student`.
- Table (sticky header, scrollable body, container `max-height: calc(100vh - 340px); min-height: 400px`):
  - Columns: **Name** (sortable), **DOB** (hidden below `lg`), **Age** (hidden below `sm`), **Teacher**, and an unlabeled Edit column.
  - Name header is a link toggling sort: `?status=<currentStatus>&search=<encodeURIComponent(currentSearch)>&order=<asc↔desc>` with an `↑` (asc) / `↓` (desc) indicator; **drops `page`** (reset to 1).
  - Row per student:
    - Row background: `bg-white` if `classroom` set, `bg-gray-50` if not.
    - Name cell: link `/student/details/<e.id>` showing `studentFirstName + ' ' + studentLastName`, followed by a pill badge: `Active` (green-100/green-800) if `e.classroom` truthy else `Inactive` (gray-200/gray-700). On small screens the cell also stacks "DOB: `formatDate(e.dateOfBirth)`" and (below sm) "Age: `convertAge(e.dateOfBirth)`".
    - DOB cell: `formatDate(e.dateOfBirth)` → `MM/DD/YYYY` zero-padded.
    - Age cell: `convertAge(e.dateOfBirth)` → "N months old" / "N week(s) old".
    - Teacher cell: `e.classroom ? classrooms.find(room => room.id == e.classroom).teacherName : 'Not Assigned'`. **BUG (Q11):** if `e.classroom` points at a deleted classroom, `.find()` returns `undefined` → render throws (500). Also if the classroom exists but has no `teacherName`, renders blank. Loose `==` compares string virtual `room.id` to ObjectId (works via coercion).
    - Edit cell: link "Edit" → `/student/edit/<e.id>`.
  - Empty state (single row, colspan=5, centered): if `currentSearch` → `No students found matching "<search>"`; else → `No <status> students found` (status word omitted when `'all'`, producing double space: "No  students found").
- Pagination footer (`partials/pagination.ejs`), rendered **only if `pagination.totalCount > 0`**:
  - Left (sm+ only): `Showing <startIndex> to <endIndex> of <totalCount> students`.
  - Right: `Page <currentPage> of <totalPages>`, then **Previous** / **Next**: enabled ones are links `?status=<currentStatus>&search=<encodeURIComponent(currentSearch || '')>&order=<currentOrder || 'asc'>&page=<currentPage ∓ 1>`; disabled ones render as gray non-link `<span>`s. No numbered page links, no page-size selector.

### 6.4 `students-summary-parent.ejs` — GET /student/students-summary (parent)
- Layout: dashboard-head + **navigation-parent** + NO header partial.
- H1 (centered): **"STUDENTS"** (all caps).
- Section 1 — "Registered Students:" with button **"Register New Student"** → `/student/register-new-student`. **BUG (Q5): that route does not exist** (real route is `/student/registration-student`) → 404 "Cannot GET".
  - Table columns: **Name**, **Birthday** (lg+), **Teacher** (sm+), **Registration Date**. (A commented-out Edit column exists in the markup.)
  - Body renders only if `students.length > 0 && students.some(e => e.applicationApprovalStatus)`; each row's cells render only when `e.applicationApprovalStatus` is truthy — but the `<tr>` itself is emitted for EVERY student, so non-approved students produce empty rows (Q2b).
  - Cell contents: Name = `studentFirstName + ' ' + studentLastName` (plus stacked mobile Birthday/Teacher); Birthday = raw `e.dateOfBirth` string (**unformatted `YYYY-MM-DD`**, unlike admin view); Teacher = `e.teacher ? e.teacher : 'Not Assigned'` (**`teacher` is not a schema field — always "Not Assigned"**, Q2c); Registration Date = `(e.createdAt.getMonth()+1) + '/' + e.createdAt.getDate() + '/' + e.createdAt.getFullYear()` (unpadded `M/D/YYYY`).
  - Empty state row: "No Registered Students Available" (+3 empty `<td>`s).
- Section 2 — "Pending Applications:" (no button).
  - Table columns: **Name**, **Birthday** (lg+), **Application Status**.
  - Body renders if `students.length > 0 && students.some(e => !e.applicationApprovalStatus)`; row cells render only when `!e.applicationApprovalStatus`; status cell prints `e.applicationApprovalStatus ? 'Approved' : 'Pending'` (inside this branch always **"Pending"**).
  - Empty state row: "No Pending Applications Available".
- Because of Q1 (query on nonexistent `user` field) both tables ALWAYS show their empty states in practice. `applicationApprovalStatus` is not in the schema and is never written → even if students were returned, all would land in "Pending Applications" (Q2a).

### 6.5 `students-details.ejs` — GET /student/details/:id
- Layout: dashboard-head + navigation-admin + header partial.
- H1 (centered): **"Student Details"**.
- Card 1 — "Student Info" with buttons: **"Delete"** (white/indigo text, hover red) → `/student/delete/<student.id>`; **"Edit Info"** (indigo) → `/student/edit/<student.id>`.
  - Definition list rows: **Student Name** = first + ' ' + last; **Date of Birth** = `formatDate(student.dateOfBirth)`; **Age** = `convertAge(student.dateOfBirth)`; **Student Address** = `street + ', ' + city + ', ' + state + ' ' + ZIP`.
- Card 2 — "Parent / Guardian Info" with button **"+ Add Parent / Guardian"** → `/guardian/registration-guardian/<student._id>/new-guardian`.
  - Table columns: **Name**, **Address** (lg+), **Phone Number** (md+), **Relationship**, unlabeled Edit column.
  - One row per guardian in `guardiansStudent` (all guardians whose `students[]` contains this student; ordered by `guardianFirstName` asc from the query):
    - Name: link → `/guardian/details/<guardian._id>`, text `guardianFirstName + ' ' + guardianLastName`; mobile-stacked address (full one-line on sm+, split street/city-state-zip below sm) and phone.
    - Address: `guardianStreetAddress + ', ' + guardianCity + ', ' + guardianState + ' ' + guardianZIP`.
    - Phone Number: `phoneNumber` raw.
    - Relationship: `guardiansStudent[i].students.find(e => e.student.toString() === student._id.toString()).relationshipToStudent`.
    - Edit link → `/guardian/edit/<guardian._id>`.
  - Empty state row: "No Assigned Parents / Guardians Available" (+4 empty `<td>`s).

### 6.6 `students-details-edit.ejs` — GET /student/edit/:id
- Layout: dashboard-head + navigation-admin + NO header.
- H1 (centered): **"Edit Student Details"**. Card heading "Edit Student Info" / subtext "Update a student's information".
- Form: `method="POST" action="/student/push-student-details-edit/<student.id>?_method=PUT"` (dispatched as PUT via method-override).
- Fields: identical names/types/required/layout to §6.1, but pre-filled: text inputs get `value="<current value>"`; `dateOfBirth` date input gets `value="<student.dateOfBirth>"` (works because DOB is stored as `YYYY-MM-DD`); state `<select>` marks the student's current state `selected` (same 57-option list); `studentZIP` `type="number"` with current value.
- Buttons: "Cancel" (anchor → `/student/details/<student.id>`), "Submit".

### 6.7 `students-delete.ejs` — GET /student/delete/:id
- Layout: dashboard-head + navigation-admin + header partial.
- H1 (centered): **"Student Details"** (same title as the details page, not "Delete").
- Renders the same read-only "Student Info" card as §6.5 card 1 (including its own Delete → `/student/delete/<id>` self-link and Edit Info → `/student/edit/<id>` buttons) — no guardian card.
- Over the whole page, an **always-visible** (not JS-toggled) modal with gray backdrop:
  - Red warning-triangle icon; heading (id `modal-title`): **"Delete Student"**; body: `Are you sure you want to delete <studentFirstName> <studentLastName>?` and "This action cannot be undone."
  - The modal is wrapped in `<form action="/student/delete-confirm/<student.id>?_method=DELETE" method="POST">`. Buttons (row-reversed): red **"Delete"** submit; **"Cancel"** anchor-wrapped button → `/student/details/<student.id>`.
- In the SPA, implement as a real confirm dialog on the details page rather than a standalone route (safe to change; preserve the confirmation text).

---

## 7. Quirks & Bugs (with preserve/fix guidance)

| ID | Description | Preserve or Fix |
|---|---|---|
| Q1 | Parent summary queries `Student.find({ user: req.user.id })` but Student has no `user` field and creation never sets one — parents ALWAYS see empty tables; parent-created students are orphaned into the admin "Inactive" pool. | **FIX**: add a real owner/guardianUser link on Student (or link via Guardian→User) and scope parent queries to it. |
| Q2 | (a) `applicationApprovalStatus` is referenced by the parent view but doesn't exist in the schema and is never written (always falsy → everything "Pending"); (b) parent tables emit empty `<tr>`s for filtered-out rows; (c) parent view reads nonexistent `e.teacher` (always "Not Assigned") while admin view correctly derives teacher via `classroom`. | **FIX**: implement a real application/approval workflow (or drop the pending concept); derive teacher from classroom; don't emit empty rows. |
| Q3 | Teacher branch renders `students-summary-teacher.ejs`, which does not exist → 500 for every teacher visiting `/student/students-summary`. | **FIX**: define teacher behavior (e.g., list students in the teacher's classroom) or return 403. |
| Q4 | Unknown/missing `accountType` in `getStudentsSummary` sends no response (hang). All catch blocks only `console.log/error` and never respond (`res.render('error/500')` commented out) → any DB error, invalid ObjectId (CastError), or null lookup = hung request. | **FIX**: proper 400/404/500 responses everywhere. |
| Q5 | Parent view "Register New Student" links to `/student/register-new-student`, but the route is `/student/registration-student` → 404. (Controller comments also document these wrong paths.) | **FIX**: one canonical route. |
| Q6 | Search input is passed raw into `$regex` — not escaped. Regex metacharacters (`(`, `*`, `\`, ...) cause a MongoDB error → (via Q4) hung request; users can also craft regex matches. Search is also not trimmed. | **FIX**: escape regex (or use text index); trim input. |
| Q7 | Admin list sort: `sort({ studentFirstName: <±1> })` with default collation → case-sensitive ASCII ordering (uppercase before lowercase); no secondary sort key → duplicate first names may shuffle between pages; sorts only by FIRST name. | **FIX**: case-insensitive collation + secondary key (lastName, _id). Keep first-name-primary ordering to match user expectations from the legacy app. |
| Q8 | Deleting a student does not cascade: Guardian `students[]` keeps dangling entries (guardian edit tolerates them as "dangling links"). Also `deleteOne` on a nonexistent id silently "succeeds". | **FIX**: remove guardian links on delete (and return 404 for unknown id). |
| Q9 | `registration-student.ejs` and `students-details-edit.ejs` always include the ADMIN navigation, even when reached by a parent; parents reaching any admin page is possible since there are no role checks at all (§2). | **FIX**: role-guard endpoints; role-appropriate nav. |
| Q10 | Success page uses the login layout (`<title>JCKC Login</title>`, no navbar) — inconsistent chrome. | FIX freely (cosmetic). |
| Q11 | Admin table teacher lookup `classrooms.find(room => room.id == e.classroom).teacherName` throws if the referenced classroom was deleted → whole page 500s. Blank cell when classroom has no `teacherName`. | **FIX**: null-safe lookup → "Not Assigned". |
| Q12 | `dateOfBirth` stored as a String (`YYYY-MM-DD`), `studentZIP` stored as String but collected via `type="number"` input. `formatDate` throws on real Date inputs (dead branch bug). `convertAge` never uses years ("60 months old"); `calcAgeGroup` boundaries are `<11 months`=infant, `<30 months`=toddler, else preschool (365-day years). | Preserve the FORMATS users see (`MM/DD/YYYY` zero-padded for admin dates; age-group boundaries exactly 11/30 months); store DOB as a proper date type internally. Consider showing years for older kids (UX fix, deviation from legacy). |
| Q13 | Student schema fields `teacherName` (never written) and staleness of `ageGroup` (computed only at classroom-assignment time, never refreshed). `guardiansAll` computed and passed to the details view but unused. `ensureGuest` imported but unused in `routes/student.js`. | FIX: drop `teacherName`; compute ageGroup/age on the fly; don't over-fetch. |
| Q14 | "Active/Inactive" student status is purely derived from `classroom != null`; new students are always Inactive; default admin list filter is `status=active`, so **freshly registered students are invisible on the default admin list** until assigned to a classroom (must switch filter to Inactive/All). | Preserve the derived-status concept (it's the app's core semantic); consider defaulting to "all" or surfacing a hint (UX call). |
| Q15 | All list-state changes (search submit, status change, sort toggle) intentionally reset `page` to 1 by omitting it; Previous/Next preserve `status`, `search` (URL-encoded), `order`. Page param is clamped: `<1 → 1`, `> totalPages → totalPages`. Pagination footer hidden entirely when 0 results. | **Preserve** (good behavior). |
| Q16 | Edit uses `findOneAndUpdate` without `runValidators` — required-field validation is client-side only on update; a crafted PUT can blank out fields. Create relies on Mongoose `required` only. | **FIX**: full server-side validation (all 7 fields non-empty; state in the allowed list; DOB valid date not in future; ZIP format). |

---

## 8. Re-implementation route mapping (suggested)

| Legacy | REST equivalent |
|---|---|
| GET `/student/students-summary` (admin) | `GET /api/students?page=&status=active|inactive|all&search=&order=asc|desc` → `{ items, pagination }` (pageSize 10, same clamp/reset semantics, filter/sort per §3-R4c with Q6/Q7 fixes) |
| GET `/student/students-summary` (parent) | `GET /api/me/students` (requires Q1 fix) |
| GET `/student/details/:id` | `GET /api/students/:id` (+ `GET /api/students/:id/guardians` returning guardian + this-student's `relationshipToStudent`/`authorizedToPickUp`) |
| POST `/student/push-registration-student` | `POST /api/students` (7 fields; server validation; created Inactive/no classroom) |
| PUT `/student/push-student-details-edit/:id` | `PATCH /api/students/:id` (same 7 fields only) |
| DELETE `/student/delete-confirm/:id` | `DELETE /api/students/:id` (cascade guardian links — Q8 fix) |
| GET registration/success/edit/delete pages | SPA routes/dialogs; no API needed |

---

## Audit corrections

1. **§R6 failure-mode correction (line "Nonexistent id → view throws on `student.studentFirstName` → hang")**: this is WRONG. For GET `/student/edit/:id` with a valid-format but nonexistent id, `Student.findById` resolves to `null` and the throw happens **inside the EJS render** (`students-details-edit.ejs` reads `student.studentFirstName` unguarded, line 32). Express's `res.render` catches template errors and forwards them to `next(err)`, so the client receives the **default Express 500 error page — the request does NOT hang**. (This matches the spec's own model elsewhere: the missing `students-summary-teacher.ejs` and the Q11 teacher-lookup throw are both correctly described as 500s.) "Hang" is only correct for errors thrown in the **controller body** (e.g. CastError from an invalid ObjectId on `findById`, or the `.some(...)` TypeError in R5), because those are swallowed by the controller's catch which never responds. The same distinction applies to R7 (GET `/student/delete/:id`): nonexistent id → 500 from the view render, not a hang; invalid ObjectId → hang.
