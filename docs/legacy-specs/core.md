# CORE SPEC — Server Bootstrap, Auth, Session, View Helpers, Data Models, Migration

Legacy app: Express 4 + EJS + Mongoose 6 daycare-management app ("JCKC"), deployed to Heroku
(`https://jckc-web-app-private.herokuapp.com`). This document specifies the app-level plumbing
(app.js), configuration, Passport Google OAuth, auth middleware, all global view-helper functions,
the exact shape of all four Mongoose schemas, and the data quirks revealed by the
2026-03-15 parent-guardian import migration.

Source files covered (all under `C:\Projects\JCKC Web App\jckc-web-app-private`):
`app.js`, `package.json`, `tailwind.config.js`, `Procfile`, `config/db.js`, `config/passport.js`,
`config/.env.example`, `middleware/auth.js`, `models/User.js`, `models/Student.js`,
`models/Classroom.js`, `models/Guardian.js`,
`scripts/migrations/import-parent-guardians-2026-03-15.js`.

---

## 1. Runtime & Package Facts

- `package.json` name: `jckc-client-site-demo`; version string is used as a changelog marker:
  `"2026.01.20.STUDENT_LIST_PAGINATION_AND_SEARCH"`.
- Engines: Node `14.x`, npm `6.14.8`.
- Scripts:
  - `start`: `cross-env NODE_ENV=production node app.js`
  - `dev`: `cross-env NODE_ENV=development nodemon app.js`
  - `migrate:parents:2026-03-15`: `node scripts/migrations/import-parent-guardians-2026-03-15.js`
- `Procfile`: `web: node app.js` (Heroku web dyno; note: does NOT set NODE_ENV — that comes from
  Heroku config vars).
- Dependencies (exact list): `connect-mongo ^3.1.2`, `dotenv ^16.0.1`, `ejs ^3.1.8`, `env ^0.0.2`,
  `express ^4.18.1`, `express-handlebars ^6.0.6`, `express-session ^1.17.3`, `heroku ^7.3.0`,
  `method-override ^3.0.0`, `moment ^2.29.4`, `mongoose ^6.5.1`, `morgan ^1.10.0`,
  `passport ^0.6.0`, `passport-google-oauth20 ^2.0.0`, `pdfkit ^0.13.0`, `pdfmake ^0.2.5`,
  `xlsx ^0.18.5`.
  - QUIRK (do not preserve): `express-handlebars`, `env`, and `heroku` are dead dependencies —
    the app renders EJS, never Handlebars. `moment` is available for views/routes (used elsewhere,
    not in core files). `pdfkit`/`pdfmake` support the report feature; `xlsx` is used only by the
    migration script.
- Dev dependencies: `cross-env ^7.0.3`, `nodemon ^2.0.19`, `tailwindcss ^3.1.8`.

### tailwind.config.js
- `content`: `["./views/*.{html,ejs,js}", "./views/partials/*.{html,ejs,js}", "./views/partials/nav-links/*.{html,ejs,js}"]`
  — i.e. views live in `views/`, with `views/partials/` and `views/partials/nav-links/` subfolders.
- Theme extends colors `sky` and `teal` from `tailwindcss/colors` (redundant in Tailwind v3 —
  both are already defaults).
- Plugins: `require('@tailwindcss/forms')`.
  - QUIRK/BUG: `@tailwindcss/forms` is NOT listed in package.json at all. A fresh
    `npm install` + tailwind build would fail unless it happens to be transitively present.
    Fix in re-implementation (or drop the plugin).

---

## 2. Server Bootstrap & Middleware Pipeline (app.js) — exact order

1. `dotenv.config({ path: './config/.env' })` — env loaded from `config/.env` (relative to CWD,
   so the app must be started from the project root).
2. `require('./config/passport')(passport)` — registers the Google strategy (Section 4).
3. `connectDB()` — `config/db.js`: `mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })`;
   logs `MongoDB Connected: <host>` on success; on error logs and `process.exit(1)`.
4. `const PORT = process.env.PORT || 3000`.
5. `express.static(path.join(__dirname, 'public'))` — static assets from `public/` served at `/`.
6. Logging: `morgan('dev')` ONLY when `process.env.NODE_ENV === 'development'`.
7. Body parsing: `express.urlencoded({ extended: false })` then `express.json()`.
8. `methodOverride("_method")` — HTML forms simulate PUT/DELETE via `?_method=PUT` /
   `?_method=DELETE` in the action URL (query string) or a `_method` body field. The re-implemented
   REST API should use real HTTP verbs; legacy forms rely on this.
