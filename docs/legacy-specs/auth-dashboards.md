# Feature Spec: Auth & Dashboards (Legacy JCKC Express/EJS App)

Source files (legacy repo root: `C:\Projects\JCKC Web App\jckc-web-app-private`):
`controllers/auth.js`, `controllers/home.js`, `routes/auth.js`, `routes/index.js`, `views/index.ejs`, `views/dashboard-admin.ejs`, `views/dashboard-teacher.ejs`, `views/dashboard-parent.ejs`, `views/error/no-account.ejs`, `views/registration-user.ejs`, `views/registration-user-success.ejs`.
Supporting context also inspected: `middleware/auth.js`, `config/passport.js`, `app.js`, `models/User.js`, `models/Student.js`, `models/Classroom.js`, `views/partials/*` (login-head, login-close-tag, dashboard-head, dashboard-close-tag, header, navigation, navigation-admin, navigation-parent, nav-links/admin, nav-links/parent, nav-links/logout).

---

## 1. Global Infrastructure Relevant to This Feature

### 1.1 Session & Passport setup (`app.js`)
- Sessions: `express-session` with **hardcoded secret `'keyboard mouse'`**, `resave: false`, `saveUninitialized: false`, store = `connect-mongo` bound to the Mongoose connection. Cookie-based session auth (no JWT).
- `passport.initialize()` + `passport.session()` are mounted after the session middleware.
- Global template local: every request sets `res.locals.user = req.user || null`, so **every EJS view can reference `user` directly** (the logged-in User document, or `null`).
- `method-override` is mounted as `methodOverride("_method")` — HTML forms POST with `?_method=PUT` in the action query string to simulate PUT.
- Route mounting order: `/` → `routes/index`, `/auth` → `routes/auth`, plus `/student`, `/guardian`, `/classroom`, `/report` (other feature areas).

### 1.2 Auth middleware (`middleware/auth.js`)
- `ensureAuth(req, res, next)`: if `req.isAuthenticated()` → `next()`; else **redirect to `/`** (login page). No flash message, no return-URL capture.
- `ensureGuest(req, res, next)`: if `req.isAuthenticated()` → **redirect to `/dashboard`**; else `next()`.
- **There is NO role-based middleware anywhere.** `parentPermission` / `teacherPermission` / `adminPermission` flags exist on the User model and are set during registration, but **no route ever checks them**. Any authenticated user of any accountType can hit any `ensureAuth` route (including admin-only-looking pages in other feature areas). The re-implementation SHOULD FIX this with real role guards.

### 1.3 Passport Google OAuth strategy (`config/passport.js`)
- Strategy: `passport-google-oauth20` `GoogleStrategy`.
- `clientID` = `process.env.GOOGLE_CLIENT_ID`, `clientSecret` = `process.env.GOOGLE_CLIENT_SECRET`.
- `callbackURL`: if `process.env.NODE_ENV == 'development'` → `http://localhost:3000/auth/google/callback`, else → `https://jckc-web-app-private.herokuapp.com/auth/google/callback` (hardcoded prod URL).
- **OAuth scope is `['profile']` only — email scope is NOT requested.** That is why the user-registration form asks the user to type their email manually.
- Verify callback behavior (auto-provisioning):
  1. Builds a `newUser` object:
     - `googleId: profile.id`
     - `displayName: profile.displayName`
     - `firstNameGoog: profile.name.givenName`
     - `lastNameGoog: profile.name.familyName`
     - `firstNameApp: ''`, `lastNameApp: ''`, `dateOfBirth: ''`, `phoneNumber: ''`, `emailAddress: ''`, `accountType: ''`
     - `image: profile.photos[0].value` (Google avatar URL; stored but never displayed in these views)
     - `parentPermission: false`, `teacherPermission: false`, `adminPermission: false`
     - `registrationStatus: false`
  2. `User.findOne({ googleId: profile.id })` — if found, `done(null, user)`.
  3. If not found, `User.create(newUser)` then `done(null, user)`. **Every Google account that completes OAuth gets a User record auto-created** — there is no allowlist.
  4. On DB error: `console.log(error)` and **`done` is never called → the HTTP request hangs** (bug; fix in re-implementation).
