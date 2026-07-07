# JCKC v2 — REST API Contract (binding for backend AND frontend agents)

Base URL: `http://127.0.0.1:3001` (frontend reads `import.meta.env.VITE_API_URL`). All routes below
are under the global prefix `/api`. All requests/responses JSON unless noted. Auth = better-auth
session cookie (`credentials: 'include'` on every fetch). Errors use Nest's default JSON shape
`{ statusCode, message, error }` — message may be a string array for validation failures.

Conventions:
- Every resource exposes `id` (string), never `_id`.
- `createdAt` serialized as ISO string. `dateOfBirth` is ALWAYS a `YYYY-MM-DD` string.
- Roles: `'parent' | 'teacher' | 'admin'`; `''` (empty) = not yet registered.
- 401 when unauthenticated, 403 wrong role, 404 unknown/malformed id (CastError → 404), 400 validation.
- Pagination object (page size 10):
  `{ currentPage, totalPages, totalCount, pageSize, startIndex, endIndex, hasPrevious, hasNext }`
  — identical math to legacy (startIndex 0 when empty; totalPages min 1; page clamped to [1, totalPages]).

## Shared DTO shapes (define matching TS types on both sides)

```ts
UserDto = { id, email, name, image: string | null, role: '' | 'parent' | 'teacher' | 'admin',
            registrationStatus: boolean, firstName, lastName, phoneNumber, dateOfBirth, createdAt }
ClassroomDto = { id, classroomName, ageGroup: 'infant'|'toddler'|'preschool', teacherName, createdAt }
ClassroomWithCountDto = ClassroomDto & { studentCount: number }
StudentDto = { id, studentFirstName, studentLastName, dateOfBirth, studentStreetAddress,
               studentCity, studentState, studentZIP, ageGroup: string | null,
               classroom: ClassroomDto | null, applicationApprovalStatus: boolean, createdAt }
  // applicationApprovalStatus: missing in legacy docs → serialize as true
GuardianLinkDto = { studentId, relationshipToStudent, authorizedToPickUp: boolean,
                    student: { id, studentFirstName, studentLastName, dateOfBirth } | null } // null = dangling
GuardianDto = { id, guardianFirstName, guardianLastName, phoneNumber, guardianStreetAddress,
                guardianCity, guardianState, guardianZIP, createdAt, students: GuardianLinkDto[] }
GuardianForStudentDto = { id, guardianFirstName, guardianLastName, phoneNumber,
                          guardianStreetAddress, guardianCity, guardianState, guardianZIP,
                          relationshipToStudent, authorizedToPickUp }
Paginated<T> = { items: T[], pagination: Pagination }
```

## Auth (better-auth handles these at /api/auth/*)

Frontend uses `authClient` (better-auth react): `authClient.signIn.social({ provider: 'google', callbackURL: 'http://localhost:3000/dashboard' })`,
`authClient.signUp.email(...)`, `authClient.signIn.email(...)`, `authClient.signOut()`, `authClient.useSession()`.
Session user object includes the additional fields (role, registrationStatus, firstName, lastName,
phoneNumber, dateOfBirth) — configure `inferAdditionalFields` client plugin with matching shape.

## Users

| Route | Roles | Notes |
|---|---|---|
| `GET /api/users/me` | any authed | → UserDto |
| `PATCH /api/users/me` | any authed | body `{ firstName?, lastName?, dateOfBirth?, phoneNumber? }` (all optional, validated) → UserDto |
| `POST /api/users/register` | any authed | body `{ firstName, lastName, role: 'parent'\|'teacher', dateOfBirth, phoneNumber }` all required. 409 if `registrationStatus` already true. If user email ∈ `ADMIN_EMAILS` env → role becomes `'admin'` regardless of body. Sets registrationStatus=true + legacy permission boolean. → UserDto |
| `GET /api/users?page=&search=` | admin | search matches name/email/firstName/lastName (trimmed, regex-escaped, case-insensitive). Sorted by createdAt desc. → Paginated<UserDto> |
| `PATCH /api/users/:id` | admin | body `{ role: 'parent'\|'teacher'\|'admin' }` → UserDto. 400 if admin demotes THEMSELVES (self-lockout guard). |

## Students

| Route | Roles | Notes |
|---|---|---|
| `GET /api/students?page=&status=&search=&order=` | admin, teacher | status `active\|inactive\|all` default `active` (invalid → active); order `desc` else asc; search on first OR last name (trimmed, escaped, case-insensitive substring). Sort by studentFirstName with collation `{ locale: 'en', strength: 2 }`, tiebreak studentLastName then _id. → Paginated<StudentDto> (classroom populated) |
| `GET /api/students/mine` | parent | → `{ registered: StudentDto[], pending: StudentDto[] }` — students where createdByUserId = me OR linked via guardian with userId = me; split on applicationApprovalStatus (missing = true = registered). Sorted by first name. |
| `GET /api/students/:id` | admin, teacher | → StudentDto |
| `GET /api/students/:id/guardians` | admin, teacher | → GuardianForStudentDto[] (guardians linked to this student, sorted guardianFirstName asc case-insensitive) |
| `POST /api/students` | admin, parent | body: the 7 student fields, all required; state must be in the 57-code list; DOB valid + not future; ZIP 5 digits (string). Parent → applicationApprovalStatus=false + createdByUserId; admin → true. → StudentDto (201) |
| `PATCH /api/students/:id` | admin | body: any subset of the 7 fields + `applicationApprovalStatus?: boolean` (approve action). Validated like POST. → StudentDto |
| `DELETE /api/students/:id` | admin | 404 unknown. Cascades: `$pull` this student from all guardians' students arrays (handles both ObjectId and string-stored ids). → 204 |
| `POST /api/students/:studentId/guardians` | admin | body `{ guardianId?: string, guardian?: {7 guardian fields}, relationshipToStudent: string, authorizedToPickUp: boolean }` — exactly one of guardianId/guardian. 409 if guardian already linked to this student. → GuardianDto (201) |

