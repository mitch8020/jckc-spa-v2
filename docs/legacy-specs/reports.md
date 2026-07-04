# Feature Spec: Reports (PDF Sign-In Sheets & Roll Call Sheets)

Legacy source files covered:
- `controllers/report.js`
- `routes/report.js`
- `views/reports-summary-admin.ejs`
- Supporting context read for accuracy: `middleware/auth.js`, `models/Student.js`, `models/Classroom.js`, `models/User.js`, `app.js`, `views/partials/*` (dashboard-head, navigation-admin, nav-links/admin, header, dashboard-close-tag)

---

## 1. Overview

The reports area generates exactly **two PDF report types**, both built with **pdfmake** (server-side `PdfPrinter`) using the **Roboto** TTF font family:

1. **Sign-In Sheet** (`sign-in-sheet.pdf`) - one landscape page per classroom; a daily attendance sheet with blank IN/OUT columns for parent printed name, time, and signature per student.
2. **Roll Call Sheet** (`roll-call-sheet.pdf`) - one portrait page per classroom; a weekly (Mon-Fri) roll-call grid with IN/OUT rows per student and a comments column.

Both PDFs are (re)generated **every time the Reports Summary page is loaded** (`GET /report/reports-summary`) and written to disk under `./public/reports/`. The two download routes simply serve whatever file is currently on disk with `res.download()` (Content-Disposition: attachment). There is no per-classroom or filtered report; each PDF always contains **all classrooms**, one page per classroom, listing that classroom's students.

The router is mounted in `app.js` as: `app.use('/report', require('./routes/report'))`

---

## 2. Routes

All three routes are `GET`, all guarded only by `ensureAuth`:

| Method | Full Path | Middleware | Controller fn | Purpose |
|---|---|---|---|---|
| GET | `/report/reports-summary` | `ensureAuth` | `getReportsSummary` | Generate BOTH PDFs to disk, then render `reports-summary-admin.ejs` |
| GET | `/report/sign-in-sheets` | `ensureAuth` | `createSignInSheets` | `res.download('./public/reports/sign-in-sheet.pdf')` |
| GET | `/report/roll-call-sheets` | `ensureAuth` | `createRollCallSheets` | `res.download('./public/reports/roll-call-sheet.pdf')` |

### Auth middleware behavior (`middleware/auth.js`)
- `ensureAuth`: if `req.isAuthenticated()` (Passport session) -> `next()`; **else `res.redirect('/')`** (the login/landing page).
- `ensureGuest` is imported in `routes/report.js` but **never used** in this router (dead import).

### Role restrictions
**NONE.** Although the view is named `reports-summary-admin.ejs` and renders the admin navigation, the routes do **not** check `req.user.accountType` (values used elsewhere in the app: `'parent'`, `'teacher'`, `'admin'`) or the permission booleans (`adminPermission`, etc.). Any authenticated user - including a parent - can load the reports page, regenerate the PDFs, and download them. Other controllers (e.g. `controllers/home.js`, `controllers/student.js`) branch on `accountType === 'admin'`; the report controller does not. **Recommend FIX in re-implementation: restrict all report endpoints to admin.**

### `GET /report/reports-summary` - step by step (`getReportsSummary`)