- `serializeUser`: stores `user.id` (Mongo `_id` string) in the session.
- `deserializeUser`: `User.findById(id, callback)` — loads the full User doc onto `req.user` on every request.

### 1.4 User model (`models/User.js`) — exact fields
| Field | Type | Required | Notes |
|---|---|---|---|
| `googleId` | String | yes | lookup key for OAuth |
| `displayName` | String | yes | from Google |
| `firstNameGoog` | String | yes | from Google |
| `lastNameGoog` | String | yes | from Google |
| `firstNameApp` | String | no | user-entered at registration; shown in header greeting |
| `lastNameApp` | String | no | user-entered |
| `dateOfBirth` | String | no | **stored as String**, HTML date input format `YYYY-MM-DD` |
| `phoneNumber` | String | no | user-entered, no format validation |
| `emailAddress` | String | no | user-entered (not from Google) |
| `accountType` | String | no | free-text string; observed values: `'parent'`, `'teacher'`, `'admin'`, `''` (pre-registration). **No enum constraint.** Lower-case, case-sensitive comparisons everywhere. |
| `image` | String | no | Google avatar URL |
| `createdAt` | Date | no | default `Date.now` |
| `parentPermission` | Boolean | no | set true when registering as parent; never read |
| `teacherPermission` | Boolean | no | set true when registering as teacher; never read |
| `adminPermission` | Boolean | no | set true when registering as admin; never read |
| `registrationStatus` | Boolean | no | `false` on creation, `true` after registration form submit; gates dashboard access |

### 1.5 Helper functions (EJS `app.locals`, defined in `app.js`)
- `formatDate(date)`:
  - If `date` is falsy/omitted → uses `new Date()` (today) and returns `` `${month}/${day}/${year}` `` with `month = getMonth()+1`, `day = getDate()`, `year = getFullYear()` — **no zero padding** (e.g. `7/2/2026`).
  - If `date` is a string → splits on `'-'` assuming `YYYY-MM-DD`, returns `MM/DD/YYYY` with original zero padding preserved (e.g. `06/06/2022`).
  - **BUG:** if passed an actual `Date` object, `dateToFormat` is undefined (only assigned when `!date`) and `dateToFormat.getMonth()` throws a TypeError. Fix in re-implementation.
- `calcAgeGroup(birthday)`: age in years = `(now - new Date(birthday)) / 1000/60/60/24/365`; if `age*12 < 11` → `'infant'`; else if `age*12 < 30` → `'toddler'`; else `'preschool'`. (Uses 365-day years, ignores leap years.)
- `convertAge(birthday)`: if under 1 month (`age*12 < 1`) → `"{floor(age*52)} week(s) old"`, else `"{floor(age*12)} month(s) old"` (pluralizes only when > 1; `0 weeks`/`1 week` edge: `0` gets no "s" — "0 week old").
- `properNoun(name)`: lowercases the whole string then uppercases the first character (e.g. `'infant'` → `'Infant'`). Throws on empty string (`ans[0]` undefined → TypeError on `.toUpperCase()`).
- `sortClassrooms(objArray)`: sorts **in place** first by `classroomName` (`localeCompare`), then re-sorts by ageGroup with a comparator that returns -1 for (infant,toddler) and (toddler,preschool) pairs, +1 for (preschool,toddler) and (toddler,infant) pairs, and **0 otherwise — including (infant,preschool)**. Intended order: infant → toddler → preschool. **BUG: the comparator is non-transitive** (infant vs preschool compares equal), so with certain inputs Array.sort may not produce the fully intended grouping. Re-implementation should FIX by mapping ageGroup to a rank (infant=0, toddler=1, preschool=2) and sorting by (rank, classroomName).
- `sortName(objArray)`: sorts in place by `studentFirstName` localeCompare (used by other feature areas).

---

## 2. Routes