9. Session (see Section 3).
10. `passport.initialize()` then `passport.session()`.
11. Global locals middleware: on EVERY request, `res.locals.user = req.user || null`. Every EJS
    view can therefore read `user` (the full Mongoose User doc, or null) — this is what drives
    per-role conditional rendering in the views (e.g. `user.adminPermission`).
12. Helper functions registered on `app.locals` (available in every EJS render) — Section 5.
13. Route mounting (order matters):
    - `app.use('/', require('./routes/index'))`
    - `app.use('/auth', require('./routes/auth'))`
    - `app.use('/student', require('./routes/student'))`
    - `app.use('/guardian', require('./routes/guardian'))`
    - `app.use('/classroom', require('./routes/classroom'))`
    - `app.use('/report', require('./routes/report'))`
    (Individual route behavior is specified in the other feature-area specs.)
14. `app.listen(PORT)` logging `` `Server running in ${process.env.NODE_ENV} mode on port ${PORT}` ``.

Notable absences (all QUIRKS):
- **No view engine is configured.** There is no `app.set('view engine', 'ejs')` and no
  `app.set('views', ...)`. Express defaults `views` to `./views`; because no default engine is
  set, every `res.render(...)` call in the routes must pass the file extension explicitly
  (e.g. `res.render('login.ejs')`) or rendering throws. Re-implementation: irrelevant for a
  REST API, but explains why route files reference templates with `.ejs` suffixes.
- No global error-handling middleware and no 404 handler — unknown paths get Express's default
  `Cannot GET ...` 404; thrown errors get the default HTML 500 stack page (stack hidden in
  production). Fix: add proper error handling in the NestJS re-implementation.
- No helmet/CORS/CSRF protection of any kind. Fix in re-implementation.
- No body size limits beyond Express defaults.

---

## 3. Session Handling

```js
app.use(session({
  secret: 'keyboard mouse',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}))
```

- `connect-mongo` v3 legacy API: `const MongoStore = require('connect-mongo')(session)`.
  Sessions are persisted in the SAME MongoDB database, default collection name `sessions`,
  default TTL 14 days (connect-mongo v3 default).
- **BUG/SECURITY (fix, do not preserve): the session secret is the hardcoded string
  `'keyboard mouse'`** — not read from env. Re-implementation must use a secret from
  configuration (or JWTs).
- Cookie: express-session defaults — name `connect.sid`, no `maxAge` (session cookie,
  expires when browser closes), `httpOnly: true`, not `secure` (works over plain HTTP; on Heroku
  behind TLS this means the cookie is not marked Secure — another thing to fix).
- `resave: false`, `saveUninitialized: false` — a session document is only created after
  Passport logs a user in.
- Passport session contents: `serializeUser` stores only the Mongo `user.id` string;
  `deserializeUser` runs `User.findById(id, callback)` on every authenticated request and
  attaches the full User document as `req.user`. (Mongoose 6 callback API — removed in
  Mongoose 7+, so this exact code will not port.)

---

## 4. Authentication

### 4.1 middleware/auth.js — the only auth middleware in the app

```js
ensureAuth(req, res, next): if (req.isAuthenticated()) next(); else res.redirect('/')
ensureGuest(req, res, next): if (req.isAuthenticated()) res.redirect('/dashboard'); else next()
```

- `ensureAuth`: gate for logged-in pages. Unauthenticated users are 302-redirected to `/`
  (the login page). There is NO flash message and NO `returnTo` — after login you always land
  on `/dashboard` regardless of what you originally requested.
- `ensureGuest`: used on the login page; logged-in users get bounced to `/dashboard`.
- **There is NO role middleware.** `parentPermission` / `teacherPermission` /
  `adminPermission` / `registrationStatus` enforcement, where it exists at all, happens inside
  individual route handlers or purely in EJS view conditionals (i.e., some pages are only
  *hidden* from non-admins, not actually protected — see the route/view specs; treat every
  role restriction there with suspicion). Re-implementation: enforce roles server-side with
  guards on every endpoint.

### 4.2 config/passport.js — Google OAuth 2.0 strategy

- Callback URL selected by environment (exact strings):
  - `NODE_ENV == 'development'` → `http://localhost:3000/auth/google/callback`
  - otherwise → `https://jckc-web-app-private.herokuapp.com/auth/google/callback`
