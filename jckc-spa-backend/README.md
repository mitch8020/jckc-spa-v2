# jckc-spa-backend

NestJS 11 REST API for the JCKC daycare-management app (v2 rewrite of the
legacy Express/EJS app). Serves `/api/*` on port **3001**; auth is hosted
in-process by [better-auth](https://better-auth.com) at `/api/auth/*`
(Google OAuth + email/password, MongoDB adapter on the shared mongoose
connection).

## Setup

```bash
npm install
cp .env.example .env   # then fill in BETTER_AUTH_SECRET (see below)
npm run start:dev      # http://127.0.0.1:3001/api/health
```

Requires a MongoDB instance (default `mongodb://localhost:27017/jckc-v2`).
Domain collections keep the legacy names/fields (`students`, `classrooms`,
`guardians`); better-auth uses the existing `users` collection for auth users
and owns `account` and `session`.

## Environment variables (.env)

| Var | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `MONGO_DNS_SERVERS` | no | Optional comma-separated DNS servers for Atlas `mongodb+srv://` SRV lookups when local DNS refuses them |
| `BETTER_AUTH_SECRET` | yes | Session signing secret — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BETTER_AUTH_URL` | yes | Backend base URL (`http://127.0.0.1:3001`) |
| `FRONTEND_ORIGIN` | yes | CORS + trusted origin (`http://127.0.0.1:3000`) |
| `PORT` | no | Defaults to 3001 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables Google sign-in when both set |
| `AUTH_ALLOWED_EMAILS` | no | Comma-separated emails allowed to authenticate; defaults to `jpmitra.swe@gmail.com,mitrajs@yahoo.com,khinson60@yahoo.com` |
| `ADMIN_EMAILS` | no | Comma-separated emails that register as admin (bootstrap) |
| `TEACHER_EMAILS` | no | Comma-separated emails allowed to self-register as teacher; everyone else can self-register only as parent unless listed in `ADMIN_EMAILS` |

For local Google OAuth, add both loopback callback URIs in Google Cloud
Console's **Authorized redirect URIs**. The app supports either host so the
state cookie and OAuth callback stay on the same host as the browser session:

```text
http://localhost:3001/api/auth/callback/google
http://127.0.0.1:3001/api/auth/callback/google
```

Config is validated at boot (`src/config/env.validation.ts`) — the app
fails fast when a required var is missing.

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Dev server with watch |
| `npm run build` / `npm run start:prod` | Compile to `dist/` and run |
| `npm test` | Unit tests (`src/**/*.spec.ts`) |
| `npm run test:e2e` | E2E tests (boots AppModule on mongodb-memory-server) |
| `npm run lint` | ESLint (typescript-eslint typeChecked + prettier) |
| `npm run migrate:users -- --dry-run\|--write` | Normalize existing `users` docs in place and add better-auth `account` docs |
| `npm run migrate:guardian-links -- --dry-run\|--write` | Cast string `students[].student` ids on guardians to ObjectIds |

## Architecture map

```
src/
  main.ts                    # bodyParser:false; better-auth mounted on /api/auth/{*splat}
                             # BEFORE express.json(); CORS; /api prefix; ValidationPipe;
                             # global exception filter; port 3001
  app.module.ts              # ConfigModule (validated) + MongooseModule + feature modules
  config/env.validation.ts   # fail-fast env validation
  assets/fonts/              # Roboto TTFs for pdfmake reports (copied to dist/assets/fonts
                             # by the nest-cli asset copy; resolved relative to the module)
  common/
    decorators/              # @Public, @Roles('admin'|'teacher'|'parent'), @CurrentUser
    dto/                     # shared wire DTO shapes + serializers (Student/Classroom/Guardian)
    guards/roles.guard.ts    # global RolesGuard (APP_GUARD, honors @Roles)
    filters/                 # global exception filter (CastError -> 404, fallback 500)
    utils/                   # age.ts (legacy age/format/sort helpers + US_STATE_CODES),
                             # collation.ts (shared case-insensitive sort collation),
                             # pagination.ts (legacy page-size-10 math), escape-regex.ts
    validators/              # @IsDateOfBirth (YYYY-MM-DD, real date, not future)
  database/schemas/          # Student / Classroom / Guardian (legacy-compatible) + AuthUser
                             # (mongoose view over better-auth's 'users' collection)
  modules/
    auth/                    # better-auth instance provider (AUTH_INSTANCE), global
                             # AuthGuard (session -> req.user), SessionUser type
    users/                   # /api/users: me GET/PATCH, register, admin list + role PATCH
    health/                  # GET /api/health (public)
    students|classrooms|guardians|reports|dashboard/   # feature modules (see API-CONTRACT)
scripts/                     # ts-node data migrations (dry-run/write modes)
test/                        # e2e specs + mongodb-memory-server helper
```

Auth model: better-auth session cookie; every route is guarded by the
global AuthGuard unless marked `@Public()`. Roles are a single enum on
`user.role` (`'' | parent | teacher | admin`); `POST /api/users/register`
completes registration for the authenticated user (409 if repeated) and
bootstraps admins from `ADMIN_EMAILS`.