### 2.1 `GET /` — Login / landing page
- File: `routes/index.js` → `homeController.getIndex`.
- Middleware: `ensureGuest` (an already-authenticated user is redirected to `/dashboard`).
- Renders `index.ejs`. No data fetched.

### 2.2 `GET /auth/google` — Start Google OAuth
- File: `routes/auth.js`.
- Middleware: none (public). Calls `passport.authenticate('google', { scope: ['profile'] })` → 302 to Google consent screen.
- Note: scope excludes email (see 1.3).

### 2.3 `GET /auth/google/callback` — OAuth callback
- Middleware: `passport.authenticate('google', { failureRedirect: '/auth/error/no-account' })`.
- On auth failure (user denies consent / OAuth error) → redirect `/auth/error/no-account`. Because the strategy auto-creates users, "no account" is a misnomer — this page in practice only appears on OAuth denial/failure, never for "unknown user".
- On success (async handler, though it awaits nothing):
  - If `!req.user.registrationStatus` → redirect **`/auth/acct-registration`** (new/unregistered user).
  - Else → redirect **`/dashboard`**.

### 2.4 `GET /auth/logout` — Logout
- Middleware: none (public — calling it while logged out is harmless).
- Controller `auth.logout`: `req.logout(callback)`; callback: if `err` → `return next(err)`; else `res.redirect('/')`.
- **BUG:** the handler signature is `(req, res)` — `next` is not defined, so if `req.logout` ever errors the error branch throws `ReferenceError: next is not defined`. Fix in re-implementation (in a REST API this becomes a session-destroy / token-invalidation endpoint).

### 2.5 `GET /auth/error/no-account` — OAuth failure page
- Middleware: none (public).
- Controller `auth.noAccount`: renders `./error/no-account.ejs`. No data.

### 2.6 `GET /auth/acct-registration` — Registration form for new users
- Middleware: `ensureAuth`.
- Controller `auth.acctRegistration`: renders `registration-user.ejs`. No data fetched (form uses the global `user` local for the action URL).
- Note: controller doc-comments say the route is `/auth/acctRegistration` (camelCase) but the actual mounted path is `/auth/acct-registration` (kebab-case). Comments are wrong; paths below are authoritative.
- **Not gated on `registrationStatus`:** an already-registered user can revisit this page and re-submit, overwriting their profile and accountType. Probably unintended; re-implementation should decide (recommend: redirect registered users to dashboard, and make accountType assignment admin-controlled).

### 2.7 `PUT /auth/push-registration/:id` — Submit registration
- Middleware: `ensureAuth`. Reached via HTML form POST to `/auth/push-registration/<user.id>?_method=PUT` (method-override).
- Controller `auth.pushRegistration`, step by step:
  1. Reads `accountType` from `req.body.accountType`.
  2. `User.findOneAndUpdate({ _id: req.params.id }, { firstNameApp, lastNameApp, dateOfBirth, phoneNumber, emailAddress, accountType, registrationStatus: true })` — all values straight from `req.body`, **no server-side validation whatsoever** (no trimming, no format checks, no enum check on accountType).
  3. Then a **second** `findOneAndUpdate` on the same `_id` depending on `accountType` (exact string comparison):
     - `'parent'` → sets `{ parentPermission: true }`
     - `'teacher'` → sets `{ teacherPermission: true }`
     - `'admin'` → sets `{ adminPermission: true }`
     - anything else → no permission flag set (user is "registered" but has no permission flag; two writes are not transactional).
  4. `console.log("Account Registered!")` then redirect to `/auth/registration-success/${req.params.id}`.
  5. On error: `console.log(error)` only — **no response is sent; the request hangs** (bug; fix with proper error response).
- **SECURITY BUG (IDOR):** the target user id comes from `req.params.id` with no check that it equals `req.user.id`. Any authenticated user can rewrite any other user's profile/accountType/permission flags by crafting the URL. The re-implementation MUST fix this (operate on the authenticated principal, not a URL id).
- Note: permission flags are only ever set to `true`; re-registering with a different accountType leaves the old flag `true` too (e.g. a user can end up with both `parentPermission` and `adminPermission` true).

