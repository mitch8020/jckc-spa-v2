# JCKC v2 Repo Conventions

Two freshly-scaffolded repos under `C:\Projects\JCKC Web App\jckc-spa-v2\`:

- **`jckc-spa-backend`** — NestJS 11 (Express platform), CommonJS-flavored, Jest + supertest.
- **`jckc-spa-frontend`** — TanStack Start (React 19, Vite 8, file-based routing), Tailwind CSS v4, shadcn-ready, better-auth hosted in the frontend server routes.

Implementation agents MUST match the styles below exactly — the two repos have **different prettier settings** (backend uses semicolons, frontend does not).

---

## 1. Frontend: `jckc-spa-frontend`

### 1.1 Package / module basics

- `package.json`: `"type": "module"`, `"private": true`.
- **Node subpath imports** declared in `package.json`: `"imports": { "#/*": "./src/*" }`.
- Key deps: `@tanstack/react-start` + `@tanstack/react-router` (several pinned to `latest`), `@tanstack/react-query` ^5, `react`/`react-dom` ^19.2, `better-auth` ^1.5.3, `tailwindcss` ^4.1.18 (+ `@tailwindcss/vite`, `@tailwindcss/typography`, `tw-animate-css`), `zod` ^4, `react-hook-form` ^7.80 + `@hookform/resolvers`, `radix-ui` ^1.6.1 (the unified package, NOT individual `@radix-ui/react-*` packages), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `next-themes`.
- Dev deps: `vitest` ^4 + `@testing-library/react` + `jsdom`, `typescript` ^6.0.2, `vite` ^8, `@tanstack/eslint-config`, `@tanstack/router-cli` (`tsr`).
- Package manager is pnpm (`pnpm.onlyBuiltDependencies` for esbuild/lightningcss).

### 1.2 npm scripts (frontend)

| Script | Command |
|---|---|
| `dev` | `vite dev --port 3000` |
| `generate-routes` | `tsr generate` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `test` | `vitest run` |
| `lint` | `eslint` |
| `format` | `prettier --write . && eslint --fix` |
| `check` | `prettier --check .` |

Dev server runs on **port 3000** (matches `BETTER_AUTH_URL=http://localhost:3000`).

### 1.3 TypeScript (frontend `tsconfig.json`)

- `strict: true`, plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports` — all true. Unused vars/params are **compile errors**; delete or prefix appropriately.
- `verbatimModuleSyntax: true` — type-only imports MUST use `import type { ... }` (see `src/lib/utils.ts`: `import type { ClassValue } from 'clsx'` on its own line, then a separate value import).
- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx` (no need to import React for JSX), `allowImportingTsExtensions: true`, `noEmit: true`, `skipLibCheck: true`, `lib: ES2022 + DOM + DOM.Iterable`, `types: ["vite/client"]`.
- **Path aliases**: both `"#/*"` and `"@/*"` map to `./src/*`. Existing source code uses **`#/`** exclusively (e.g. `import { auth } from '#/lib/auth'`, `import { authClient } from '#/lib/auth-client'`). Use `#/` in new code. (`@/*` exists in tsconfig only; `package.json` `imports` field only declares `#/*`.) Vite resolves aliases via `resolve: { tsconfigPaths: true }` — no separate vite alias config.

### 1.4 Prettier (frontend `prettier.config.js`)

```js
const config = {
  semi: false,        // NO semicolons
  singleQuote: true,  // single quotes
  trailingComma: 'all',
}
```

So frontend code style: **no semicolons, single quotes, trailing commas everywhere**, default 2-space indent, default 80-char print width. All existing frontend source follows this.

### 1.5 ESLint (frontend `eslint.config.js`)

Flat config built on `@tanstack/eslint-config` with these rules disabled: `import/no-cycle`, `import/order`, `sort-imports`, `@typescript-eslint/array-type`, `@typescript-eslint/require-await`, `pnpm/json-enforce-catalog`. Ignores `eslint.config.js` and `prettier.config.js`. Import ordering is NOT enforced.

### 1.6 Routing (TanStack Start, file-based)