- Strategy config: `clientID: process.env.GOOGLE_CLIENT_ID`,
  `clientSecret: process.env.GOOGLE_CLIENT_SECRET`, `callbackURL: baseUrl`.
- Verify callback logic (exact):
  1. Build `newUser` object:
     ```js
     {
       googleId: profile.id,
       displayName: profile.displayName,
       firstNameGoog: profile.name.givenName,
       lastNameGoog: profile.name.familyName,
       firstNameApp: '',
       lastNameApp: '',
       dateOfBirth: '',
       phoneNumber: '',
       emailAddress: '',
       accountType: '',
       image: profile.photos[0].value,
       parentPermission: false,
       teacherPermission: false,
       adminPermission: false,
       registrationStatus: false,
     }
     ```
  2. `User.findOne({ googleId: profile.id })`.
  3. If found → `done(null, user)` (login). **Existing users are NEVER updated** — a changed
     Google display name or avatar is not synced after first login.
  4. If not found → `User.create(newUser)` → `done(null, user)`. Every first-time Google login
     auto-creates an account with ALL permissions false and `registrationStatus: false`
     (unregistered). Promotion to parent/teacher/admin happens elsewhere (user-management
     feature) — there is no seed/bootstrap admin mechanism in code; the first admin must be
     flipped manually in the database.
- **The user's Google email is NOT captured.** `emailAddress` is initialized to `''` and the
  profile's email is never read (the OAuth scope requested in routes/auth is profile-only).
  Re-implementation decision: capture email (fix) or preserve.
- **BUG (fix): the try/catch only does `console.log(error)` and never calls `done(err)`** —
  a DB failure during login leaves the OAuth callback request hanging forever.
- `require('ejs')`'s `render` and `mongoose` are imported in this file but unused (dead code).

### 4.3 User identity/permission model semantics

- A "user" is a Google account holder. Role flags are independent booleans, not an enum:
  `parentPermission`, `teacherPermission`, `adminPermission` (a user can hold several).
- `accountType` is a free-text String (set during registration flow; no enum in the schema).
- `registrationStatus: false` means the user has authenticated with Google but has not completed
  the in-app registration form; views/routes use it to gate access to real content.

---

## 5. Global View Helpers (app.locals) — exact logic

These six functions are registered on `app.locals` in app.js and are callable from every EJS
template. They encode core business rules (age-group thresholds, display formats, sort orders)
that the React SPA must reproduce.

### 5.1 `formatDate(date)`
```js
let dateToFormat, month, day, year
if (!date) { dateToFormat = new Date() }
if (typeof date == 'string') {
  dateToFormat = date.split('-')
  month = dateToFormat[1]; day = dateToFormat[2]; year = dateToFormat[0]
} else {
  month = dateToFormat.getMonth() + 1; day = dateToFormat.getDate(); year = dateToFormat.getFullYear()
}
return `${month}/${day}/${year}`
```
- Input is expected to be an ISO-ish string `"YYYY-MM-DD"` (dates of birth are stored as
  Strings — see schemas). Output: `"MM/DD/YYYY"` **with the zero-padding preserved from the
  string** (e.g. `"2023-04-05"` → `"04/05/2023"`, not `"4/5/2023"`).
- Falsy input → formats today's date, and because it goes through the Date branch the parts are
  NOT zero-padded (e.g. `7/2/2026`).
- **BUG (fix): passing an actual `Date` object (truthy, non-string) leaves `dateToFormat`
  undefined and throws `TypeError` at `dateToFormat.getMonth()`.** The helper only works for
  falsy values and strings. It also does no validation — `"garbage"` returns
  `"undefined/undefined/garbage"`.
- If a datetime string like `"2023-04-05T00:00:00"` were passed, day would be `"05T00:00:00"` —
  callers must pass pure `YYYY-MM-DD`.

### 5.2 `calcAgeGroup(birthday)` — THE age-group business rule
```js
const today = new Date()
const dateOfBirth = new Date(birthday)
let age = (today - dateOfBirth) / 1000 / 60 / 60 / 24 / 365   // years, using a fixed 365-day year
if (age * 12 < 11)      return 'infant'
else if (age * 12 < 30) return 'toddler'
else                    return 'preschool'
```
- Age in "months" = years × 12 where a year is exactly 365 days (leap days make children
  fractionally "older"; months are not calendar months).