1. `let students = await Student.find()` - **all** students, no filter, no populate, no `.lean()`, no pagination.
2. In-memory sort: `students.sort((a,b) => (a.studentLastName).localeCompare(b.studentLastName))` - alphabetical by **last name only** (no first-name tiebreak; note other pages in the app sort students by *first* name via the `sortName` helper - this page differs).
3. `let classrooms = await Classroom.find()` - all classrooms, no filter/populate/lean.
4. Classrooms sorted in memory with **two chained `.sort()` calls**:
   - First: `(a,b) => (a.classroomName).localeCompare(b.classroomName)` (alphabetical).
   - Second (intended age-group ordering infant -> toddler -> preschool):

     ```js
     .sort((a,b) => {
       if ((a.ageGroup == 'infant' && b.ageGroup == 'toddler') || (a.ageGroup == 'toddler' && b.ageGroup == 'preschool')) return -1
       else if ((a.ageGroup == 'preschool' && b.ageGroup == 'toddler') || (a.ageGroup == 'toddler' && b.ageGroup == 'infant')) return 1
       else return 0
     })
     ```

     **BUG:** this comparator returns `0` for a direct `infant` vs `preschool` comparison, making it non-transitive. Because V8 sort is stable, same-group classrooms keep alphabetical order, but an infant room is not guaranteed to sort before a preschool room unless a toddler room happens to sit between them during comparison. E.g. classrooms `[preschoolRoom, infantRoom]` with no toddler room stay in that (wrong) order. This exact comparator is duplicated as the `sortClassrooms` helper in `app.locals` (used by other views). **Recommend FIX: sort by rank map `{infant: 0, toddler: 1, preschool: 2}` then by name.** Age-group enum values (lowercase, exact): `'infant'`, `'toddler'`, `'preschool'`.
5. `let today = new Date()` - **dead assignment**, immediately overwritten by the literal string: "Day: _______________   Date: _______________" (three spaces between the two blanks).
6. `let week = 'Week of ___ /___ to ___ /___'`.
7. Constructs a pdfmake `PdfPrinter` with fonts (paths relative to process CWD):

   ```js
   Roboto: {
     normal:      './public/fonts/Roboto-Regular.ttf',
     bold:        './public/fonts/Roboto-Medium.ttf',      // note: Medium, not Bold
     italics:     './public/fonts/Roboto-Italic.ttf',
     bolditalics: './public/fonts/Roboto-MediumItalic.ttf'
   }
   ```

   (These TTFs exist in `public/fonts/`; `Roboto-Bold.ttf` exists too but is NOT used - "bold" renders as Roboto **Medium**.)
8. Builds `signInPages` and `rollCallPages` (see section 4 for exact document structure): one array of content nodes **per classroom**, mapped over the sorted classrooms; each is flattened with `pages.reduce((p,a) => p.concat(a))`.
   **EDGE-CASE BUG:** if there are **zero classrooms**, `reduce` with no initial value throws `TypeError: Reduce of empty array with no initial value`, which is caught by the `try/catch`, logged with `console.error`, and - because the `res.render('error/500')` line is commented out - **no response is ever sent; the request hangs** until client timeout. Recommend FIX (return an empty PDF or a friendly message).
9. Creates both PDF documents and streams them to disk:

   ```js
   const signIn = printer.createPdfKitDocument(signInSheet);
   const rollCall = printer.createPdfKitDocument(rollCallSheet);
   signIn.pipe(fs.createWriteStream('./public/reports/sign-in-sheet.pdf'));
   rollCall.pipe(fs.createWriteStream('./public/reports/roll-call-sheet.pdf'));
   signIn.end();
   rollCall.end();
   ```

   - Paths are relative to the Node process CWD.
   - Files are **overwritten on every page load**.
   - Writing is **fire-and-forget**: `res.render` is called immediately, before the streams finish. There is a (small) race window where a download request could read a partially written file. No error handler is attached to the write streams - if `./public/reports/` did not exist, the unhandled 'error' event would **crash the process** (the directory is committed to the repo, with generated PDFs checked in, so this does not occur in practice).
10. `res.render('reports-summary-admin.ejs')` - no explicit locals; the view relies on `res.locals.user` (set globally from `req.user` in `app.js`) and `app.locals.formatDate`.
11. `catch (error)`: `console.error(error)`; the `res.render('error/500')` is commented out -> on any error the request **hangs with no response**.

### `GET /report/sign-in-sheets` / `GET /report/roll-call-sheets` - step by step