### 2.8 `GET /auth/registration-success/:id` — Registration success page
- Middleware: `ensureAuth`.
- Controller `auth.registrationSuccess`: renders `registration-user-success.ejs`. **`req.params.id` is ignored** — the view links using the global `user.id` local.

### 2.9 `GET /dashboard` — Dashboard redirect
- Middleware: `ensureAuth`.
- Controller `home.redirectDashboard`: `res.redirect('/dashboard/${req.user.id}')` inside try/catch (catch only logs).

### 2.10 `GET /dashboard/:id` — Role dashboard
- Middleware: `ensureAuth`.
- Controller `home.getDashboard`:
  1. Reads `accountType = req.user.accountType`. **`req.params.id` is completely ignored** — the dashboard always shows the *logged-in* user's dashboard regardless of the id in the URL (no IDOR risk here, but the URL param is decorative; re-implementation can drop it).
  2. If `!req.user.registrationStatus` → redirect `/auth/acct-registration` (second gate, mirrors the OAuth callback).
  3. Else switch on `accountType` (exact, case-sensitive):
     - `'parent'` → render `dashboard-parent.ejs` (no data fetched).
     - `'teacher'` → render `dashboard-teacher.ejs` (no data fetched).
     - `'admin'` → `const students = await Student.find()` and `const classrooms = await Classroom.find()` — **all documents, no filter, no sort, no `.lean()`, no pagination** — then render `dashboard-admin.ejs` with `{ students, classrooms }`.
     - **any other value (including `''`)** → no branch matches, nothing is rendered, **the request hangs** (bug). Should not occur because registrationStatus gate implies accountType was set, but a registered user with a typo'd accountType would hang.
  4. Errors are `console.error`'d only (a commented-out `res.render('error/500')` exists) → hang on error.

### 2.11 `GET /profile/:id` — Profile page (adjacent, defined in the same files)
- Middleware: `ensureAuth`. Controller `home.getProfile` switches on `req.user.accountType` (again ignoring `:id`):
  - `'parent'` → renders `profile-parent.ejs` (exists; other feature area).
  - `'teacher'` → renders `profile-teacher.ejs` — **this view file DOES NOT EXIST** → Express render error → 500.
  - `'admin'` → renders `profile-admin.ejs` — **DOES NOT EXIST** → 500.
- The parent nav links to `/profile/<user.id>` ("Parent Profile"); admin/teacher navs do not link to profile.

### 2.12 Route → view → redirect map (summary)

| Method & Path | Middleware | Result |
|---|---|---|
| GET `/` | ensureGuest | render `index.ejs`; authed → 302 `/dashboard` |
| GET `/auth/google` | — | 302 to Google (scope: profile) |
| GET `/auth/google/callback` | passport | fail → 302 `/auth/error/no-account`; success + unregistered → 302 `/auth/acct-registration`; registered → 302 `/dashboard` |
| GET `/auth/logout` | — | logout session → 302 `/` |
| GET `/auth/error/no-account` | — | render `error/no-account.ejs` |
| GET `/auth/acct-registration` | ensureAuth | render `registration-user.ejs` |
| PUT `/auth/push-registration/:id` | ensureAuth | 2 user updates → 302 `/auth/registration-success/:id` |
| GET `/auth/registration-success/:id` | ensureAuth | render `registration-user-success.ejs` |
| GET `/dashboard` | ensureAuth | 302 `/dashboard/:userId` |
| GET `/dashboard/:id` | ensureAuth | unregistered → 302 `/auth/acct-registration`; else render role dashboard |
| GET `/profile/:id` | ensureAuth | render `profile-parent.ejs` (parent only; teacher/admin views missing → 500) |

---

## 3. End-to-End Login & Registration Flow