- Thresholds (exact): **age < 11 months → `'infant'`; 11 ≤ age < 30 months → `'toddler'`;
  age ≥ 30 months → `'preschool'`.** These three lowercase strings are the only age-group
  values in the system and must match `Classroom.ageGroup` / `Student.ageGroup` values.
- `new Date("YYYY-MM-DD")` parses as UTC midnight; `new Date()` is local — a child can flip
  age group up to a timezone-offset early/late. Minor; preserve or fix, but keep the 11/30
  month thresholds exactly.
- Invalid/empty birthday → `NaN` comparisons are false → returns `'preschool'` (hidden
  default; flag but probably fix with validation).

### 5.3 `convertAge(birthday)` — human-readable age
```js
let age = (today - dateOfBirth) / 1000 / 60 / 60 / 24 / 365
if (age * 12 < 1) return `${Math.floor(age * 52)} week${Math.floor(age * 52) > 1 ? 's' : ''} old`
else              return `${Math.floor(age * 12)} month${Math.floor(age * 12) > 1 ? 's' : ''} old`
```
- Under 1 month (i.e. under ~30.4 days): floor(weeks) + `"week(s) old"`. Pluralizes only
  when > 1, so `"1 week old"` and — QUIRK — `"0 week old"` (no 's') for newborns under 7 days.
- Otherwise ALWAYS months, never years: a 3-year-old renders as `"36 months old"` (floor of
  365-day-year months). Preserve this month-based display unless product wants years.
- Future birthdays produce negative numbers (e.g. `"-3 months old"`); invalid dates produce
  `"NaN months old"`. No validation anywhere.

### 5.4 `properNoun(name)`
```js
let ans = name.toLowerCase()
return ans[0].toUpperCase() + ans.substring(1, ans.length)
```
- Lowercases the entire string then capitalizes ONLY the first character:
  `"McDONALD"` → `"Mcdonald"`, `"mary ann"` → `"Mary ann"` (second word stays lowercase),
  `"o'brien"` → `"O'brien"`.
- **BUG: throws `TypeError` on empty string** (`ans[0]` is undefined) and on non-strings.
- Re-implementation: decide whether to keep this naive single-letter capitalization for display
  parity or do real title-casing (recommend fix, but note stored data may already be
  inconsistently cased — see migration, Section 8).

### 5.5 `sortClassrooms(objArray)`
```js
return objArray.sort((a,b) => (a.classroomName).localeCompare(b.classroomName))
  .sort((a,b) => {
    if ((a.ageGroup == 'infant' && b.ageGroup == 'toddler') || (a.ageGroup == 'toddler' && b.ageGroup == 'preschool')) return -1
    else if ((a.ageGroup == 'preschool' && b.ageGroup == 'toddler') || (a.ageGroup == 'toddler' && b.ageGroup == 'infant')) return 1
    else return 0
  })
```
- Intent: alphabetical by `classroomName`, then grouped in age order infant → toddler →
  preschool. Sorts IN PLACE and returns the same array.
- **BUG: the age comparator only orders adjacent pairs; `infant` vs `preschool` compares
  as 0 (equal).** Because V8's sort is stable, whether every infant room actually precedes
  every preschool room depends on the intermediate ordering — with rooms of all three groups
  present the outcome is generally correct only by luck of pairwise passes; it is NOT a valid
  total order. Also, any classroom whose `ageGroup` is not exactly one of the three lowercase
  strings sorts as "equal to everything". Re-implementation: fix with an explicit rank map
  `{infant: 0, toddler: 1, preschool: 2}` then name — this matches the intent and the usual
  observed output.

### 5.6 `sortName(objArray)`
```js
return objArray.sort((a,b) => (a.studentFirstName).localeCompare(b.studentFirstName))
```
- Sorts student arrays in place by `studentFirstName` using `localeCompare`
  (case-insensitive-ish, locale-aware). Ties (same first name) keep insertion order; last name
  is NOT a tiebreaker. Only meaningful for Student objects (field name is hardcoded); throws
  if an element lacks `studentFirstName`.

---

## 6. Environment Configuration (config/.env.example)

Required variables (loaded from `config/.env` in dev; Heroku config vars in prod):

