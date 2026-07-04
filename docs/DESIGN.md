# JCKC v2 Migration — Architecture Contract (DESIGN.md)

Every implementation agent MUST follow this document. Feature behavior comes from the spec
files in this same directory (core.md, auth-dashboards.md, students.md, classrooms.md,
guardians.md, reports.md, ui-layout.md); coding conventions from conventions.md.

## Repos

- **Backend**: `C:\Projects\JCKC Web App\jckc-spa-v2\jckc-spa-backend` — NestJS 11 (Express 5 under the hood — route wildcards use `{*splat}` syntax, NOT `*`). Serves REST API on port **3001**, all routes under global prefix `/api`.
- **Frontend**: `C:\Projects\JCKC Web App\jckc-spa-v2\jckc-spa-frontend` — TanStack Start + React 19 + Vite + Tailwind v4, dev server port **3000**.
- Path alias in frontend: `#/*` → `./src/*`. Prettier: no semicolons, single quotes (see conventions.md).

## Database — MongoDB, preserved collections

Connect via `@nestjs/mongoose` using `MONGO_URI`. **Domain collections keep the legacy names and
exact field names** so existing production data keeps working unchanged:

- `students` — Mongoose schema `Student`: studentFirstName, studentLastName (required), dateOfBirth (String, required), studentStreetAddress/studentCity/studentState/studentZIP (required), teacherName, ageGroup, classroom (ObjectId ref Classroom), createdAt.
- `classrooms` — `Classroom`: classroomName (required), ageGroup (required), teacherName, createdAt.
- `guardians` — `Guardian`: guardianFirstName, guardianLastName, phoneNumber, guardianStreetAddress/guardianCity/guardianState/guardianZIP (all required), createdAt, and `students`: an array of **link subdocuments** `{ student: ObjectId, relationshipToStudent: string, authorizedToPickUp: boolean }` (legacy schema declares it as a bare Array — the new schema must model the subdocument shape explicitly but stay byte-compatible with existing docs, including tolerating dangling student refs).
- Legacy `users` collection is superseded by better-auth's `user` collection (see Auth). A
  migration script maps legacy users in.

Schemas are declared with `@Schema({ collection: '...' })` + `@Prop` decorators in
`src/modules/<feature>/schemas/*.schema.ts`.

## Auth — better-auth hosted in the NestJS backend

- `better-auth` (^1.5.x) instance created in `src/modules/auth/`, using the **mongodb adapter**
  fed from the existing mongoose connection: `mongodbAdapter(connection.getClient().db())`.
- Providers: **Google OAuth** (`socialProviders.google` from GOOGLE_CLIENT_ID/SECRET) — parity
  with legacy — plus **email & password** enabled (modernization).
- `user.additionalFields` mirrors the legacy User model semantics:
  - `role`: string, default `""` — one of `"" | "parent" | "teacher" | "admin"` (legacy `accountType`).
  - `registrationStatus`: boolean, default false (has the user completed the in-app registration form).
  - `parentPermission`, `teacherPermission`, `adminPermission`: booleans, default false (admin-granted approvals — preserve legacy semantics per auth-dashboards.md).
  - `firstName`, `lastName`, `phoneNumber`, `dateOfBirth`: strings, default `""` (legacy firstNameApp/lastNameApp etc.).