1. Guest visits `/` → login page with a single "Continue with Google" button → `/auth/google`.
2. Google consent (profile scope only) → `/auth/google/callback`.
3. Strategy looks up `googleId`; creates a skeleton User (`registrationStatus: false`, empty app fields) if new.
4. Callback handler: unregistered → `/auth/acct-registration`; registered → `/dashboard` → `/dashboard/:id` → role view.
5. Unregistered user fills the registration form (first/last name, account type, DOB, phone, email) → form POSTs to `/auth/push-registration/<user.id>?_method=PUT`.
6. Server writes profile fields + `registrationStatus: true` + one permission flag → redirect `/auth/registration-success/<id>`.
7. Success page → "Account Dashboard" button → `/dashboard/<user.id>` → role dashboard.
8. `Sign out` (any nav) → `/auth/logout` → session ends → `/`.
- Belt-and-braces: the `registrationStatus` gate is enforced in BOTH the OAuth callback and `getDashboard`, so deep-linking to `/dashboard/:id` while unregistered still redirects to registration.
- Cancel path: the registration form's Cancel button goes to `/auth/logout` (logs out and returns to login).

---

## 4. UI Spec (per view)

Common layout notes:
- Login-style pages (`index`, `registration-user`, `registration-user-success`) include `partials/login-head`: `<title>JCKC Login</title>`, gray-50 background, Font Awesome 6.1.2 CDN, `/css/style.css` (a prebuilt Tailwind output; the Tailwind CDN `<script>` is commented out on login pages).
- Dashboard-style pages include `partials/dashboard-head`: `<title>JCKC Dashboard</title>`, gray-100 background, `/css/style.css`, **Tailwind CDN script**, Font Awesome 6.2.0, Flowbite 1.5.5 CSS; `partials/dashboard-close-tag` loads Flowbite JS + `/js/main.js` (mobile-menu toggle).
- **MARKUP BUG (all pages):** `login-head.ejs`/`dashboard-head.ejs` end with `<body></body></html>` — i.e. body and html are CLOSED before the page content is emitted, and the close-tag partial closes them again. All real content sits after `</html>`. Browsers tolerate this but it is invalid HTML. FIX in re-implementation (trivially resolved by a React layout).

### 4.1 `views/index.ejs` — Login page (`GET /`)
- Centered card, heading (h2): **"Log in to your JCKC account"**.
- White card containing a horizontal divider with the label **"Continue with Google"**, and below it a single full-width bordered button-style link:
  - `href="/auth/google"`, content = Font Awesome Google icon (`<i class="fab fa-google left">`), screen-reader text "Log in with Google".
- No other form fields, no email/password. This is the only entry point.

### 4.2 `views/error/no-account.ejs` — OAuth failure page
- Completely unstyled (no head/close partials, no layout — just two elements):
  - `<p>No account exists</p>`
  - `<a href="/">Go back to Login Page</a>`
- QUIRK: message text is misleading (accounts are auto-created; page shows only on OAuth failure). Re-implementation should reword ("Sign-in failed") and style it.

### 4.3 `views/registration-user.ejs` — Account registration form (`GET /auth/acct-registration`)
- Login-head layout. Heading (h2): **"Register your JCKC Account"**.
- `<form action="/auth/push-registration/<%= user.id %>?_method=PUT" method="POST">` — fields in order, each in its own block with a label above, all styled identically:

| Label | `name`/`id` | Input type | Required | Notes |
|---|---|---|---|---|
| First Name | `firstNameApp` | text | yes (HTML `required`) | |
| Last Name | `lastNameApp` | text | yes | |
| Account Type | `accountType` | `<select>` | yes | **Only one active option: `<option value="admin" selected>Admin</option>`.** Options `parent` ("Parent", was default-selected) and `teacher` ("Teacher") are COMMENTED OUT in the markup. |
| Date of Birth | `dateOfBirth` | date | yes | posts `YYYY-MM-DD` string |
| Phone Number | `phoneNumber` | tel | yes | no pattern/format validation |
| Email Address | `emailAddress` | email | yes | `autocomplete="email"`; user types it because Google email scope is not requested |