| Var | Meaning | Notes |
|---|---|---|
| `MONGO_URI` | MongoDB connection string (Atlas or local) | Also used by the session store and migration script |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Redirect URIs must include both dev & prod callbacks |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | |
| `NODE_ENV` | `development` \| `production` | Selects OAuth callback URL AND enables morgan logging in development |
| `PORT` | default 3000 | Heroku assigns automatically |

No session-secret variable exists (hardcoded — see Section 3).

---

## 7. Mongoose Schemas — exact shape (all four models)

All models use `createdAt: { type: Date, default: Date.now }` and Mongo's implicit `_id`.
None enable `timestamps`; there is no `updatedAt` anywhere. No indexes are declared on any
schema (not even a unique index on `User.googleId` — duplicates are only prevented by the
find-before-create logic in passport.js, which is race-prone).

### 7.1 `User` (collection `users`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `googleId` | String | yes | — | Google profile id; NOT unique-indexed (quirk) |
| `displayName` | String | yes | — | From Google |
| `firstNameGoog` | String | yes | — | Google given name |
| `lastNameGoog` | String | yes | — | Google family name |
| `firstNameApp` | String | no | — | User-entered during registration; created as `''` |
| `lastNameApp` | String | no | — | created as `''` |
| `dateOfBirth` | **String** | no | — | created as `''`; format `YYYY-MM-DD` when filled |
| `phoneNumber` | String | no | — | created as `''` |
| `emailAddress` | String | no | — | created as `''`; NOT populated from Google (quirk) |
| `accountType` | String | no | — | free text, no enum; created as `''` |
| `image` | String | no | — | Google avatar URL, captured once at first login |
| `createdAt` | Date | no | `Date.now` | |
| `parentPermission` | Boolean | no | none (schema) | passport sets `false` at creation |
| `teacherPermission` | Boolean | no | none (schema) | passport sets `false` |
| `adminPermission` | Boolean | no | none (schema) | passport sets `false` |
| `registrationStatus` | Boolean | no | none (schema) | passport sets `false`; true after in-app registration |

Naming quirk to preserve or consciously rename: the duplicated name fields
(`*Goog` = from Google, `*App` = user-entered) and `dateOfBirth`/dates stored as Strings.

### 7.2 `Student` (collection `students`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `studentFirstName` | String | yes | — | |
| `studentLastName` | String | yes | — | |
| `dateOfBirth` | **String** | yes | — | `YYYY-MM-DD` (HTML `<input type="date">` value); all age math parses this string |
| `studentStreetAddress` | String | yes | — | |
| `studentCity` | String | yes | — | |
| `studentState` | String | yes | — | |
| `studentZIP` | String | yes | — | |
| `teacherName` | String | no | — | Denormalized copy of the classroom's teacher (quirk: can go stale vs `Classroom.teacherName`) |
| `ageGroup` | String | no | — | `'infant'` \| `'toddler'` \| `'preschool'` — NO enum enforcement in schema; derived via `calcAgeGroup(dateOfBirth)` at write time and never auto-recomputed as the child ages (quirk) |
| `classroom` | ObjectId ref `"Classroom"` | no | — | populate target |
| `createdAt` | Date | no | `Date.now` | |

### 7.3 `Classroom` (collection `classrooms`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `classroomName` | String | yes | — | |
| `ageGroup` | String | yes | — | expected `'infant'`/`'toddler'`/`'preschool'`, NO enum in schema |
| `teacherName` | String | no | — | free text, not a User ref |
| `createdAt` | Date | no | `Date.now` | |

### 7.4 `Guardian` (collection `guardians`)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `guardianFirstName` | String | yes | — | |
| `guardianLastName` | String | yes | — | |
| `phoneNumber` | String | yes | — | canonical display format `XXX-XXX-XXXX` (established by migration) |
| `guardianStreetAddress` | String | yes | — | |
| `guardianCity` | String | yes | — | |
| `guardianState` | String | yes | — | two-letter uppercase, e.g. `TN` |
| `guardianZIP` | String | yes | — | 5 digits |
| `students` | **Array (untyped, schemaless)** | no | — | see element shape below |
| `createdAt` | Date | no | `Date.now` | |