- `tsr.config.json`: `{ "target": "react" }`. Route files live in `src/routes/`; the generated tree is `src/routeTree.gen.ts` (auto-generated — never hand-edit; regen with `npm run generate-routes`, or the Vite plugin regenerates during `dev`/`build`).
- Router factory in `src/router.tsx` exports `getRouter()` which calls `createTanStackRouter({ routeTree, scrollRestoration: true, defaultPreload: 'intent', defaultPreloadStaleTime: 0 })`, and does the `declare module '@tanstack/react-router' { interface Register { router: ReturnType<typeof getRouter> } }` registration.
- **Page route pattern** (`src/routes/index.tsx`):

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <div className="p-8">...</div>
}
```

Export a `Route` const via `createFileRoute('<path>')({...})`; component is a plain named function declared BELOW the route export.

- **Root route** (`src/routes/__root.tsx`) uses `createRootRoute({ head: () => ({ meta, links }), shellComponent: RootDocument })`. `RootDocument` renders the full `<html>/<head>/<body>` shell with `<HeadContent />`, `{children}`, `<TanStackDevtools>` (router devtools panel plugin, position bottom-right), and `<Scripts />`. CSS enters via `import appCss from '../styles.css?url'` and a `links` stylesheet entry. Page `<title>` is currently "TanStack Start Starter".
- **Server route pattern** (`src/routes/api/auth/$.ts`): same `createFileRoute` call but with a `server.handlers` object instead of `component`:

```ts
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
```

`$` is a splat/catch-all segment. This is how API endpoints are hosted inside the TanStack Start app.

### 1.7 better-auth wiring (frontend-hosted today)

- **Server instance** — `src/lib/auth.ts`:

```ts
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  plugins: [tanstackStartCookies()],
})
```

No database adapter configured yet (defaults to in-memory/unconfigured). Only email+password enabled.

- **HTTP mount** — the splat server route `src/routes/api/auth/$.ts` (above) delegates GET/POST to `auth.handler(request)`, so all better-auth endpoints are served by the **frontend** at `/api/auth/*` on port 3000. There is no proxy to the NestJS backend for auth (though the backend also has `better-auth` ^1.6.23 in its deps — note the version skew: frontend ^1.5.3 vs backend ^1.6.23).
- **Client** — `src/lib/auth-client.ts`: `createAuthClient()` from `better-auth/react` with NO baseURL argument (same-origin `/api/auth` default). Consumed via hooks, e.g. `authClient.useSession()` returning `{ data: session, isPending }`, and `authClient.signOut()` — see `src/integrations/better-auth/header-user.tsx` (default-exported `BetterAuthHeader` component; renders a pulse placeholder while pending, avatar/initial + Sign out button when authenticated, `null` when signed out; fire-and-forget calls are `void`-prefixed: `void authClient.signOut()`).
- **Env** — `.env.local`: `BETTER_AUTH_URL=http://localhost:3000`, `BETTER_AUTH_SECRET=` (blank; generate with `npx -y @better-auth/cli secret`).
- Integration-specific UI lives under `src/integrations/<integration-name>/` (e.g. `src/integrations/better-auth/header-user.tsx`).

### 1.8 shadcn/ui setup (`components.json`)

- Style `new-york`, `rsc: false`, `tsx: true`, base color `zinc`, `cssVariables: true`, no Tailwind prefix, CSS file `src/styles.css` (no tailwind.config — Tailwind v4 CSS-first).
- Aliases all use `#/`: components → `#/components`, ui → `#/components/ui`, utils → `#/lib/utils`, lib → `#/lib`, hooks → `#/hooks`. Icon library: **lucide**.
- `cn()` helper already exists in `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- No components have been generated yet — `src/components/` does not exist yet; `npx shadcn add <component>` will create it per these aliases.

### 1.9 Styling & design tokens (`src/styles.css`)

Tailwind v4 CSS-first setup: `@import 'tailwindcss'`, `@plugin '@tailwindcss/typography'`, `@import 'tw-animate-css'`, and `@custom-variant dark (&:is(.dark *))` — dark mode is **class-based** (`.dark` on an ancestor; `next-themes` is installed for toggling).

**Fonts** (Google Fonts `@import` at top of file):
- **Manrope** (400/500/600/700/800) — body font, wired as `--font-sans` in `@theme inline` (so Tailwind's `font-sans` = Manrope). Applied to `body`.
- **Fraunces** (optical-size axis, 500/700) — display serif, applied ONLY via the `.display-title` utility class (`font-family: 'Fraunces', Georgia, serif`). Use `.display-title` for headings/hero text.

**Custom brand token vocabulary** (raw CSS custom properties on `:root`, each with a `.dark` override). The token *names* are the scaffold's originals, but the *values* mirror the legacy `jckc-web-app-private` palette (indigo-600 nav/primary, sky-500 focus, gray neutrals):

| Token | Light value | Role |
|---|---|---|
| `--sea-ink` | `#111827` (gray-900) | primary text; body `color` |
| `--sea-ink-soft` | `#4b5563` (gray-600) | secondary/muted text |
| `--lagoon` | `#0ea5e9` (sky-500) | accent (focus rings, chip washes) |
| `--lagoon-deep` | `#0369a1` (sky-700) | stronger accent (avatar initial, `.pill-lagoon`) |
| `--palm` | `#4f46e5` (indigo-600) | primary brand accent; link color |
| `--sand` | `#f3f4f6` (gray-100) | subtle background tone |
| `--foam` | `#f9fafb` (gray-50) | near-white background tone |
| `--surface` | `rgba(255,255,255,.8)` | translucent card surface |
| `--surface-strong` | `rgba(255,255,255,.94)` | more opaque surface |
| `--line` | `rgba(17,24,39,.13)` | hairline borders |
| `--inset-glint` | `rgba(255,255,255,.82)` | inset top-highlight in card shadows |
| `--kicker` | `rgba(79,70,229,.9)` | eyebrow/kicker text color (indigo) |
| `--bg-base` | `#f3f4f6` (gray-100) | page background base |
| `--header-bg` | `#4f46e5` (indigo-600) | solid header background (legacy navbar) |
| `--header-ink` / `--header-ink-soft` | white / `#c7d2fe` (indigo-200) | header text & resting nav-link color |
| `--header-link-hover` | `rgba(99,102,241,.75)` | header link hover wash (indigo-500/75) |
| `--chip-bg` / `--chip-line` | white/indigo rgba | chip/badge background & border |
| `--link-bg-hover` | `rgba(238,242,255,.9)` | hover background for link-like elements (indigo-50) |
| `--hero-a` / `--hero-b` | indigo/sky rgba | hero radial-gradient washes |
| `--age-infant/-toddler/-preschool` | `#db2777` / `#eab308` / `#22c55e` | legacy age-group identity (pink-600 / yellow-500 / green-500) |
| `--age-*-ink` | pink-700 / yellow-800 / green-700 | darkened text-safe variants for pill labels |

Dark mode flips these to a gray-950/indigo night palette (e.g. `--sea-ink: #f9fafb`, `--bg-base: #030712`, `--header-bg: #312e81` indigo-900, age colors move to 400 shades, surfaces become dark translucent rgba).

**Important:** these brand tokens are NOT registered in `@theme`, so there are no Tailwind utilities like `bg-lagoon`. Consume them via arbitrary values (`text-[var(--sea-ink)]`, `bg-[var(--surface)]`, `border-[var(--line)]`) or the provided CSS classes.

**Prebuilt CSS component/utility classes** (defined in styles.css, use these instead of reinventing):
- `.page-wrap` — centered content column: `width: min(1080px, calc(100% - 2rem)); margin-inline: auto`.
- `.display-title` — Fraunces serif display font.
- `.island-shell` — the signature card: hairline `--line` border, `--surface-strong`→`--surface` gradient, layered soft shadows with `--inset-glint` inset highlight, `backdrop-filter: blur(4px)`.
- `.feature-card` — lighter card variant; `:hover` lifts `-2px` and tints border toward `--palm`.
- `.island-kicker` — uppercase eyebrow label: `letter-spacing: .16em`, 700 weight, `.69rem`, `--kicker` color (header-scoped override uses `--header-ink-soft`).
- `.nav-link` — header nav item (`--header-ink-soft`, hover/active `--header-ink`) with animated scaleX underline (white → `--header-ink-soft` gradient) on hover / `.is-active`.
- `.rise-in` — 700ms entrance animation (fade + 12px rise, `cubic-bezier(0.16,1,0.3,1)`).
- `.site-footer` — top hairline + translucent `--header-bg` mix.
- Global: `body` has a layered radial/linear gradient background built from the hero tokens plus fixed `::before` (soft light blobs) and `::after` (28px grid lines masked radially) overlays; `a` styled with `--lagoon-deep` + soft underline; `code` gets a bordered pill treatment; `button, .island-shell, a` share a 180ms color/transform transition.

**shadcn variable mapping**: the full standard shadcn/ui token set is also present — `--background/--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive` (each with `-foreground`), `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar*` and `--radius: 0.625rem` — defined in **oklch**, themed to the legacy palette (`--primary` = indigo-600, `--ring` = sky-500, neutrals = Tailwind gray scale, charts = indigo/sky/green/yellow/pink), with `.dark` overrides. The `@theme inline` block maps each to Tailwind color tokens (`--color-background: var(--background)` etc.) plus radius scale `--radius-sm/md/lg/xl` = radius −4px/−2px/base/+4px, enabling standard shadcn utilities (`bg-background`, `text-muted-foreground`, `border-border`, `rounded-lg`, ...). An `@layer base` block applies `border-border outline-ring/50` to `*` and sets body background/foreground from the shadcn vars — note this **overrides** the earlier gradient `background` on `body` per normal cascade (both declarations exist; the `@layer base` one wins for `background-color`/`color` since it comes later at equal specificity, though un-layered rules beat layered ones — in practice the earlier un-layered `body` rule wins because un-layered styles take precedence over `@layer` styles; be aware both exist when styling).

### 1.10 Vite (`vite.config.ts`)

Plugins in order: `devtools()` (@tanstack/devtools-vite), `tailwindcss()`, `tanstackStart()`, `viteReact()`. `resolve: { tsconfigPaths: true }` handles `#/` and `@/` aliases. No manual proxy config.

---

## 2. Backend: `jckc-spa-backend`

### 2.1 Scaffold layout (stock Nest CLI)

```
jckc-spa-backend/
├── nest-cli.json          # sourceRoot: "src", deleteOutDir: true, @nestjs/schematics
├── tsconfig.json / tsconfig.build.json
├── eslint.config.mjs
├── .prettierrc
├── src/
│   ├── main.ts            # bootstrap: NestFactory.create(AppModule); listen(process.env.PORT ?? 3000)
│   ├── app.module.ts      # @Module({ imports: [], controllers: [AppController], providers: [AppService] })
│   ├── app.controller.ts  # @Controller() + @Get() getHello(): string
│   ├── app.service.ts     # @Injectable() getHello(): 'Hello World!'
│   └── app.controller.spec.ts   # unit test colocated with source (*.spec.ts)
└── test/
    ├── jest-e2e.json      # testRegex ".e2e-spec.ts$", rootDir ".", ts-jest transform
    └── app.e2e-spec.ts    # supertest against app.getHttpServer()
```

- Files are one-class-per-file with the Nest naming convention `<name>.<kind>.ts` (`app.controller.ts`, `app.service.ts`, `app.module.ts`).
- Constructor injection with `private readonly` (e.g. `constructor(private readonly appService: AppService) {}`).
- `main.ts` bootstrap: plain `NestFactory.create(AppModule)` then `await app.listen(process.env.PORT ?? 3000)`; `bootstrap()` invoked without await (floating promise — lint rule downgraded to `warn`). **Both apps default to port 3000** — set `PORT` on the backend when running both simultaneously.
- No global pipes/prefix/CORS configured yet, even though `class-validator`/`class-transformer` are installed. Deps also already include `@nestjs/config`, `@nestjs/mongoose` + `mongoose` ^9 + `mongodb` ^7, `better-auth` ^1.6.23, `pdfmake`; devDeps include `mongodb-memory-server` — installed but not yet wired into any module.

### 2.2 TypeScript (backend `tsconfig.json`) — NOT fully strict

- `module`/`moduleResolution`: **nodenext**, `target: ES2023`, `esModuleInterop: true`, `isolatedModules: true`, decorators enabled (`emitDecoratorMetadata` + `experimentalDecorators`), `declaration: true`, `removeComments: true`, `sourceMap: true`, `outDir: ./dist`, `baseUrl: ./`, `incremental: true`, `skipLibCheck: true`.
- Strictness is PARTIAL: `strictNullChecks: true` but `noImplicitAny: false`, `strictBindCallApply: false`, `noFallthroughCasesInSwitch: false`. There is no `"strict": true`. So implicit `any` compiles on the backend (but the frontend would reject it).
- **No path aliases** on the backend — use relative imports (`./app.module`, `./../src/app.module` in e2e tests). The `#/*` alias is a frontend-only convention.
- `tsconfig.build.json` extends base and excludes `node_modules`, `test`, `dist`, `**/*spec.ts`.
- ESLint `sourceType: 'commonjs'` — nodenext resolution treats these `.ts` files as CJS (no `"type": "module"` in package.json). Import default-style (`import request from 'supertest'`) works via `esModuleInterop`.

### 2.3 Prettier + ESLint (backend)

- `.prettierrc`: `{ "singleQuote": true, "trailingComma": "all" }` — **semicolons ON** (prettier default), single quotes, trailing commas. This differs from the frontend (`semi: false`).
- `eslint.config.mjs`: flat config = `@eslint/js` recommended + `typescript-eslint` **recommendedTypeChecked** + `eslint-plugin-prettier/recommended` (prettier violations are ESLint errors, with `endOfLine: "auto"`). Globals: node + jest. `projectService: true` type-aware linting. Rule tweaks: `no-explicit-any` OFF, `no-floating-promises` warn, `no-unsafe-argument` warn.

### 2.4 Testing (backend)

- **Unit tests**: jest config embedded in `package.json` — `rootDir: src`, `testRegex: .*\.spec\.ts$`, ts-jest transform, colocated `*.spec.ts` files, pattern: `Test.createTestingModule({ controllers, providers }).compile()` then `app.get<AppController>(AppController)`.
- **E2E tests**: `test/*.e2e-spec.ts` run via `jest --config ./test/jest-e2e.json`; pattern: build `TestingModule` importing `AppModule`, `moduleFixture.createNestApplication()`, `await app.init()` in `beforeEach`, `await app.close()` in `afterEach`, assert with `request(app.getHttpServer()).get('/').expect(200)`. Supertest imported as `import request from 'supertest'` with `import { App } from 'supertest/types'` and `INestApplication<App>` typing.

### 2.5 npm scripts (backend)

| Script | Command |
|---|---|
| `build` | `nest build` |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` |
| `start` | `nest start` |
| `start:dev` | `nest start --watch` |
| `start:debug` | `nest start --debug --watch` |
| `start:prod` | `node dist/main` |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` |
| `test` | `jest` |
| `test:watch` | `jest --watch` |
| `test:cov` | `jest --coverage` |
| `test:debug` | `node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand` |
| `test:e2e` | `jest --config ./test/jest-e2e.json` |

---

## 3. Cross-repo gotchas checklist

1. **Semicolons differ**: backend YES, frontend NO. Both use single quotes + trailing commas.
2. **`#/` alias is frontend-only**; backend uses relative imports. Frontend code should prefer `#/` (not `@/`, even though tsconfig allows it).
3. **Frontend is fully strict TS (+ noUnusedLocals/Parameters, verbatimModuleSyntax → `import type`)**; backend is loose (`noImplicitAny: false`, no `strict`).
4. **better-auth runs inside the frontend** at `/api/auth/$` (TanStack Start server route → `auth.handler(request)`), client is same-origin `createAuthClient()`; secret is unset and no DB adapter is configured yet. Backend has better-auth installed but unwired, at a newer major-minor (^1.6.23 vs ^1.5.3).
5. **Both dev servers default to port 3000** — collision if run together without overriding backend `PORT`.
6. **Brand tokens (`--sea-ink`, `--lagoon`, `--palm`, `--sand`, `--foam`, `--surface`, `--line`, ...) have no Tailwind utility names** — use `var(--token)` arbitrary values or the prebuilt classes (`.island-shell`, `.page-wrap`, `.display-title`, `.island-kicker`, `.nav-link`, `.feature-card`, `.rise-in`, `.site-footer`). shadcn oklch variables are stock zinc, not yet branded.
7. **`src/routeTree.gen.ts` is generated** — never edit; run `tsr generate` (or rely on the Vite plugin) after adding route files.
8. **Backend Jest lives in `package.json`** (unit) and `test/jest-e2e.json` (e2e); frontend uses vitest (`vitest run`), with testing-library + jsdom available but no tests written yet.