- Buttons: **Submit** (`type="submit"`, id `registerAcct`, indigo primary) and **Cancel** — an `<a href="/auth/logout">` wrapping a `type="button"` white/gray button (cancel = log out).
- QUIRK/DECISION NEEDED: with parent/teacher options commented out, **every new self-registration becomes an admin** (this looks like a development-phase shortcut, since parents/teachers have no functional dashboards yet). The re-implementation should NOT let users self-select "admin"; recommended fix: admin assigns roles, or default new users to a pending/parent role. Preserving the literal behavior (everyone = admin) is almost certainly wrong for production.
- Server-side: none of the HTML `required` constraints are re-validated on the server.

### 4.4 `views/registration-user-success.ejs` — Success page (`GET /auth/registration-success/:id`)
- Login-head layout. Heading (h2): **"JCKC Account Registration Successful!"**
- Paragraph: "Go to your Account Dashboard to continue."
- One indigo button-style link: **"Account Dashboard"** → `href="/dashboard/<%= user.id %>"`.

### 4.5 Shared dashboard chrome
- `partials/header.ejs` (all three dashboards): white bar with left h2 **"Hello, `<%= user.firstNameApp %>`!"** and right h3 **`<%= formatDate() %>`** = today's date `M/D/YYYY` (no zero padding).
- Navigation bars (indigo-600, responsive desktop links + hamburger `#mobile-button` toggling `#mobile-menu` for < md screens; mobile menu repeats the same links):
  - **Admin nav** (`partials/navigation-admin` → `nav-links/admin` + `nav-links/logout`): `Dashboard` → `/dashboard/<user.id>`, `Students` → `/student/students-summary`, `Classrooms` → `/classroom/classrooms-summary`, `Reports` → `/report/reports-summary`; right side `Sign out` → `/auth/logout`.
  - **Parent nav** (`partials/navigation-parent` → `nav-links/parent` + logout): `Dashboard` → `/dashboard/<user.id>`, `Students` → `/student/students-summary`, `Parent Profile` → `/profile/<user.id>`; `Sign out` → `/auth/logout`.
  - **Generic nav** (`partials/navigation`, used by the teacher dashboard): desktop links `Dashboard` → `#` (dead) and `Reports` → `#` (dead); mobile menu `Dashboard` → `/dashboard/<user.id>`, `Reports` → `#`; `Sign out` → `/auth/logout`. (Inconsistent/dead links — teacher UI is unfinished.)

### 4.6 `views/dashboard-admin.ejs` — Admin dashboard (`GET /dashboard/:id`, accountType `'admin'`)
Data in scope: `students` (ALL Student docs), `classrooms` (ALL Classroom docs), `user`.
- Page title (h1, centered): **"Admin Dashboard"**.
- **Section 1 — "Students Summary"** (section h1) with an action button on the right: **"+ New Student"** → `/student/registration-student` (indigo primary link-button).
  - Below: a gray card containing a responsive `<ul>` grid (1 col / 2 cols sm / 3 cols lg) of five stat items (label bold, value normal). Exact computations (done inline in EJS):
    1. **"No. of Infants in Rooms:"** = `classrooms.filter(e => e.ageGroup == 'infant').reduce((p,a) => p + students.filter(e => e.classroom == a.id).length, 0)` — i.e. count of students whose `classroom` ObjectId equals an infant classroom's id. **Counts by the CLASSROOM's ageGroup, not the student's own `ageGroup` field.** (`e.classroom == a.id` relies on ObjectId→string `==` coercion.)
    2. **"No. of Toddlers in Rooms:"** — same formula with `'toddler'`.
    3. **"No. of Preschoolers in Rooms:"** — same formula with `'preschool'`.
    4. **"No. of Active Students:"** = `students.filter(e => e.classroom).length` — "active" ≡ assigned to any classroom.
    5. **"No. of Inactive Students:"** = `students.filter(e => !e.classroom).length` — unassigned students.