1. `res.download('./public/reports/<name>.pdf')` - Express resolves the relative path against CWD and sends the file with `Content-Disposition: attachment; filename="sign-in-sheet.pdf"` (resp. `roll-call-sheet.pdf`).
2. The surrounding `try/catch` is ineffective: `res.download` errors asynchronously. With no callback supplied, Express passes the error to `next()`; a missing file (ENOENT) yields the default Express **404** handler, not the commented-out 500 page.
3. **The download serves whatever was last generated** - i.e. data as of the most recent visit to `/report/reports-summary`, by *any* user. Handler names (`createSignInSheets` / `createRollCallSheets`) are misleading; they create nothing.
4. **SECURITY QUIRK:** because `app.use(express.static('public'))` is registered, both PDFs are also directly reachable **without any authentication** at `GET /reports/sign-in-sheet.pdf` and `GET /reports/roll-call-sheet.pdf` (note: no `/report` prefix - this is the static mount). Student names and DOBs leak to unauthenticated users. **Recommend FIX: generate on demand and stream to the response (or store outside the web root / behind auth).**

---

## 3. Data feeding the reports

### Models (exact field names)

`Student` (`models/Student.js`): `studentFirstName` (String, required), `studentLastName` (String, required), `dateOfBirth` (**String**, required - stored as the raw `<input type="date">` value, i.e. `YYYY-MM-DD`), `studentStreetAddress`, `studentCity`, `studentState`, `studentZIP` (all String required), `teacherName` (String), `ageGroup` (String), `classroom` (ObjectId ref "Classroom", optional), `createdAt` (Date, default now).

`Classroom` (`models/Classroom.js`): `classroomName` (String, required), `ageGroup` (String, required; `'infant' | 'toddler' | 'preschool'`), `teacherName` (String, optional), `createdAt` (Date, default now).

