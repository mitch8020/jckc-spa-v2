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
npm run start:dev      # http://localhost:3001/api/health
```

Requires a MongoDB instance (default `mongodb://localhost:27017/jckc-v2`).
Domain collections keep the legacy names/fields (`students`, `classrooms`,
`guardians`); better-auth owns `user`, `account`, `session`.

## Environment variables (.env)

| Var | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `BETTER_AUTH_SECRET` | yes | Session signing secret — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BETTER_AUTH_URL` | yes | Backend base URL (`http://localhost:3001`) |
| `FRONTEND_ORIGIN` | yes | CORS + trusted origin (`http://localhost:3000`) |
| `PORT` | no | Defaults to 3001 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Enables Google sign-in when both set |
| `ADMIN_EMAILS` | no | Comma-separated emails that register as admin (bootstrap) |

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
| `npm run migrate:users -- --dry-run\|--write` | Legacy `users` collection → better-auth `user`+`account` docs |
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
                             # (mongoose view over better-auth's 'user' collection)
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