- **Section 2 — "Classrooms Summary"** (section h1) with action button **"Edit"** → `/classroom/classrooms-summary`.
  - A responsive card grid (1/2/3 cols) of classroom tiles, iterating `sortClassrooms(classrooms)` (intended order infant → toddler → preschool, then classroomName A→Z; see comparator bug in 1.5). Each tile:
    - Left color block (w-16, rounded left) whose background depends on ageGroup: `'infant'` → `bg-pink-600`, `'toddler'` → `bg-yellow-500`, **anything else** → `bg-green-500`; text = `e.ageGroup.substring(0,3).toUpperCase()` → `INF` / `TOD` / `PRE`.
    - Right white panel: classroom name as a link — **`<%= e.classroomName %>`** → `href="/classroom/details/<%= e.id %>"`; next to it a pill badge (always green-100/green-800 regardless of ageGroup) with `properNoun(e.ageGroup)` (`Infant`/`Toddler`/`Preschool`).
    - Gray line: `<%= e.teacherName %>` (Classroom.teacherName string; may be undefined → renders empty).
    - Gray line: **"No. of Students: `<%= students.filter(child => child.classroom == e.id).length %>`"** — per-classroom student count computed client-side-in-template from the full students array.
- No tables, no pagination, no search on this page.
- REST re-implementation suggestion: a `GET /dashboard/admin` (or `/stats`) endpoint returning `{ infantsInRooms, toddlersInRooms, preschoolersInRooms, activeStudents, inactiveStudents, classrooms: [{ id, classroomName, ageGroup, teacherName, studentCount }] }` computed server-side with aggregation, instead of shipping all students to the client.

### 4.7 `views/dashboard-teacher.ejs` — Teacher dashboard (accountType `'teacher'`)
- **Placeholder page.** Uses the generic `partials/navigation` (dead desktop links, see 4.5) + header partial.
- Content: a single empty box — `<div class="border-4 border-dashed border-gray-200 rounded-lg h-96"></div>` with "Replace with your content" comments. No data, no title text.
- Re-implementation: treat as unbuilt; product decision required for teacher home content.

### 4.8 `views/dashboard-parent.ejs` — Parent dashboard (accountType `'parent'`)
- Uses parent nav + header.
- Page title (h1, centered): `<%= user.accountType.toUpperCase() %> DASHBOARD` → renders **"PARENT DASHBOARD"** (dynamic only in letter case source).
- **Section: "Today's Checked-In Students:"** — a table with columns:
  - `Name` (always visible; on small screens the cell also shows a stacked `<dl>` with "Birthday: …" (hidden ≥ lg) and "Teacher: …" (hidden ≥ sm)),
  - `Birthday` (hidden below lg),
  - `Teacher` (hidden below sm),
  - `Status`.
  - **The single table row is HARDCODED DUMMY DATA:** Name "Lindsay Walton", Birthday "06/06/2022", Teacher "Stacey Smith", Status "Checked In [TIME]". A commented-out per-row "Edit" column exists. No loop over any data — the check-in feature was never wired up.
- **Section: check-in CTA** — a full-width indigo rounded-pill block containing **`<a href="#">CHECK IN STUDENTS</a>`** — a dead link (feature not implemented).
- Re-implementation: treat the check-in table/CTA as an unimplemented mock; the intended feature is "show today's check-ins for this parent's children with check-in time, plus a check-in action".

---

## 5. Quirks & Bugs Ledger (with preserve/fix recommendations)

