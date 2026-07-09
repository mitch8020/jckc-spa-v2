# Heroku Deployment

This repository is configured as a single Heroku Node.js app from the repo
root. Heroku detects `package.json`, installs both service directories through
the root `install` script, runs the root `build` script, and starts `web` with
`npm start`.

## Required config vars

Set these on the Heroku app:

```bash
heroku config:set MONGO_URI='mongodb+srv://...'
heroku config:set BETTER_AUTH_SECRET='replace-with-32-byte-secret'
heroku config:set BETTER_AUTH_URL='https://<app-name>.herokuapp.com'
heroku config:set FRONTEND_ORIGIN='https://<app-name>.herokuapp.com'
```

Optional production config:

```bash
heroku config:set GOOGLE_CLIENT_ID='...'
heroku config:set GOOGLE_CLIENT_SECRET='...'
heroku config:set AUTH_ALLOWED_EMAILS='admin@example.com,parent@example.com'
heroku config:set ADMIN_EMAILS='admin@example.com'
heroku config:set MONGO_DNS_SERVERS='1.1.1.1,8.8.8.8'
```

Do not set `VITE_API_URL` for the normal single-app Heroku deployment. When it
is unset at build time, the frontend calls same-origin `/api/*`, which is served
by the Nest backend on the same dyno.

## Google OAuth

If Google sign-in is enabled, add this Authorized redirect URI in Google Cloud:

```text
https://<app-name>.herokuapp.com/api/auth/callback/google
```

## Deploy

```bash
heroku create <app-name>
heroku buildpacks:set heroku/nodejs
git push heroku main
heroku open
```

Health check:

```bash
curl https://<app-name>.herokuapp.com/api/health
heroku logs --tail
```