- Mounting: app created with `NestFactory.create(AppModule, { bodyParser: false })`; JSON/urlencoded
  body parsing re-applied via middleware for everything EXCEPT `api/auth/{*splat}`; better-auth's
  `toNodeHandler(auth)` handles `/api/auth/{*splat}` (ALL methods). `basePath: '/api/auth'`,
  `baseURL` = BETTER_AUTH_URL (http://localhost:3001), `trustedOrigins: [FRONTEND_ORIGIN]`.
- CORS: `app.enableCors({ origin: FRONTEND_ORIGIN, credentials: true })`.
- **AuthGuard** (global, with `@Public()` decorator opt-out): resolves session via
  `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`, attaches `req.user`.
- **RolesGuard** + `@Roles('admin', 'teacher', ...)` decorator checks `user.role`, honoring the
  legacy access rules in the specs. `@CurrentUser()` param decorator.
- Frontend keeps ONLY `src/lib/auth-client.ts`, re-pointed:
  `createAuthClient({ baseURL: import.meta.env.VITE_API_URL })` with `inferAdditionalFields`.
  DELETE `src/lib/auth.ts` and `src/routes/api/auth/$.ts` (server-side auth moves to Nest).

## Backend module layout

```
src/
  main.ts                  # bodyParser:false, CORS, global prefix /api (exclude nothing), ValidationPipe, port 3001
  app.module.ts            # ConfigModule.forRoot (global, validated), MongooseModule.forRootAsync, feature modules
  common/                  # decorators (Public, Roles, CurrentUser), guards, filters, utils
  common/utils/age.ts      # calcAgeGroup, convertAge, formatDate, properNoun — EXACT legacy logic (see core.md)
  modules/auth/            # better-auth instance provider, AuthGuard, RolesGuard, auth middleware mount
  modules/users/           # admin user management + POST /api/users/register (complete registration), GET /api/users/me
  modules/students/        # CRUD + pagination + search per students.md
  modules/classrooms/      # CRUD + roster management per classrooms.md
  modules/guardians/       # CRUD + student linkage per guardians.md
  modules/reports/         # pdfmake PDF generation per reports.md — stream response, do NOT write to disk
  modules/dashboard/       # GET /api/dashboard — role-appropriate stats per auth-dashboards.md
scripts/migrate-legacy-users.ts  # legacy users collection → better-auth user docs
```

- DTOs with class-validator; global `ValidationPipe({ whitelist: true, transform: true })`.
- Global exception filter maps Mongoose CastError → 400, not-found → 404 with JSON `{ statusCode, message }`.
- Pagination convention: `?page=1&search=` → response `{ items, total, page, pageSize, totalPages }`
  with the legacy page size (see students.md).
- Config validated at boot (fail fast on missing MONGO_URI etc.). `.env` + `.env.example` in repo root.

## REST surface (route names, subject to spec details)

- `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/:id` (roles per students.md; parents see only their own via guardian linkage per guardians.md)
- `GET/POST /api/classrooms`, `GET/PATCH/DELETE /api/classrooms/:id`, `PUT /api/classrooms/:id/students` (roster assignment)
- `GET/POST /api/guardians`, `GET/PATCH/DELETE /api/guardians/:id`
- `GET /api/users` (admin), `PATCH /api/users/:id` (admin: role/permissions), `POST /api/users/register`, `GET /api/users/me`
- `GET /api/reports/...` per reports.md — returns `application/pdf`
- `GET /api/dashboard`

## Frontend layout

```
src/
  router.tsx               # + QueryClient wired into router context (keep scaffold's ssr-query integration)
  lib/auth-client.ts       # better-auth react client -> VITE_API_URL
  lib/utils.ts             # cn() (existing)
  lib/age.ts               # calcAgeGroup/convertAge/formatDate mirrors of backend utils
  api/client.ts            # fetch wrapper: credentials 'include', VITE_API_URL base, typed ApiError
  api/<resource>.ts        # endpoint fns + react-query hooks + shared TS types per resource
  components/ui/*          # shadcn/ui primitives (button, card, input, label, select, table, dialog, badge, dropdown-menu, sonner)
  components/*             # AppShell (role-aware sidebar/nav per ui-layout.md), PageHeader, StatCard,
                           # DataTable helpers, PaginationBar, SearchInput, ConfirmDialog, AgeGroupBadge, EmptyState
  routes/
    __root.tsx             # html shell (keep), devtools only in DEV
    index.tsx              # public landing/login page (Google + email/password)
    register.tsx           # post-signup registration form (legacy registration-user flow)
    _authed.tsx            # layout: session guard (redirect '/' if none, '/register' if !registrationStatus), AppShell
    _authed/dashboard.tsx  # role-based dashboard (admin/teacher/parent variants per auth-dashboards.md)
    _authed/students/ (index, new, $studentId, $studentId.edit)
    _authed/classrooms/ (index, new, $classroomId, $classroomId.edit, $classroomId.roster)
    _authed/guardians/ ($guardianId, $guardianId.edit, new)
    _authed/profile.tsx    # parent profile per guardians.md
    _authed/reports.tsx    # report generation page per reports.md (downloads PDFs from API)
```

- Data fetching: react-query hooks only (no SSR loaders for protected data); mutations invalidate
  the affected queries; toasts via sonner.
- Forms: react-hook-form + zod resolvers, field names matching API DTOs.
- Role gating in UI mirrors backend rules (hide admin nav from parents, etc. per ui-layout.md).

## Design direction (frontend)

Commit to the scaffold's existing "seaside kindergarten" design system in `styles.css` —
tokens `--sea-ink, --sea-ink-soft, --lagoon, --lagoon-deep, --palm, --sand, --foam, --surface,
--surface-strong, --line, --kicker, --bg-base, --chip-*, --hero-*` with **Fraunces** (display
serif, page titles/kickers) + **Manrope** (body). Aesthetic: warm organic minimalism — soft
sea-green washes, glassy `--surface` cards with hairline `--line` borders, generous whitespace,
rounded-2xl geometry, small uppercase Manrope "kicker" labels over Fraunces headings. Playful but
professional (it's a daycare). Support `.dark` via existing tokens. Staggered page-load reveals
(CSS animation-delay), subtle hover lifts on cards/rows. NEVER generic: no purple gradients, no
default zinc-only look — lean on the sea/lagoon/palm palette for identity; shadcn zinc variables
remain for structural neutrals underneath.

## Binding modernization decisions (resolve spec "DECISION NEEDED" items)

1. **Roles**: canonical enum `'parent' | 'teacher' | 'admin'` on `user.role`. The registration form
   offers ONLY Parent and Teacher (legacy's admin-only dropdown was a dev shortcut — do not preserve).
   Admin is granted two ways: (a) an existing admin changes a user's role in the new admin Users page,
   (b) bootstrap: if the registering user's email is in `ADMIN_EMAILS` (comma-separated env), they
   register as admin. Registration endpoint `POST /api/users/register` operates on the AUTHENTICATED
   user only (fixes legacy IDOR), is a single atomic update (profile fields + role + registrationStatus
   + the matching legacy permission boolean for data continuity), validates with DTOs, and returns 409
   if already registered. Google OAuth requests email scope (fixes legacy missing-email quirk).
2. **Parent↔student linkage (fixes students.md Q1/Q2)**: Student schema gains two optional fields —
   `createdByUserId: String` and `applicationApprovalStatus: Boolean`. Parent-created students get
   `{ createdByUserId: user.id, applicationApprovalStatus: false }` (a pending application);
   admin-created students get `applicationApprovalStatus: true`. **Missing field (all legacy docs) is
   treated as approved.** Guardian schema gains optional `userId: String` (better-auth user id) for
   future linking. Parent's student list = `GET /api/students/mine` → students where
   `createdByUserId = me` OR linked via a guardian with `userId = me`; response split into
   `registered` (approved) and `pending` sections, matching the legacy parent page's two tables.
   Admin approves via `PATCH /api/students/:id` (`applicationApprovalStatus: true`) — admin list shows
   a Pending badge + Approve action for pending students.
3. **Role access matrix** (server-enforced with guards — legacy had none):
   - Students: list/details GET = admin, teacher; POST = admin, parent; PATCH/DELETE = admin; `/mine` = parent.
   - Classrooms (incl. roster endpoints): GET = admin, teacher; mutations = admin.
   - Guardians: all admin (student-details guardian read also allows teacher).
   - Reports: admin, teacher. Users admin endpoints: admin. `/api/users/me`, `/register`: any authenticated.
   - Dashboard: any authenticated (content varies by role).
4. **Teacher role** (legacy = broken placeholder): teachers get read-only Students + Classrooms +
   Reports and a dashboard showing the classrooms overview (same stats as admin dashboard, no user
   management, no mutations). Nav: Dashboard, Students, Classrooms, Reports, Sign out.
5. **Parent dashboard** (legacy = hardcoded mock): show the parent's own students (from /mine) as
   cards with name, age (convertAge), classroom/teacher if assigned, plus approval status — NOT the
   fake check-in table. No check-in feature (out of scope; legacy never had it).
6. **Deletes & cascades (new capabilities, fixing dangling-link bugs)**: DELETE student cascades
   `$pull` of guardian links; DELETE classroom (new route) sets affected students' `classroom = null`;
   DELETE guardian (new); DELETE guardian↔student link (new). All return 404 for unknown ids.
7. **Data formats preserved**: DOB stays a `YYYY-MM-DD` STRING in DB and on the wire (validated:
   regex + real date + not future). Display `MM/DD/YYYY` (padded) for stored dates, `M/D/YYYY`
   (unpadded) for "today" in the greeting header. Ages always weeks (<1 month) / months (never years),
   thresholds: <11 months infant, <30 months toddler, else preschool, using 365-day-year math —
   EXACT legacy semantics; fix only the "0 week" pluralization ("0 weeks old"). `properNoun` for
   age-group labels. ZIPs are strings (text inputs, not number). State select keeps the legacy
   57-code list with default `TN`.
8. **Sorting fixed as intended**: classrooms by ageGroup rank {infant:0, toddler:1, preschool:2}
   then classroomName A→Z; student lists by first name, case-insensitive collation
   (`{ locale: 'en', strength: 2 }`), with lastName then _id tiebreakers. Search inputs are trimmed
   and regex-escaped before `$regex` (fixes injection/crash).
9. **Pagination parity**: page size 10 everywhere; params `page`, `status` (`active|inactive|all`,
   default `active`), `search`, `order` (`asc|desc`, default asc) for the admin student list; the
   classroom roster editor keeps two independent panes (add = unassigned students, remove = this
   classroom's students) each with its own page+search, multi-page selection preserved client-side
   (React state replaces sessionStorage), explicit `{ studentIds: string[] }` bodies (fixes the
   body-keys-as-ids protocol). Page clamped to [1, totalPages]; filter/search/sort changes reset to
   page 1; response shape `{ items, pagination: { currentPage, totalPages, totalCount, pageSize,
   startIndex, endIndex, hasPrevious, hasNext } }`.
10. **Reports**: generated on demand in memory and streamed with auth (fixes the world-readable
    `public/reports` PDFs). Exact legacy document structure: sign-in sheet landscape + roll-call
    sheet portrait, one page per classroom (ordered per rule 8), students sorted by LAST name
    (`localeCompare`), 'JC KIDZ CLUBHOUSE' / '408 W Market St, Johnson City, TN 37604' headers,
    same table layouts (IN/OUT sign-in columns; MON–FRI IN/OUT roll-call rows with
    `DOB: MM/DD/YYYY`). Roboto TTFs copied from legacy `public/fonts` into backend `assets/fonts`
    (nest-cli asset copy configured); pdfmake `PdfPrinter` server-side.
11. **Guardians**: `authorizedToPickUp` honors the submitted value (fixes hardcoded-true bug);
    duplicate guardian↔student links rejected with 409; dangling legacy links tolerated on read
    (surfaced like the legacy "Unresolved Student Links" panel) and preserved on personal-field
    updates. Guardian create still requires an initial student link (parity) via
    `POST /api/students/:studentId/guardians` `{ guardian: {...} | guardianId, relationshipToStudent,
    authorizedToPickUp }`.
12. **Parent profile page** (legacy = dead stub): real `GET /api/users/me` + `PATCH /api/users/me`
    (firstName, lastName, dateOfBirth, phoneNumber; email shown read-only from auth). Available to
    all roles (fixes the missing teacher/admin profile views).
13. **Migration script** `scripts/migrate-legacy-users.ts`: maps legacy `users` docs → better-auth
    `user` + `account` collections (googleId → account { providerId: 'google', accountId },
    accountType→role, registrationStatus, firstNameApp→firstName, etc.; emailAddress may be '' —
    generate placeholder `legacy-<_id>@placeholder.invalid` with a warning list). Also
    `scripts/normalize-guardian-links.ts`: casts string `students[].student` ids (from the 2026-03-15
    import) to ObjectIds. Both idempotent, `--dry-run`/`--write` modes like the legacy migration.
14. **Errors**: every legacy hang/console-only path becomes a proper HTTP error (400 CastError,
    404 not found, 409 conflict, 403 wrong role, 401 unauthenticated). JSON body
    `{ statusCode, message, error }` (Nest default shape).

## Environment

- Backend `.env`: `MONGO_URI`, `PORT=3001`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3001`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_ORIGIN=http://localhost:3000` (+ `.env.example`).
- Frontend `.env.local`: `VITE_API_URL=http://localhost:3001`.

## Testing

- Backend: jest unit tests per service (models mocked with `getModelToken`), utils parity tests
  (age-group thresholds: <11 months infant, <30 months toddler, else preschool; convertAge weeks vs
  months), e2e smoke via mongodb-memory-server (auth signup + students CRUD) under `test/`.
- Frontend: vitest for lib/age.ts parity + api client error handling; component smoke tests where cheap.
- Everything must pass: backend `npm run build`, `npm run lint`, `npm test`; frontend `npm run build`, `npm run lint`, `npm test`.
