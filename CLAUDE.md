# CLAUDE.md — Udomi Me Backend

REST API for Udomi Me, a free pet-adoption platform. NestJS 10 + TypeORM 0.3 + PostgreSQL. See `ARCHITECTURE.md` for the full reference (entities, every endpoint, auth sequence, deployment). This file is the short version loaded every session.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | NestJS 10 (Express platform) |
| ORM | TypeORM 0.3 — `synchronize: true`, **no migrations** |
| DB | PostgreSQL |
| Auth | Hand-rolled JWT in an httpOnly cookie named `token` (not Nest guards — see gotcha below) |
| OAuth | Google (`passport-google-oauth20`) |
| Email | MailerSend |
| Validation | class-validator / class-transformer (global `ValidationPipe`) |
| Password hashing | bcrypt, 12 rounds |

## Commands

```bash
npm install
docker-compose up -d        # local Postgres on localhost:5433
npm run start:dev           # hot reload, port from PORT env (default 8080)
npm run lint                # eslint --fix
npm test                    # jest unit tests
npm run test:e2e
npm run build && npm run start:prod
```

All routes are globally prefixed `/api` (set in `main.ts`).

## Required .env

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   # read by src/config/data-source.ts
JWT_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
MAILERSEND_API_KEY, MAILERSEND_TEMPLATE_ID, SUPPORT_EMAIL, BUSINESS_NAME
FRONTEND_URL                                      # used in email links + CORS allow-list + OAuth redirect
PORT, NODE_ENV
```

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
3. **Login does not check `is_verified`.** A signed-up-but-unverified user already has a cookie set at signup and can use the app immediately; `verify-email` is not enforced anywhere. Left alone because enforcing it would lock out any already-registered unverified users — a product call, not a drive-by fix.

See `ARCHITECTURE.md` for the full entity model, every endpoint, and the deployment topology (nginx + docker-compose).
