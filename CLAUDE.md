# CLAUDE.md — Udomi Me Backend

REST API for Udomi Me, a free pet-adoption platform. NestJS 10 + TypeORM 0.3 + PostgreSQL. See `ARCHITECTURE.md` for the full reference (entities, every endpoint, auth sequence, deployment). This file is the short version loaded every session.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | NestJS 10 (Express platform) |
| ORM | TypeORM 0.3 — `synchronize: true`, **no migrations** |
| DB | PostgreSQL |
| Auth | Hand-rolled JWT in an httpOnly `token` cookie (SameSite=Lax), resolved only via `UserService.getMe` |
| OAuth | Google (`passport-google-oauth20`) |
| Email | `@nestjs-modules/mailer` (nodemailer SMTP + handlebars). `shared/mail.config.ts` (transport), `shared/mail-templates/email.hbs` (layout, copied to `dist` via `nest-cli.json` assets), `shared/mail.service.ts` (`send()`, HTML + plain text, no-op until `SMTP_HOST` + `MAIL_FROM` + `SMTP_USER`/`SMTP_PASS` are set); copy in `services/notification/email-copy.ts` (hr + en) |
| Image storage | Local disk: `POST /api/upload` (`application/controllers/resource/`) re-encodes to WebP ≤1600px with `sharp`, writes to `UPLOAD_DIR` (Docker volume `udomi-backend/uploads`), served at `/api/uploads/*`. Orphans swept daily (`services/maintenance`). **Back it up** (`/var/www/backups`). |
| Rate limiting | `@nestjs/throttler` global 300/min/IP, tighter `@Throttle` on auth, messaging, reports, uploads (in-memory — resets on restart) |
| Monitoring | Sentry (`shared/sentry.ts`), only when `SENTRY_DSN` is set; 5xx only, no PII |
| Validation | class-validator, global `ValidationPipe({ whitelist: true, transform: true })` — **undecorated body fields are stripped**, so every DTO field needs a decorator |
| Password hashing | bcrypt, 12 rounds |

## Commands

```bash
npm install
docker-compose up -d        # local Postgres on localhost:5433
npm run start:dev           # hot reload, port from PORT env (default 8080)
npm run lint                # eslint --fix (prettier enforced)
npx tsc --noEmit -p tsconfig.json
npm run build && npm run start:prod
```

All routes are globally prefixed `/api` (set in `main.ts`).