**`Guardian.students` element shape** (not declared in the schema; established by app code and
the migration script):
```js
{
  student: <Student _id — stored as a STRING by the migration, possibly ObjectId elsewhere>,
  relationshipToStudent: 'Mother' | 'Father' | 'Guardian' | <free text>,
  authorizedToPickUp: true  // Boolean
}
```
- QUIRK (critical for re-implementation): because `students` is a bare `Array`, Mongoose applies
  NO casting — the migration writes `student` as a plain **string** id
  (`link.studentId`/`desiredLink.studentId` are `String(...)` values), while application code may
  have written ObjectIds. Any lookup/join must compare with `String(a) === String(b)` like the
  migration does, and `populate` cannot be used on this path. The new schema should be a typed
  subdocument array with `student: ObjectId ref Student`, `relationshipToStudent: string`,
  `authorizedToPickUp: boolean`, plus a data-cleaning step to cast the string ids.

---

## 8. Migration Script — `scripts/migrations/import-parent-guardians-2026-03-15.js`

One-off bulk import of guardians from an Excel workbook
(default path `../data/jckc_parent_info_2026_03_15.xlsx`, i.e. OUTSIDE the repo, one level above
project root). Run modes: `--dry-run` (report only) or `--write` (apply), optional
`--file <path>`. Exactly one mode is required or it exits with a usage error. Connects with
`MONGO_URI` from `config/.env`; prints a full JSON report (summary, createActions,
updateActions, heldRows, warnings) to stdout.

### Workbook format
- First worksheet only; columns by position: `[0]` Student name, `[1]` Guardian(s),
  `[2]` Address, `[3]` Phone. Blank rows dropped; the header row is detected by normalized
  values `student` / `guardian s` / `address` / `phone` and skipped.

### Matching & normalization rules (these reveal how names are compared)
- `normalizeNameKey`: lowercase → strip `"` and `'` → non-alphanumerics to single spaces → trim.
  So `Jai'ana` ≡ `jaiana`, hyphens/periods ignored.
- Students matched by normalized `"first last"` full name against ALL students in the DB
  (`Student.find({}, { studentFirstName: 1, studentLastName: 1 }).lean()`).
  - 0 matches → row held with `student_not_found`; >1 → `ambiguous_student_match`.
- Guardians deduped/matched the same way against existing `Guardian` docs; >1 existing match
  holds all the candidate's rows with `ambiguous_guardian_match`.

### DATA QUIRKS the script hard-codes (these describe the PRODUCTION DATA)
1. **`STUDENT_NAME_OVERRIDES`: workbook `Jai'ana Hilliard` maps to DB `Jai'ana Hillard`** —
   i.e. the student's last name is (mis)spelled "Hillard" in the production database. Any
   re-import/cleanup must know the DB spelling is the divergent one.
2. **`MANUAL_REVIEW_STUDENTS`: `Mara Cerone`** is force-held (`student_manual_review_required`)
   — this student's workbook row could not be trusted automatically.
3. **Phone typo fix: raw digit string `42306121245` (11 digits) is corrected to
   `4236121245`** before formatting — one workbook phone number had a duplicated digit.
4. Leading `1` on 11-digit numbers is stripped; anything that isn't 10 digits after cleanup is
   rejected (`invalid_phone` / `invalid_paired_phone`).
5. **Canonical phone format: `XXX-XXX-XXXX`** (e.g. `423-612-1245`).

### Address parsing
- Split on commas: part 0 = street, part 1 = city, rest = state/zip remainder.
- ZIP: first `\d{5}` (optionally `-\d{4}`, the +4 is discarded). Missing ZIP → `missing_zip`.
- State: first 2-letter token or the word "Tennessee" in the remainder, uppercased;
  `TENNESSEE` → `TN`; **if no state found, defaults to `'TN'`** (this is a Tennessee daycare).
- Missing street or city → `invalid_address_shape`.

### Guardian-name parsing
- `"Name1 & Name2"` = a mother/father pair. The phone cell must contain BOTH labeled numbers
  matching `/(mom|dad)\s*([()\d\-\s]+?)/gi` (exactly one `mom` + one `dad`), else
  `invalid_paired_phone`. Mom's number → first guardian with
  `relationshipToStudent: 'Mother'`; dad's → second with `'Father'`.
- Shared-last-name expansion: if the name before `&` is a single word (first name only) and the
  second name has ≥2 words, the second name's last word(s) are appended
  (`"Ashley & John Smith"` → guardians `Ashley Smith` + `John Smith`).
- Single guardian: whole cell split on whitespace, first token = `guardianFirstName`, the rest
  joined = `guardianLastName` (so `"Mary Ann Lee"` becomes first `Mary`, last `Ann Lee` —
  quirk), relationship = `'Guardian'`, single phone required.
