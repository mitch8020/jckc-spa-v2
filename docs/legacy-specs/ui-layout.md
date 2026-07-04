# UI Layout Spec — Page Chrome, Navigation, Pagination, Static Assets

Feature area: **ui-layout** (legacy Express/EJS app `jckc-web-app-private`).
Scope: shared page chrome (head/close partials), header, per-role navigation bars and their exact links, pagination partials, branding/color scheme, `public/` static assets, and client-side JS.

Source files covered:

- `views/partials/dashboard-head.ejs`, `views/partials/dashboard-close-tag.ejs`
- `views/partials/login-head.ejs`, `views/partials/login-close-tag.ejs`
- `views/partials/header.ejs`
- `views/partials/navigation.ejs`, `views/partials/navigation-admin.ejs`, `views/partials/navigation-parent.ejs`
- `views/partials/nav-links/admin.ejs`, `views/partials/nav-links/parent.ejs`, `views/partials/nav-links/logout.ejs`
- `views/partials/pagination.ejs`, `views/partials/pagination-classroom.ejs`
- `public/` (css, js, fonts, reports, Google verification file), `tailwind.config.js`, layout-relevant helpers in `app.js`

---

## 1. Overall page-chrome architecture

There is **no layout engine**. Every EJS view builds its page as a "sandwich" of includes:

```
<%- include('partials/dashboard-head') -%>     <!-- or login-head -->
<div class="min-h-full">
  <%- include('partials/navigation-admin') -%> <!-- or navigation-parent / navigation / none -->
  <%- include('partials/header') -%>           <!-- only on some pages -->
  <main> ...page content... </main>
</div>
<%- include('partials/dashboard-close-tag') -%> <!-- or login-close-tag -->
```

Role selection is **not** done inside the partials — each controller renders a role-specific view, and each view hard-codes which navigation partial it includes. There is no conditional `if (user.role)` logic in any layout partial.

### 1.1 Which views use which chrome (exhaustive)

| Chrome combination | Views |
|---|---|
| `dashboard-head` + `navigation-admin` + `header` | `dashboard-admin.ejs`, `students-summary-admin.ejs`, `students-details.ejs`, `students-delete.ejs`, `classrooms-summary.ejs`, `classrooms-details.ejs`, `guardian-details.ejs`, `reports-summary-admin.ejs` |
| `dashboard-head` + `navigation-admin` (NO header) | `students-details-edit.ejs`, `classrooms-add-new.ejs`, `classrooms-details-edit.ejs`, `classrooms-student-list-edit.ejs`, `guardian-details-edit.ejs`, `registration-student.ejs`, `registration-guardian.ejs` |
| `dashboard-head` + `navigation-parent` + `header` | `dashboard-parent.ejs` |
| `dashboard-head` + `navigation-parent` (NO header) | `students-summary-parent.ejs`, `profile-parent.ejs` |
| `dashboard-head` + `navigation` (teacher) + `header` | `dashboard-teacher.ejs` |
| `login-head` + `login-close-tag` (no nav, no header) | `index.ejs` (login page), `registration-user.ejs`, `registration-user-success.ejs`, `registration-student-success.ejs` |

Rule of thumb the legacy app follows: **read/summary pages show the greeting header; edit/registration/form pages do not** (they only show the nav bar). Preserve this distinction.

---

## 2. Head partials

### 2.1 `views/partials/dashboard-head.ejs` (all authenticated pages)

Emits, verbatim:

```html
<!DOCTYPE html>
<html lang="en" class="bg-gray-100">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JCKC Dashboard</title>
    <link rel="stylesheet" href="/css/style.css" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css" integrity="sha512-..." crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="https://unpkg.com/flowbite@1.5.5/dist/flowbite.min.css" />
  </head>
  <body></body>
</html>
```

Key facts:

- Page `<title>` is **`JCKC Dashboard`** for every authenticated page — it never changes per page.
- `<html>` carries class `bg-gray-100` (light gray page background for the dashboard).
- Loads FOUR style/script sources: local compiled Tailwind (`/css/style.css`, Tailwind v3.1.8 output), the **Tailwind Play CDN runtime script** (`cdn.tailwindcss.com`), **Font Awesome 6.2.0** CSS (CDN), and **Flowbite 1.5.5** CSS (CDN).
- **BUG (structural HTML)**: the partial ends with `<body></body></html>` — it closes body and html immediately. All page content is therefore emitted *after* `</html>`, and `dashboard-close-tag.ejs` closes body/html a second time. Browsers silently repair this, so the app "works", but the served HTML is invalid. **Fix in re-implementation** (a React SPA makes this moot, but do not replicate the double body/html if any SSR shell is produced).
- **QUIRK**: shipping both a compiled Tailwind stylesheet and the Tailwind CDN runtime is redundant/conflicting (the CDN runtime regenerates utilities at runtime; it also means classes not in the compiled CSS still render, masking stale builds). **Fix**: use one build-time Tailwind pipeline.

### 2.2 `views/partials/login-head.ejs` (unauthenticated / success pages)

```html
<!DOCTYPE html>
<html lang="en" class="bg-gray-50">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="google-site-verification" content="DtWrdTBM9iTadhNZMpvZ-W2IQeA34AczsSJ6GjeCPCg" />
    <title>JCKC Login</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.2/css/all.min.css" integrity="sha512-..." crossorigin="anonymous" referrerpolicy="no-referrer" />
    <link rel="stylesheet" href="/css/style.css" />
    <!-- <script src="https://cdn.tailwindcss.com"></script> -->   ← commented out
  </head>
  <body></body>
</html>
```

Key facts:

- `<title>` is **`JCKC Login`** on the login page AND on registration/success pages (they reuse this head).
- `<html>` class is **`bg-gray-50`** (slightly lighter than dashboard's `bg-gray-100`).
- Contains a **Google site-verification meta tag** (`DtWrdTBM9iTadhNZMpvZ-W2IQeA34AczsSJ6GjeCPCg`); there is also a verification file `public/google767ca53e2e77c247.html` served statically whose entire content is `google-site-verification: google767ca53e2e77c247.html`. Preserve both if SEO/search-console continuity matters.
- Font Awesome version here is **6.1.2** (dashboard uses 6.2.0) — inconsistent CDN versions. **Fix**: unify.
- Tailwind CDN script is commented out here; only the compiled `/css/style.css` styles login pages. No Flowbite on login pages.
- **Same structural bug** as dashboard-head: ends `<body></body></html>`.

### 2.3 Close-tag partials

`views/partials/dashboard-close-tag.ejs`:

```html
  <script src="https://unpkg.com/flowbite@1.5.5/dist/flowbite.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>
```

- Flowbite JS 1.5.5 powers dropdown components used elsewhere (e.g. guardian-name dropdown on student registration).
- `/js/main.js` is the only first-party client script (see §7).

`views/partials/login-close-tag.ejs` is just:

```html
</body>
</html>
```

- **No JS at all on login/registration-success pages** (no main.js, no Flowbite).

---

## 3. Greeting header — `views/partials/header.ejs`

Rendered directly beneath the nav bar on read/summary pages (see §1.1 table).

```html
<header class="bg-white shadow">
  <div class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
    <div class="pl-2.5 w-full flex">
      <h2 class="w-1/2 text-3xl ... text-gray-900">Hello, <%= user.firstNameApp %>!</h2>
      <h3 class="w-1/2 text-3xl ... text-gray-900 text-right"><%= formatDate() %></h3>
    </div>
  </div>
</header>
```

- Left half: **`Hello, {user.firstNameApp}!`** — uses the User model field literally named **`firstNameApp`** (the logged-in user's app display first name). The global `res.locals.user = req.user || null` middleware in `app.js` makes `user` available to all views.
- Right half: **today's date**, right-aligned, via the global EJS helper `formatDate()` called with **no argument**.

### 3.1 `formatDate` helper (defined in `app.js`, `app.locals.formatDate`)

```js
app.locals.formatDate = function(date) {
  let dateToFormat, month, day, year
  if (!date) { dateToFormat = new Date() }
  if (typeof date == 'string') {
    dateToFormat = date.split('-')
    month = dateToFormat[1]; day = dateToFormat[2]; year = dateToFormat[0]
  } else {
    month = dateToFormat.getMonth() + 1
    day = dateToFormat.getDate()
    year = dateToFormat.getFullYear()
  }
  return `${month}/${day}/${year}`
}
```

Behavior matrix (important for exact parity):

- `formatDate()` (header usage): today's date as **`M/D/YYYY` with NO zero-padding** (e.g. `7/2/2026`).
- `formatDate('2020-05-14')` (string, used for `dateOfBirth` fields elsewhere): splits on `-`, returns `05/14/2020` — **zero-padding preserved from the string**, and it is the raw stored string parts (year first). If the string ever contains a time suffix (e.g. an ISO datetime `2020-05-14T00:00:00.000Z`), the "day" segment would be `14T00:00:00.000Z` — works in legacy only because `dateOfBirth` is stored as a plain `YYYY-MM-DD` string.
- **BUG**: `formatDate(someDateObject)` **throws** (`dateToFormat` is undefined — it's only assigned when the arg is falsy or a string). Legacy never hits this path. **Fix** in re-implementation: format dates robustly; keep the *display formats* (`M/D/YYYY` for "today", `MM/DD/YYYY` for stored DOB strings) if visual parity matters.

---

## 4. Navigation bars

All three nav partials share an identical shell:

- `<nav class="bg-indigo-600">` — solid **indigo-600** bar, height `h-16`, content constrained to `max-w-7xl mx-auto`.
- **No logo image and no app-name text in the nav bar.** Branding is text-only elsewhere ("JCKC" in titles, "Log in to your JCKC account" on the login page, "JC KIDZ CLUBHOUSE" in generated PDFs).
- Desktop (`md:` and up): left-aligned link group (`hidden md:block`), right-aligned "Sign out" (`hidden md:block`).
- Mobile (below `md`): a hamburger button (`-mr-2 flex md:hidden`) toggles a collapsed panel `#mobile-menu` (initially `class="hidden md:hidden"`) that repeats the SAME links (left group, then `<br />`, then Sign out).
- Link styling: `text-white hover:bg-indigo-500 hover:bg-opacity-75 px-3 py-2 rounded-md text-sm font-medium` (mobile variant in `navigation.ejs` uses `text-base`; the shared `nav-links/*` partials always use `text-sm` and `block`).
- There is **no "current page" highlighting** — the commented markup hints at `bg-indigo-700 text-white` for the current item, but it is never applied. (Re-implementation: add proper active-state highlighting; this is a fix, not a behavior to preserve.)
- Hamburger button: two inline Heroicon SVGs — "menu" (3 bars, `class="ham-icon block h-6 w-6"`) and "x" (`class="ham-icon hidden h-6 w-6"`); clicking toggles `hidden` on both icons and on `#mobile-menu` (see §7). Button has `aria-controls="mobile-menu"`, `aria-expanded="false"` (never updated), `sr-only` label "Open main menu".

### 4.1 Admin navigation — `navigation-admin.ejs` + `nav-links/admin.ejs`

Left links (desktop AND mobile, exact label → href):

| Label | href |
|---|---|
| `Dashboard` | `/dashboard/<%= user.id %>` (Mongoose virtual `id` of the logged-in user) |
| `Students` | `/student/students-summary` |
| `Classrooms` | `/classroom/classrooms-summary` |
| `Reports` | `/report/reports-summary` |

Right link (from `nav-links/logout.ejs`): `Sign out` → `/auth/logout`, with `tabindex="-1"`.

Mobile button has `id="mobile-button"` (required by main.js).

### 4.2 Parent navigation — `navigation-parent.ejs` + `nav-links/parent.ejs`

Left links:

| Label | href |
|---|---|
| `Dashboard` | `/dashboard/<%= user.id %>` |
| `Students` | `/student/students-summary` (same URL as admin; the controller branches on role to render the parent variant) |
| `Parent Profile` | `/profile/<%= user.id %>` |

Right link: `Sign out` → `/auth/logout` (same shared logout partial). Mobile button has `id="mobile-button"`.

### 4.3 Teacher navigation — `navigation.ejs` (used only by `dashboard-teacher.ejs`)

This partial is an older, self-contained copy (does NOT use the `nav-links/` includes) and is half-broken:

- Desktop left links: `Dashboard` → **`#`** (dead link — BUG), `Reports` → **`#`** (dead link), plus a commented-out `Calendar` link.
- Desktop right: `Sign out` → `/auth/logout`, `tabindex="-1"`.
- Mobile links: `Dashboard` → `/dashboard/<%= user.id %>` (works, unlike desktop), `Reports` → `#`, `Sign out` → `/auth/logout`. Mobile links use `text-base font-medium`.
- **BUG**: the mobile hamburger `<button>` here has **no `id="mobile-button"`**, so `main.js` (`document.querySelector('#mobile-button').addEventListener(...)`) throws a `TypeError` on the teacher dashboard and the mobile menu never opens. (The hoisted `searchFilterGuardians` function still exists, but no other page code runs after the throw.)
- Re-implementation guidance: the teacher role is vestigial in this app. If teacher is kept, give teachers a proper nav (Dashboard, Reports at minimum) — i.e. **fix**, don't preserve the dead `#` links or the broken mobile toggle.

---

## 5. Pagination partial — `views/partials/pagination.ejs`

Used by `students-summary-admin.ejs` (the admin student list). Included as:

```ejs
<%- include('partials/pagination', { pagination, currentStatus, currentSearch, currentOrder }) %>
```

Expected inputs (documented in the partial's own EJS comment):

- `pagination`: `{ currentPage, totalPages, totalCount, startIndex, endIndex, hasPrevious, hasNext }` — all computed by the controller (page size and skip math live in the students controller, not here; this partial only renders).
- `currentStatus`: filter status string — `'active'`, `'inactive'`, or `'all'`.
- `currentSearch`: search query string (optional).
- `currentOrder`: `'asc'` or `'desc'` (optional).

Rendering rules (exact):

1. **Renders nothing at all when `pagination.totalCount === 0`** (whole `<nav>` wrapped in `if (pagination.totalCount > 0)`).
2. Left side (hidden on small screens, `hidden sm:block`): `Showing {startIndex} to {endIndex} of {totalCount} students` — the noun **"students" is hard-coded** in the partial (it is not generic).
3. Right side: text `Page {currentPage} of {totalPages}`, then two controls:
   - **Previous**: if `pagination.hasPrevious`, an `<a>`; else a disabled-looking `<span>` (`bg-gray-100 text-gray-400 cursor-not-allowed`).
   - **Next**: same pattern with `pagination.hasNext`.
4. **There are NO numbered page links** — only Previous/Next.
5. Link URLs are relative query-string-only hrefs (same path), preserving all filters:

```
?status=<currentStatus>&search=<encodeURIComponent(currentSearch || '')>&order=<currentOrder || 'asc'>&page=<currentPage ± 1>
```

Notes/quirks:

- `search` is URL-encoded via `encodeURIComponent`; `status` and `order` are interpolated raw (safe in practice since the controller normalizes them).
- `order` defaults to `'asc'` in the link when `currentOrder` is falsy.
- An empty search still emits `search=` (empty param) — harmless, preserve-or-fix freely.
- Query param names to preserve exactly in the SPA/API: **`status`, `search`, `order`, `page`**.

---

## 6. Classroom dual-table pagination — `views/partials/pagination-classroom.ejs`

Used TWICE on `classrooms-student-list-edit.ejs` — that page shows two independently paginated + searchable student tables (an "add to classroom" table and a "remove from classroom" table), each with its own page and search query params. This partial keeps both tables' state in sync in every link.

Expected inputs (from the partial's comment):

- `pagination`: same shape as §5.
- `pageParam`: this table's page query-param name (e.g. `'addPage'` or `'removePage'`).
- `otherPageParam` / `otherPageValue`: the *other* table's page param name and current value.
- `classroomId`: used to build the absolute URL.
- `searchParam` / `searchValue`: this table's search param name (e.g. `'addSearch'` or `'removeSearch'`) and current value.
- `otherSearchParam` / `otherSearchValue`: the other table's search param name and current value.

Rendering rules:

1. Same `totalCount > 0` guard, same "Showing X to Y of Z students" (again hard-coded noun "students"), same `Page X of Y`, same Previous/Next-only anchor-vs-disabled-span pattern. (Only cosmetic difference from §5: `py-2` instead of `py-3`.)
2. Prev/Next hrefs are **absolute**, targeting:

```
/classroom/edit-student-list/<classroomId>?<pageParam>=<currentPage ± 1>&<otherPageParam>=<otherPageValue>&<searchParam>=<encodeURIComponent(searchValue || '')>&<otherSearchParam>=<encodeURIComponent(otherSearchValue || '')>
```

i.e. paging one table changes only that table's page while **preserving the other table's current page and both tables' search terms**. Both search values are `encodeURIComponent`-escaped.

Query param names to preserve exactly: **`addPage`, `removePage`, `addSearch`, `removeSearch`** (as passed in by the classroom edit-student-list view/controller).

---

## 7. Client-side JavaScript — `public/js/main.js` (entire first-party JS, 29 lines)

Loaded ONLY via `dashboard-close-tag.ejs` (so: every authenticated page; never on login pages). Two features:

### 7.1 Mobile hamburger toggle (runs on load)

```js
const mobileHam = document.querySelector('#mobile-button')
const btnHam = document.querySelectorAll('.ham-icon')
const mobileMenu = document.querySelector('#mobile-menu')
mobileHam.addEventListener('click', () => {
  btnHam.forEach(e => e.classList.toggle('hidden'))
  mobileMenu.classList.toggle('hidden')
})
```

- Toggles `hidden` on the `#mobile-menu` panel and swaps the two `.ham-icon` SVGs (menu ⇄ x).
- **BUG**: throws `TypeError` on `dashboard-teacher.ejs` because `navigation.ejs`'s button lacks `id="mobile-button"` (see §4.3). Also its SVGs lack the `ham-icon` class, so even with an id the icons wouldn't swap. Fix in re-implementation.
- `aria-expanded` is never updated. Fix (accessibility) in re-implementation.

### 7.2 `searchFilterGuardians()` (called via inline `onkeyup` in the student-registration view)

```js
function searchFilterGuardians() {
  let input = document.getElementById('guardianNameSearch')
  let filter = input.value.toUpperCase()
  let ul = document.getElementById('dropdownGuardianNames')
  let li = ul.getElementsByTagName('li')
  // for each li: show if its first <a>'s text contains filter (case-insensitive), else display:none
}
```

- Client-side, **case-insensitive substring** filter over `<li>` items inside `#dropdownGuardianNames`, matching against each item's first `<a>` text. Used by the guardian-picker dropdown (Flowbite dropdown) on the student registration page. In the SPA this becomes a normal filtered combobox.

---

## 8. `public/` static assets inventory

Served by `express.static(path.join(__dirname, 'public'))` (mounted before all routes — **static files require no auth**).

| Path | Purpose |
|---|---|
| `public/css/style.css` | Compiled Tailwind CSS v3.1.8 output (~29 KB). Built from `public/css/input.css` (which is only the three `@tailwind base/components/utilities` directives) using `tailwind.config.js`. |
| `public/css/input.css` | Tailwind source: `@tailwind base; @tailwind components; @tailwind utilities;` |
| `public/js/main.js` | See §7. |
| `public/fonts/Roboto-*.ttf` (12 weights/styles) + `LICENSE.txt` | **Not used by any web page.** Used server-side by `pdfmake` in `controllers/report.js` (Regular/Medium/Italic/MediumItalic) to generate PDFs. Keep server-side with the report feature. |
| `public/reports/sign-in-sheet.pdf`, `public/reports/roll-call-sheet.pdf` | **Generated files**: `GET /report/reports-summary` regenerates and overwrites both PDFs on every visit; `GET /report/sign-in-sheets` and `GET /report/roll-call-sheets` serve them via `res.download('./public/reports/...')`. Because they sit in `public/`, they are also directly fetchable at `/reports/sign-in-sheet.pdf` and `/reports/roll-call-sheet.pdf` **without authentication** (child names + DOBs — a data-exposure bug; FIX: generate/stream behind auth). |
| `public/google767ca53e2e77c247.html` | Google Search Console verification file (content: `google-site-verification: google767ca53e2e77c247.html`). Preserve if the domain stays the same. |

`tailwind.config.js` (relevant to rebuilding the theme):

```js
content: ["./views/*.{html,ejs,js}", "./views/partials/*.{html,ejs,js}", "./views/partials/nav-links/*.{html,ejs,js}"],
theme: { extend: { colors: { sky: colors.sky, teal: colors.teal } } },
plugins: [require('@tailwindcss/forms')]
```

- Uses the **`@tailwindcss/forms`** plugin (affects default form-control styling everywhere — the SPA should include it or replicate its look).
- `sky` and `teal` are re-added (they're default in TW3 anyway; harmless no-op).

---

## 9. Branding / color scheme summary

- **App name shown to users**: "JCKC" (titles `JCKC Dashboard` / `JCKC Login`, login heading "Log in to your JCKC account"). Full business name **"JC KIDZ CLUBHOUSE"**, address "408 W Market St, Johnson City, TN 37604", appears only inside generated PDFs. **No logo image exists anywhere.**
- **Primary color**: Tailwind **indigo-600** (`#4F46E5`) — nav bar background, primary action buttons (e.g. report download buttons `bg-indigo-600 hover:bg-indigo-700`), hover state `indigo-500` at 75% opacity on nav links, focus rings `ring-indigo-500`/`ring-white`.
- **Backgrounds**: dashboard pages `bg-gray-100` on `<html>`; login pages `bg-gray-50`; content cards/headers `bg-white` with `shadow`.
- **Text**: headings `text-gray-900` bold `tracking-tight`; secondary text `text-gray-700`/`text-gray-500`; nav links `text-white`.
- **Typography**: Tailwind default `ui-sans-serif/system-ui/...` stack (no custom webfont on the web pages; Roboto TTFs are PDF-only).
- **Icons**: Font Awesome (e.g. `fa-sharp fa-solid fa-circle-down` on report buttons); Heroicons inline SVG for hamburger/menu icons.
- **Content width**: everything constrained to `max-w-7xl mx-auto` with `px-4 sm:px-6 lg:px-8` gutters. There is **no sidebar** anywhere — chrome is a single top nav bar (+ optional greeting header strip).

---

## 10. Quirks & bugs — preserve or fix?

| # | Item | Preserve / Fix |
|---|---|---|
| 1 | Head partials emit `<body></body></html>` before page content; documents are structurally invalid with content after `</html>` and duplicate closers. | **Fix** (irrelevant in SPA; never replicate). |
| 2 | Dashboard loads BOTH compiled Tailwind CSS and the Tailwind CDN runtime script; login loads only the compiled CSS. | **Fix**: single build-time Tailwind pipeline; keep `@tailwindcss/forms`. |
| 3 | Font Awesome version mismatch (6.2.0 dashboard vs 6.1.2 login). | **Fix**: unify. |
| 4 | Static page `<title>` never varies per page (`JCKC Dashboard` / `JCKC Login`). | **Fix** recommended (per-route titles), unless strict parity demanded. |
| 5 | Teacher nav (`navigation.ejs`): desktop `Dashboard` and `Reports` links are dead (`href="#"`); mobile hamburger has no `id="mobile-button"` so main.js throws and the mobile menu never opens; its SVG icons lack `.ham-icon` class. | **Fix** (or drop the vestigial teacher role per product decision). |
| 6 | No active/current-page highlighting in nav (`bg-indigo-700` state exists only in comments); `aria-expanded` never toggled. | **Fix**: proper active states + a11y in the SPA. |
| 7 | `formatDate()` with no arg returns non-zero-padded `M/D/YYYY`; with a `YYYY-MM-DD` string returns `MM/DD/YYYY` (padding from stored string); with a real `Date` object it **throws**. | **Preserve display formats**, fix the crash path with a robust formatter. |
| 8 | Pagination partials hard-code the noun "students" in "Showing X to Y of Z students". | Preserve wording for these tables; make the component noun-configurable. |
| 9 | Pagination is Previous/Next only — no numbered page links, no page-size selector. Whole control hidden when `totalCount === 0`; "Showing X to Y of Z" hidden below `sm`. | **Preserve** behavior (Prev/Next + "Page X of Y") for parity; numbered pages optional enhancement. |
| 10 | Query params to preserve verbatim: student list `status` (`active`/`inactive`/`all`), `search`, `order` (`asc`/`desc`, link default `asc`), `page`; classroom edit-student-list `addPage`, `removePage`, `addSearch`, `removeSearch` (each table's links carry the other table's page + search). | **Preserve** param names/semantics in the SPA routes & API. |
| 11 | Generated report PDFs live in `public/` and are downloadable without auth at `/reports/*.pdf`; regenerated (overwritten) on every visit to `/report/reports-summary`. | **Fix**: generate on demand behind auth; don't persist to a public folder. |
| 12 | `public/fonts` Roboto TTFs are server-side pdfmake assets, not web fonts. | Preserve with the report generator, not as frontend assets. |
| 13 | Google verification meta tag + `google767ca53e2e77c247.html`. | **Preserve** if the production domain is unchanged. |
| 14 | Session secret is hard-coded `'keyboard mouse'` in `app.js` (noticed while reading layout helpers). | **Fix**: env-based secret / JWT per new architecture. |
| 15 | `user.firstNameApp` is the exact User field used for the greeting ("Hello, {firstNameApp}!"). | **Preserve** field semantics (display-name distinct from legal first name) even if renamed cleanly in the new schema. |
| 16 | Nav role selection is done by rendering different views per role; partials contain no role logic. Parent and admin share the `/student/students-summary` URL — role branching happens in the controller. | In the SPA: single nav component switching link sets on user role: admin = Dashboard, Students, Classrooms, Reports (+ Sign out); parent = Dashboard, Students, Parent Profile (+ Sign out). |

---

## 11. Re-implementation mapping notes (NestJS + React)

- The chrome collapses to one `AppShell` component: top nav (indigo-600, max-w-7xl), optional greeting header strip (`Hello, {firstNameApp}!` + today's date `M/D/YYYY` right-aligned) shown on summary/detail routes but not on edit/registration routes, `<main>` with `max-w-7xl mx-auto py-6 sm:px-6 lg:px-8`.
- Nav link sets per role (exact labels): **admin** `Dashboard`, `Students`, `Classrooms`, `Reports`, `Sign out`; **parent** `Dashboard`, `Students`, `Parent Profile`, `Sign out`; **teacher** (if kept) `Dashboard`, `Reports`, `Sign out`.
- Mobile: hamburger toggling a stacked copy of the same links; add proper `aria-expanded` handling.
- Pagination: server returns `{ currentPage, totalPages, totalCount, startIndex, endIndex, hasPrevious, hasNext }`; UI shows "Showing X to Y of Z {noun}", "Page X of Y", Prev/Next buttons (disabled state = gray span in legacy); URL/search-state keys as in quirk #10.
- No Flowbite dependency needed in the SPA; the only Flowbite usage is the guardian dropdown, replaced by a filtered combobox reproducing `searchFilterGuardians`'s case-insensitive substring behavior.