## Env

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   # read by src/config/data-source.ts
JWT_SECRET
FRONTEND_URL                                      # CORS, email links, OAuth redirect
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS       # email (any SMTP; production = Mailjet in-v3.mailjet.com:587, user = API key, pass = secret key)
MAIL_FROM, MAIL_REPLY_TO                          # SMTP_HOST + MAIL_FROM + SMTP_USER/SMTP_PASS turn email ON (and email-verification enforcement); SMTP_NO_AUTH=true for local catchers
ADMIN_EMAILS                                      # comma-separated; these accounts get role=admin
SENTRY_DSN                                        # optional
UPLOAD_DIR                                        # optional, default ./uploads
FRONTEND_INTERNAL_URL                             # optional, default http://udomi-frontend (share previews)
PORT, NODE_ENV
```

## Features (2026-10-27 rebuild)

Listings have `listing_type` adoption/lost/found, health/temperament flags, fee, city/lat/lng, adoption story. Browse filters (`domain/listing/listing-filters.ts`) are applied in SQL by `ListingRepository.search` **and** in memory by `matchesFilters` for saved-search alerts — keep both in sync. Other modules: messaging (`conversations`/`messages`, polling), notifications + saved searches, reports + admin moderation (`/api/admin/*`: stats, reports, all users with filters/counts + detail + ban/delete, all listings in any state + detail + hide/delete, shelters, team messages — `POST /admin/users/:id/message` and `POST /admin/broadcast` (audience all/posters/shelters) post into each user's inbox as an `is_support` conversation shown as "Udomi me tim"; broadcasts are in-app only, no email copies — and an `admin_actions` audit log written by every admin action — admins and the caller themselves can't be banned/deleted; user delete requires `confirm_email`), verified shelters (`/api/me/shelter`, public `GET /api/users/:id`), success stories (`GET /api/listings/adopted`), GDPR export/delete (`GET/DELETE /api/me`), per-listing Open Graph pages (`/api/share/animal/:id`, nginx rewrites `/animal/:id` there) and 1200×630 JPEG previews (`/api/og/:id.jpg`).

Public user data always goes through `domain/user/public-user.ts` (`publicUser()` — first name + last initial, never email). `User.toJSON()` strips password/verification_token — return entity instances (use `Object.assign`, not spread, when adding fields).

## Folder structure — what goes where

| Layer | Path | Contains |
|---|---|---|
| Entities | `src/domain/<area>/*.entity.ts` | TypeORM entities only |
| HTTP | `src/application/controllers/<area>/*.controller.ts` | Routes, no business logic |
| DTOs | `src/application/dto/<area>/*.dto.ts` | class-validator request shapes |
| Business logic | `src/services/<area>/*.service.ts` | Everything — including manual auth checks |
| Persistence | `src/infrastructure/*.repository.ts` | Thin wrappers over `AppDataSource.getRepository(Entity)` |
| Cross-cutting | `src/shared/` | `auth.guard.ts`, `cookie.helper.ts`, `encrypt.ts`, `pagination.helper.ts` |
| Wiring | `src/app.module.ts` | Single flat module — everything registered here, no feature modules |

Path aliases: `@application/*`, `@domain/*`, `@services/*`, `@infrastructure/*`, `@shared/*`, `@config/*` (see `tsconfig.json`).

## Fixed 2026-10-27 (previously critical gotchas — kept here so the history isn't lost)

- **JWT signature verification.** `UserService.getMe()` and `AuthService.changePassword()` used to call `jwt.decode(token)` (no signature check). Both now call the new `encrypt.verifyToken()` (`shared/encrypt.ts`, wraps `jwt.verify`) and reject with 401 on an invalid/expired/tampered token. The dead `@UseGuards(JwtAuthGuard)` decorators on service methods (never functional — Nest guards only apply to controllers) were removed; `JwtAuthGuard` itself is still unused but is a correctly-implemented, header-based guard kept for future use.
- **`PUT /listings/:id` had no auth/ownership check.** It now reads the `token` cookie and requires `listing.user.id === me.id`, matching the pattern already used by `DELETE`/`adopt`.
- **Google OAuth callback URL was hardcoded** to `http://localhost:9000/...`. Now reads `GOOGLE_CALLBACK_URL` (falls back to `http://localhost:${PORT}/api/auth/google/callback` for local dev). Set `GOOGLE_CALLBACK_URL` in production to the real public URL registered in Google Cloud Console.
- **docker-compose env mismatch**: root `docker-compose.yml` was passing an unused `DATABASE_URL` to this service. Now passes `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` matching `data-source.ts`, plus `FRONTEND_URL` and `GOOGLE_CALLBACK_URL`. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/MailerSend vars are still not in that file (they're real secrets, not safe to commit) — set them via your actual secret store before relying on OAuth/email in that deployment.
- **Dockerfile never built `dist/`.** It ran `npm install --production` (skipping `@nestjs/cli`) and `CMD ["npm", "start"]` with no build step — the container could not have booted. Now a two-stage build: full `npm install` + `npm run build` in the build stage, `npm install --production` + the compiled `dist/` in the runtime stage. Verified locally: `npm run build` produces a `dist/main.js` that correctly resolves the `@xxx/*` path aliases (Nest's own compiler rewrites them to relative `require()`s) and boots up to the DB-connect step.
- Also added a `heroku-postbuild` script (`npm run build`) to `package.json` so the Heroku/Procfile deploy path builds reliably too, independent of the Docker path.
- **`init-scripts/` referenced by `docker-compose.yml` didn't exist**, so neither `udomi_db` nor `kdrive_db` would ever get created in a fresh Postgres volume. Added `/var/www/init-scripts/01-create-databases.sql`. Note: Postgres only runs init scripts on a **first-ever** init of an empty data volume — if `postgres_data` already has data, create the databases manually instead.

## Remaining gotchas (not fixed — need a product/architecture decision, not a pure bug fix)

1. **`synchronize: true`, no migrations.** Schema changes are made by editing entity classes and restarting — TypeORM auto-alters the table. There is no migration history; be careful with destructive column changes against the production DB.
2. **Repositories bypass Nest DI.** `infrastructure/*.repository.ts` call `AppDataSource.getRepository(Entity)` directly (the raw TypeORM DataSource singleton from `config/data-source.ts`), not `@InjectRepository`. `TypeOrmModule.forFeature([User])` in `app.module.ts` is effectively unused. Works fine as-is; just don't expect `@InjectRepository` to do anything if you add it elsewhere.
3. **Email verification is enforced only once email works.** `UserService.requireVerified` blocks posting/messaging for unverified users when `MailService.isConfigured()` (SMTP set); before that, nobody could verify, so it's skipped. Login itself never requires verification.

See `ARCHITECTURE.md` for the full entity model, every endpoint, and the deployment topology (nginx + docker-compose).