## Guardians

| Route | Roles | Notes |
|---|---|---|
| `GET /api/guardians` | admin | → `{ id, guardianFirstName, guardianLastName, studentIds: string[] }[]` sorted first name asc (case-insensitive) — used by the "add guardian to student" picker |
| `GET /api/guardians/:id` | admin | → GuardianDto (links resolved; dangling → student: null) |
| `PATCH /api/guardians/:id` | admin | body `{ 7 personal fields (all required — full replace like legacy), links?: [{ studentId, relationshipToStudent, authorizedToPickUp }] }` — links only updates entries for EXISTING students already linked; dangling links preserved untouched; cannot add/remove links here. → GuardianDto |
| `DELETE /api/guardians/:id` | admin | → 204 |
| `DELETE /api/guardians/:id/students/:studentId` | admin | remove one link → 204; 404 if link absent |

## Classrooms

| Route | Roles | Notes |
|---|---|---|
| `GET /api/classrooms` | admin, teacher | → ClassroomWithCountDto[] sorted ageGroup rank (infant, toddler, preschool) then name A→Z |
| `GET /api/classrooms/:id` | admin, teacher | → `{ classroom: ClassroomDto, students: StudentDto[] }` students sorted first name asc |
| `POST /api/classrooms` | admin | body `{ classroomName, ageGroup ∈ enum, teacherName }` all required → ClassroomDto (201) |
| `PATCH /api/classrooms/:id` | admin | same fields, all required → ClassroomDto |
| `DELETE /api/classrooms/:id` | admin | sets `classroom: null` on its students → 204 |
| `GET /api/classrooms/:id/roster?addPage=&addSearch=&removePage=&removeSearch=` | admin | → `{ add: Paginated<StudentDto>, remove: Paginated<StudentDto> }` — add = unassigned students (classroom null/missing), remove = students of this classroom; independent search (escaped, ci) + pagination per pane; sorted first name asc (collation) |
| `POST /api/classrooms/:id/students` | admin | body `{ studentIds: string[] }` (min 1, valid ObjectIds). Assign each EXISTING student: set classroom + recompute ageGroup from DOB (11/30-month thresholds). Unknown ids reported, not fatal. → `{ added: number, notFound: string[] }` |
| `POST /api/classrooms/:id/students/remove` | admin | body `{ studentIds: string[] }`. Only unassigns students actually in THIS classroom (fixes legacy global-unassign bug); ageGroup left as-is (parity). → `{ removed: number, skipped: string[] }` |

## Reports

| Route | Roles | Notes |
|---|---|---|
| `GET /api/reports/sign-in-sheet` | admin, teacher | streams `application/pdf`, `Content-Disposition: attachment; filename="sign-in-sheet.pdf"`. Generated in memory per request. Layout per reports.md §4.1 (landscape; page per classroom in rank+name order; students of that classroom sorted by LAST name; JC KIDZ CLUBHOUSE + address header; Day/Date + Age Group blanks; Classroom/Teacher filled — teacher empty string when unset, never "undefined"). Zero classrooms → valid PDF with header + "No classrooms found." |
| `GET /api/reports/roll-call-sheet` | admin, teacher | same but portrait, week-of header, MON–FRI IN/OUT double rows, name cell includes `DOB: MM/DD/YYYY` (format the string directly — no timezone shifting) |

## Dashboard

`GET /api/dashboard` (any authed, registered):
- admin/teacher → `{ role, stats: { infantsInRooms, toddlersInRooms, preschoolersInRooms, activeStudents, inactiveStudents }, classrooms: ClassroomWithCountDto[] }`
  — "in rooms" counts = students assigned to classrooms OF that ageGroup (classroom's group, not student's); active = classroom set; inactive = not set. Computed server-side (aggregation or two queries), classrooms sorted rank+name.
- parent → `{ role, students: { registered: StudentDto[], pending: StudentDto[] } }` (same as /students/mine)
- unregistered (`registrationStatus false`) → 403 with message `REGISTRATION_REQUIRED` (frontend redirects to /register).

## Frontend route ↔ API usage map

| SPA route | Uses |
|---|---|
| `/` login | authClient (Google + email/password); session → redirect /dashboard or /register |
| `/register` | POST /api/users/register |
| `/dashboard` | GET /api/dashboard |
| `/students` | admin/teacher: GET /api/students (URL search params page/status/search/order kept in the route's search params); parent: GET /api/students/mine |
| `/students/new` | POST /api/students |
| `/students/$studentId` | GET /api/students/:id + GET /api/students/:id/guardians; delete dialog → DELETE |
| `/students/$studentId/edit` | PATCH /api/students/:id |
| `/students/$studentId/add-guardian` | GET /api/guardians + POST /api/students/:id/guardians |
| `/classrooms` | GET /api/classrooms |
| `/classrooms/new` | POST /api/classrooms |
| `/classrooms/$classroomId` | GET /api/classrooms/:id |
| `/classrooms/$classroomId/edit` | PATCH (+ DELETE) /api/classrooms/:id |
| `/classrooms/$classroomId/roster` | GET roster + POST students / students/remove |
| `/guardians/$guardianId` | GET /api/guardians/:id (+ link delete) |
| `/guardians/$guardianId/edit` | PATCH /api/guardians/:id |
| `/users` (admin) | GET /api/users, PATCH /api/users/:id |
| `/profile` | GET/PATCH /api/users/me |
| `/reports` | two download buttons hitting the report endpoints (window.open / anchor with credentials — same-site cookie works) |