| # | Issue | Where | Recommendation |
|---|---|---|---|
| 1 | Content rendered after `</body></html>` (head partials pre-close the document) | all views via `login-head`/`dashboard-head` | FIX (non-issue in React) |
| 2 | `next` undefined in logout handler → ReferenceError on logout error | `controllers/auth.js` `logout` | FIX |
| 3 | `PUT /auth/push-registration/:id` — IDOR: no check that `:id` == authenticated user; also no server-side validation of any field, no accountType enum check | `controllers/auth.js` `pushRegistration` | FIX (use auth principal; validate with DTOs) |
| 4 | Registration = two sequential non-transactional updates; failure between them leaves registered user w/o permission flag; unknown accountType sets no flag | same | FIX (single atomic update / derive role) |
| 5 | Registration error path sends no HTTP response (request hangs) | same | FIX |
| 6 | Registration form only offers `admin` (parent/teacher `<option>`s commented out) → every new signup self-assigns admin | `registration-user.ejs` | FIX — do not allow self-selected admin; restore role choice or make roles admin-assigned |
| 7 | `GET /auth/acct-registration` accessible to already-registered users → silent profile/role overwrite | route + controller | FIX (gate on registrationStatus) |
| 8 | Permission booleans (`parentPermission` etc.) are written but never checked; NO role-based authorization on any route | whole app | FIX — implement real RBAC from `accountType` |
| 9 | Permission flags only ever set true; role changes accumulate multiple true flags | `pushRegistration` | FIX (single role field) |
| 10 | `/dashboard/:id` and `/profile/:id` ignore `:id` entirely; behavior driven by `req.user` | `controllers/home.js` | FIX/simplify — drop the id segment (`/dashboard`) |
| 11 | Unknown/empty `accountType` on a registered user → `getDashboard` renders nothing, request hangs; same for `getProfile` | `controllers/home.js` | FIX (default branch / 403) |
| 12 | `profile-teacher.ejs` and `profile-admin.ejs` do not exist → 500 for those roles at `/profile/:id` | `home.getProfile` | FIX or omit until profiles exist |
| 13 | OAuth email scope missing; email collected by hand in a form (typo-prone, unverified) | `config/passport.js` | FIX — request `email` scope, prefill/verify |
| 14 | Passport verify callback swallows DB errors without calling `done` → hang | `config/passport.js` | FIX |
| 15 | Any Google account is auto-provisioned a User record — no allowlist/invite | `config/passport.js` | Decide: preserve open signup or add invites; at minimum don't grant admin (see #6) |
| 16 | `no-account` page text "No account exists" is wrong (page = OAuth failure) and unstyled | `views/error/no-account.ejs` | FIX wording/styling |
| 17 | Hardcoded session secret `'keyboard mouse'`; hardcoded Heroku callback URL | `app.js`, `config/passport.js` | FIX (env config) |
| 18 | `sortClassrooms` comparator non-transitive (infant vs preschool = 0) and mutates input | `app.js` | FIX with rank map; preserve intended order infant→toddler→preschool, then name A→Z |
| 19 | `formatDate` throws if given a `Date` object; unpadded output for "today" vs padded for stored strings | `app.js` | FIX; standardize `MM/DD/YYYY` |
| 20 | Admin "Infants/Toddlers/Preschoolers in Rooms" counts use the CLASSROOM's ageGroup, not the student's | `dashboard-admin.ejs` | PRESERVE semantics (they are "in rooms" counts) but compute server-side |
| 21 | "Active/Inactive" student status is purely derived from classroom assignment (no status field) | `dashboard-admin.ejs` | PRESERVE definition |
| 22 | Admin dashboard loads ALL students & classrooms and computes counts in the template | `home.getDashboard` | FIX — aggregate server-side |
| 23 | Parent dashboard table + "CHECK IN STUDENTS" are hardcoded mock content; teacher dashboard is an empty placeholder; generic nav has dead `#` links | dashboards/navs | Feature gap — do not replicate dummy data; build or stub the real check-in feature |
| 24 | Doc comments in controllers use camelCase paths (`/auth/acctRegistration`) that differ from real kebab-case routes | `controllers/auth.js` | Ignore comments; kebab-case paths are real |
| 25 | `User.dateOfBirth` (and Student's) stored as `YYYY-MM-DD` strings, not Dates | models | Decide; recommend ISO date strings or Date type consistently |
| 26 | `image` (Google avatar) captured but never displayed | model/views | Optional: surface it in the new UI |
| 27 | All `accountType` comparisons are exact lowercase string matches (`'parent'|'teacher'|'admin'`) | throughout | PRESERVE the three role values as the canonical enum |