- Names are stored EXACTLY as they appear in the workbook (no case normalization) — the DB may
  contain mixed-case names; display-level `properNoun` partially papers over this.

### Dedup/merge semantics
- Candidates keyed by normalized guardian full name across ALL rows; a guardian appearing on
  multiple student rows becomes ONE guardian with multiple `students` links.
- If later rows carry different phone/address for the same guardian, the FIRST row's contact
  data wins and a `conflicting_workbook_contact_data` warning is emitted (rows are not held).
- Every link gets `authorizedToPickUp: true` unconditionally.

### Write behavior (`--write`)
- Creates: `Guardian.create({...contact fields, students: [{ student: <stringId>, relationshipToStudent, authorizedToPickUp: true }]})`.
- Updates (guardian with same normalized name already exists AND contact or links differ):
  - Overwrites ALL five contact fields with workbook values (even if only one differed).
  - Merges `students`: existing link for the same student id (string-compared) is updated
    in place (relationship overwritten, `authorizedToPickUp` forced `true`, other custom keys
    on the link preserved via `Object.assign`); missing links appended.
  - No-op guardians (no contact diff, no link diff) are skipped entirely.
- Nothing is ever deleted; students are never modified by this script.
- Held-row reasons (full enum): `missing_student_name`, `student_manual_review_required`,
  `student_not_found`, `ambiguous_student_match`, `missing_address`, `missing_zip`,
  `invalid_address_shape`, `missing_guardian_name`, `invalid_guardian_pair`,
  `invalid_paired_phone`, `invalid_guardian_name_parts`, `invalid_phone`,
  `ambiguous_guardian_match`.

---

## 9. Routes (core-level view only)

app.js mounts six routers; their internals are specced elsewhere. Core-level facts:

| Mount | File | Purpose |
|---|---|---|
| `/` | `routes/index.js` | login page (`ensureGuest`) + `/dashboard` (`ensureAuth`) + registration |
| `/auth` | `routes/auth.js` | `/auth/google`, `/auth/google/callback`, logout |
| `/student` | `routes/student.js` | student CRUD, list pagination + search |
| `/guardian` | `routes/guardian.js` | guardian CRUD |
| `/classroom` | `routes/classroom.js` | classroom CRUD |
| `/report` | `routes/report.js` | PDF/report generation (pdfkit/pdfmake) |

Auth conventions all routes share: `ensureAuth` → redirect `/` when logged out;
`ensureGuest` → redirect `/dashboard` when logged in; role flags checked ad hoc (or not at all)
inside handlers/views.

## 10. UI-layer contract provided by core (for the view specs)

Every EJS template implicitly receives:
- `user` — full User doc or `null` (drives nav rendering, permission-based show/hide,
  avatar `user.image`, `user.displayName`).
- The six `app.locals` helpers (Section 5) — views call them directly, e.g.
  `<%= formatDate(student.dateOfBirth) %>`, `<%= convertAge(student.dateOfBirth) %>`,
  `<%= properNoun(student.studentFirstName) %>`, `sortClassrooms(classrooms)`,
  `sortName(students)`, `calcAgeGroup(...)`.
- Styling: Tailwind v3 with `@tailwindcss/forms`; extra palette names `sky`, `teal`;
  static CSS/JS served from `public/`.

The React SPA must re-implement the helper outputs exactly where display parity matters
(date `MM/DD/YYYY` zero-padded from stored string, ages in weeks/months only, age-group
thresholds 11/30 months on a 365-day year, classroom ordering infant→toddler→preschool then
name, student lists ordered by first name).

## 11. Consolidated Quirks & Bugs — preserve vs fix