### Fields actually used by the reports
- Per classroom page: `classroomName`, `teacherName` (printed even if `undefined` - would render literally as `Teacher: undefined`; the classroom's `ageGroup` is **NOT** printed, a blank `Age Group: __________` line is printed instead - see quirks).
- Per student row: `studentFirstName`, `studentLastName`; roll call additionally uses `dateOfBirth`.
- Student->classroom matching: `if (e.classroom == room.id)` - **loose equality** between an ObjectId and the classroom's string virtual `id` (works via ObjectId toString). Students with no `classroom` set are **silently excluded from every report**. No `.populate()` is used anywhere.

### Query summary
| Query | Filter | Sort | Populate | lean | Pagination |
|---|---|---|---|---|---|
| `Student.find()` | none | in-memory by `studentLastName` (localeCompare) | no | no | none |
| `Classroom.find()` | none | in-memory by name, then buggy age-group comparator | no | no | none |

No write operations touch the database in this feature. The only writes are the two PDF files on disk.

---

## 4. PDF document specifications (pdfmake)

Common to both documents:
- Default pdfmake page size **A4**, default pdfmake margins, default font **Roboto** (the only registered family), default font size 12.
- Content = concatenation of per-classroom blocks. The **first** classroom's title has no page break; every subsequent classroom's title node carries `pageBreak: 'before'`, so each classroom starts a new page (a classroom with many students may still overflow onto extra pages naturally).

### 4.1 Sign-In Sheet (`sign-in-sheet.pdf`)

Document options: `pageOrientation: 'landscape'`.

Per-classroom content, in order:
1. `{ text: 'JC KIDZ CLUBHOUSE', style: 'header', alignment: 'center' }` (+ `pageBreak: 'before'` for index > 0).
2. `{ text: '408 W Market St, Johnson City, TN 37604', alignment: 'center' }` (facility address; sign-in sheet only).
3. **Meta table** - `style: 'tableExample'`, `widths: ['*','*']`, all four cells with `border: [false,false,false,false]` (borderless), 2 rows:

   | Left cell (style `subheader`) | Right cell (style `subheader`, `alignment: 'right'`) |
   |---|---|
   | `Day: _______________   Date: _______________` | `Classroom: ${classroomName}` |
   | `Age Group: __________` | `Teacher: ${teacherName}` |

4. **Main table** - `style: 'tableExample'`, `heights: 22` (every row 22pt tall, giving handwriting space), `widths: ['*', 125, 60, 80, 125, 60, 80]` (7 columns; student-name column takes remaining width).

Main table body (`signInTable(room)`):
- Header row 1 (group header): `[{}, {text:'IN', style:'tableHeader', colSpan:3, alignment:'center'}, {}, {}, {text:'OUT', style:'tableHeader', colSpan:3, alignment:'center'}, {}, {}]` - empty cell over the name column; "IN" spanning columns 2-4; "OUT" spanning columns 5-7.
- Header row 2 (column headers, all `style:'tableHeader'`, `alignment:'center'`):
  `STUDENT NAME` | `PARENT / GUARDIAN PRINTED NAME` | `TIME` | `SIGNATURE` | `PARENT / GUARDIAN PRINTED NAME` | `TIME` | `SIGNATURE`
- One row per student in the classroom (iterating the globally last-name-sorted `students`, filtered by `e.classroom == room.id`):
  `[{ text: "<studentFirstName> <studentLastName>", style: 'studentrow' }, {}, {}, {}, {}, {}, {}]` - six blank bordered cells for handwriting.

Styles object of this document:

```js
header:      { fontSize: 18, bold: true, margin: [0,0,0,5] }
subheader:   { fontSize: 16, bold: true, margin: [0,0,0,5] }
tableExample:{ margin: [0,0,0,0] }
tableHeader: { bold: true, fontSize: 13, color: 'black' }
```

**QUIRK:** style `'studentrow'` is referenced on the name cells but is **NOT defined** in this document's styles (only in the roll-call document), so pdfmake silently ignores it and student names render at the default 12pt. Preserve or fix at your discretion; visual intent was probably 10pt like the roll-call sheet.

### 4.2 Roll Call Sheet (`roll-call-sheet.pdf`)

Document options: none (portrait A4).

Per-classroom content, in order:
1. Same `JC KIDZ CLUBHOUSE` header node (with `pageBreak: 'before'` for index > 0). **No address line** on this report.
2. **Meta table** - identical shape to the sign-in meta table but the top-left cell is the week string:

   | Left (subheader) | Right (subheader, right-aligned) |
   |---|---|
   | `Week of ___ /___ to ___ /___` | `Classroom: ${classroomName}` |
   | `Age Group: __________` | `Teacher: ${teacherName}` |

3. **Main table** - `style:'tableExample'`, `heights: 22`, `widths: [100, 20, 28, 20, 28, 20, 28, 20, 28, 20, 28, 'auto']` - 12 columns: name (100pt), then five day-pairs of (20pt IN/OUT-label column, 28pt blank write-in column), then an `'auto'` COMMENTS column.

Main table body (`rollCallTable(room)`):
- Header row (no style, default 12pt, all `alignment:'center'`):
  `STUDENT NAME` | `MON` (colSpan 2) | `{}` | `TUE` (colSpan 2) | `{}` | `WED` (colSpan 2) | `{}` | `THU` (colSpan 2) | `{}` | `FRI` (colSpan 2) | `{}` | `COMMENTS`
- **Two rows per student**:
  - Row A: name cell `{ text: "<first> <last> \n DOB: " + moment(dateOfBirth).utc().format('L'), style: 'studentrow', rowSpan: 2 }`; then for each of the 5 days: `{ text: 'IN', style: 'subsubheader', alignment: 'center' }` followed by `{}` (blank write-in cell); final cell `{ text: '', rowSpan: 2 }` (comments, spans both rows).
  - Row B: leading `{}` (consumed by rowSpan), then per day `{ text: 'OUT', style: 'subsubheader', alignment: 'center' }` + `{}`, trailing `{}`.
- DOB format: moment `'L'` = `MM/DD/YYYY` (zero-padded). Literal cell text has a space before and after the `\n` (i.e. `"First Last \n DOB: 01/05/2022"`).
  **QUIRK:** `.utc()` on a moment parsed from a local-time ISO date-only string (`YYYY-MM-DD` is parsed as *local* midnight by moment) shifts the instant to UTC; in US timezones (UTC-) the displayed date is unchanged, but in UTC+ timezones the DOB would display **one day early**. Recommend FIX: format the stored `YYYY-MM-DD` string directly without timezone math.

Styles object of this document:

```js
header:       { fontSize: 18, bold: true, margin: [0,0,0,5] }
subheader:    { fontSize: 16, bold: true, margin: [0,0,0,5] }
subsubheader: { fontSize: 8, bold: true }
tableExample: { margin: [0,0,0,0] }
tableHeader:  { bold: true, fontSize: 13, color: 'black' }   // defined but NEVER referenced in this document
studentrow:   { fontSize: 10 }
```

---

## 5. UI Spec - `views/reports-summary-admin.ejs`

This is the only view in the feature. Rendered by `GET /report/reports-summary` with no explicit locals (uses global `user` local and `formatDate()` helper). Styling is Tailwind (via CDN `https://cdn.tailwindcss.com`), plus Font Awesome 6.2.0 and Flowbite 1.5.5 CDNs, loaded by the shared partials.

Structure (top to bottom):
1. **`partials/dashboard-head`** - `<!DOCTYPE html>`, `<html lang="en" class="bg-gray-100">`, `<title>JCKC Dashboard</title>` (shared title across all dashboard pages - the reports page has no distinct browser title), stylesheet `/css/style.css`, Tailwind CDN script, Font Awesome CDN, Flowbite CSS.
2. **`partials/navigation-admin`** - indigo-600 navbar with desktop links, a mobile hamburger menu (`#mobile-button` toggling `#mobile-menu`, wired up in `/js/main.js`), and a logout dropdown. Nav links (from `partials/nav-links/admin`):
   - `Dashboard` -> `/dashboard/<user.id>`
   - `Students` -> `/student/students-summary`
   - `Classrooms` -> `/classroom/classrooms-summary`
   - `Reports` -> `/report/reports-summary` (this page)
   - plus the logout link partial (`nav-links/logout`).
   Note: the admin nav is rendered for **any** authenticated visitor of this route (no role gate).
3. **`partials/header`** - white shadowed bar: left `Hello, <user.firstNameApp>!` (h2), right `formatDate()` = today's date as `M/D/YYYY` (no zero padding) (h3).
4. **Main content** (`<main>`, `max-w-7xl mx-auto py-6`):
   - Page heading `<h1>`: **"Reports Summary"**, centered, `text-3xl font-bold`.
   - One white card (`bg-white shadow rounded-lg`, `grid grid-cols-12 gap-5`) containing exactly **two anchor "buttons"** (there are no tables, no forms, no search boxes, no pagination on this page):

     | Label | Icon | href | Layout |
     |---|---|---|---|
     | `SIGN IN SHEETS` | Font Awesome `fa-sharp fa-solid fa-circle-down` (download icon) | `/report/sign-in-sheets` | `sm:col-span-6 col-span-12` (half-width side-by-side on >=sm, stacked full-width on mobile) |
     | `ROLL CALL SHEETS` | same icon | `/report/roll-call-sheets` | same |

     Both are pill-shaped (`rounded-full`) indigo-600 buttons, white text, hover indigo-700, full width of their grid cell, content centered. They are plain `<a>` navigations; the browser downloads the PDF because the route responds with `Content-Disposition: attachment`.
5. **`partials/dashboard-close-tag`** - Flowbite JS CDN + `/js/main.js`, closing `</body></html>`.

No conditional rendering exists in this view. (A misleading leftover HTML comment `<!-- Check In Students Link -->` labels the card.)

### SPA re-implementation notes
- The React page needs: title "Reports Summary", two download buttons. The NestJS API should expose e.g. `GET /reports/sign-in-sheets.pdf` and `GET /reports/roll-call-sheets.pdf` that **generate the PDF on request and stream it** (fixing the write-to-public-disk model, the staleness, the race, and the unauthenticated static exposure). No separate "generate" step is needed; the legacy coupling of generation to the summary-page view is an artifact, not a requirement.

---

## 6. Quirks & Bugs (with preserve/fix recommendation)

1. **No role restriction** - any authenticated user (parent/teacher) can view/download reports; only `ensureAuth` is applied despite the `-admin` view. **FIX**: admin-only.
2. **Unauthenticated static exposure** - generated PDFs are world-readable at `/reports/sign-in-sheet.pdf` and `/reports/roll-call-sheet.pdf` via `express.static('public')`; leaks child names/DOBs. **FIX**: generate on demand, stream to authenticated response.
3. **PDFs generated as a side effect of viewing the summary page**, overwritten globally on every visit; downloads serve possibly **stale** data (last summary-page visit by anyone) and there is a **race** between the async file write and a fast subsequent download (`res.render` fires before the streams finish; no finish/error handlers). **FIX**: on-demand generation.
4. **Zero-classrooms crash -> hung request**: `reduce((p,a) => p.concat(a))` without an initial value throws on an empty array; the catch block logs and never responds (the `res.render('error/500')` lines are commented out in all three handlers). **FIX**: initial value `[]` (or flatMap) + real error responses.
5. **Non-transitive classroom age-group comparator** (`infant` vs `preschool` compares equal) - ordering infant->toddler->preschool is not guaranteed; duplicated from the `app.locals.sortClassrooms` helper. **FIX** with a rank map; keep secondary alphabetical-by-`classroomName` (stable-sort semantics: name sort applied first).
6. **`'studentrow'` style referenced but undefined** in the sign-in document -> names render 12pt default instead of the (presumably intended) 10pt. FIX or preserve; cosmetic.
7. **`tableHeader` style defined but unused** in the roll-call document; roll-call header row cells are plain 12pt non-bold. Preserve (matches current output) unless design is being refreshed.
8. **`moment(dateOfBirth).utc().format('L')`** can shift DOB one day early in UTC+ timezones because the stored `YYYY-MM-DD` string is parsed as local time then converted to UTC. **FIX**: format the date string directly.
9. **Loose-equality classroom match** `e.classroom == room.id` (ObjectId vs string). Students with **no classroom assigned are silently omitted from all reports**. Preserve the omission behavior (only classroom rosters are printed) but implement with an explicit toString/populate; consider surfacing unassigned students.
10. **`Teacher: undefined` / blank `Age Group: __________`**: `teacherName` is optional and printed raw (renders "undefined" if unset); the classroom's `ageGroup` field exists but the report prints a blank fill-in line instead. Decide: FIX to print actual `ageGroup` and blank/dash for missing teacher, or preserve fill-in-by-hand lines (the blank Age Group line appears intentional for handwriting; the `undefined` teacher is a bug).
11. **Students sorted by last name here**, while student list pages elsewhere sort by first name (`sortName` helper). Preserve last-name ordering for the printed sheets.
12. **"bold" font is Roboto-Medium**, not Roboto-Bold (mapping choice in the fonts dict). Preserve for visual parity.
13. **Dead code / misc**: `User` model imported but unused in the controller; `ensureGuest` imported but unused in the router; `let today = new Date()` immediately overwritten by a string; misleading handler names `createSignInSheets`/`createRollCallSheets` (they only download); generated PDFs are committed to the repo under `public/reports/`. None need preserving.
14. **Error handling pattern**: every handler's catch is `console.error` + commented-out 500 render -> hung requests on failure; download handlers' try/catch cannot even catch `res.download` async errors (missing file -> Express default 404). **FIX** with proper error responses.