| # | Item | Verdict |
|---|---|---|
| 1 | Session secret hardcoded `'keyboard mouse'` | FIX (env/config secret or JWT) |
| 2 | Passport verify callback swallows errors, never calls `done(err)` — request hangs on DB error | FIX |
| 3 | Google email never stored (`emailAddress: ''`, profile-only scope) | FIX (capture email) unless product says otherwise |
| 4 | Existing users never re-synced from Google (name/avatar frozen at first login) | Product decision; document either way |
| 5 | No unique index on `User.googleId`; find-then-create race can duplicate users | FIX (unique index / upsert) |
| 6 | No role-based middleware; role checks ad hoc in handlers/views (some admin pages likely only hidden, not protected) | FIX (server-side guards on every endpoint) |
| 7 | `ensureAuth` has no returnTo; post-login always lands on `/dashboard` | Preserve behavior or improve; low risk |
| 8 | `formatDate` throws on Date objects; no validation; zero-padded output from strings | FIX implementation, PRESERVE `MM/DD/YYYY` output |
| 9 | `calcAgeGroup` thresholds: <11 months infant, <30 months toddler, else preschool; 365-day year; invalid date → 'preschool' | PRESERVE thresholds exactly; FIX invalid-date fallback |
| 10 | `Student.ageGroup` computed at write time, never recomputed as child ages; can disagree with `calcAgeGroup(dateOfBirth)` at read time | FIX (derive at read time) or add recompute job — decide explicitly |
| 11 | `convertAge` shows months forever (never years); `"0 week old"` singular quirk; negative/NaN ages unvalidated | PRESERVE weeks/months display; FIX validation |
| 12 | `properNoun` capitalizes only 1st char of whole string; throws on empty string | FIX robustness; keep display behavior only if parity needed |
| 13 | `sortClassrooms` comparator not a total order (infant vs preschool = 0) | FIX with rank map {infant:0,toddler:1,preschool:2} + name — matches intent |
| 14 | `sortName` sorts by first name only, no last-name tiebreaker | PRESERVE (product behavior) unless asked |
| 15 | Dates of birth stored as Strings (`YYYY-MM-DD`) in User and Student | FIX to real dates in new API; keep `YYYY-MM-DD` wire format |
| 16 | `Guardian.students` is an untyped Array; migration stores `student` ids as STRINGS; element shape `{student, relationshipToStudent, authorizedToPickUp}` | FIX schema (typed subdocs, ObjectId refs) + data cast; all joins must string-compare until then |
| 17 | `Student.teacherName` / `Classroom.teacherName` denormalized free text; can go stale | FIX (derive from classroom) or document |
| 18 | No enum on `ageGroup` (Student/Classroom) or `accountType` (User) | FIX with enums: `infant|toddler|preschool` |
| 19 | No view engine set in app.js (`res.render` must use `.ejs` suffix) | N/A for REST re-implementation; explains route code |
| 20 | Dead deps: `express-handlebars`, `env`, `heroku`; missing dep: `@tailwindcss/forms` used by tailwind.config but not in package.json | FIX (clean dependency list) |
| 21 | No 404/error middleware, no helmet/CORS/CSRF, cookie not `secure` in prod | FIX |
| 22 | DB data quirks: student surname stored as `Hillard` (workbook says `Hilliard`); `Mara Cerone` row needed manual review; guardian names stored in raw workbook casing; phones normalized `XXX-XXX-XXXX`; state defaults to `TN` | Know when migrating data to the new system |
| 23 | Method override via `_method` query param (forms use `?_method=PUT/DELETE`) | N/A in REST API (use real verbs) |
| 24 | Mongoose 6 callback APIs (`User.findById(id, cb)`) — removed in Mongoose 7+ | FIX (promises) |

---

## Audit corrections

1. **§2 item 8 (method-override)**: the claim that `methodOverride("_method")` honors "a `_method` body field" is WRONG. In method-override v3, a plain string getter (not starting with `X-`) creates a **query-string-only** getter (`createQueryGetter`); `req.body` is never consulted unless a custom function getter is supplied. This is harmless in practice because every form in the app puts `_method` in the action's query string (`...?_method=PUT` / `?_method=DELETE`), but a re-implementer must not expect body-field override to work.
2. **Repo-meta files not covered by any spec** (completeness note; no business logic lost):
   - `README.md` — version changelog only (v0.00.01 2022-09-10 → v1.00.00 2022-09-22, "PROJECT COMPLETE"); describes the app as "Client App for JCKC (Daycare Business)". No behavior not already specified.
   - `CLAUDE.md` — AI-assistant guidance restating architecture/commands already covered here; note it mislabels the `app.locals` view helpers as "Handlebars helpers" (they are plain Express `app.locals` used from EJS — this spec's Section 5 is authoritative).
   - `.gitignore` — exactly two entries: `node_modules` and `.env`. The slash-less `.env` pattern matches at any depth, so it also covers `config/.env`; verified with `git ls-files` that `config/.env` (which exists on disk with live secrets) is NOT tracked — only `config/.env.example` is committed.
