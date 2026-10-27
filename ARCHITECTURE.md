# ARCHITECTURE.md — Udomi Me Backend

Full reference for the backend codebase. Read `CLAUDE.md` first for the short version and the critical gotchas list.

---

## Table of Contents

1. [Layered Structure & Dependency Direction](#1-layered-structure--dependency-direction)
2. [Entity Reference](#2-entity-reference)
3. [Module Wiring](#3-module-wiring)
4. [Auth Flow — Full Detail](#4-auth-flow--full-detail)
5. [Controllers & Endpoints](#5-controllers--endpoints)
6. [Pagination](#6-pagination)
7. [Email Sending](#7-email-sending)
8. [Error Handling Conventions](#8-error-handling-conventions)
9. [Deployment Topology](#9-deployment-topology)

---

## 1. Layered Structure & Dependency Direction

```
Controller (application/controllers)
   → Service (services)
       → Repository (infrastructure)
           → AppDataSource.getRepository(Entity)   [config/data-source.ts]
Entity (domain) is referenced by all layers; it has no dependencies of its own.
```

- **`domain/`** — pure TypeORM entity classes. No logic.
- **`application/controllers/`** — route definitions. Extract params (`@Body`, `@Param`, `@Cookies('token')`, `@PaginationParams()`), call exactly one service method, return its result. No business rules live here.
- **`application/dto/`** — class-validator request shapes, validated by the global `ValidationPipe` (`main.ts`). A couple of response DTOs exist (`ListingResponseDto`, `GetMeResponseDto`) but are **not actually used** — controllers return raw entity objects / plain objects, so `@Exclude()` on `ListingResponseDto.user` has no effect in practice (no `ClassSerializerInterceptor` is registered).
- **`services/`** — all business logic, including what would normally be guard/auth-layer concerns (see §4). Services call other services directly (e.g. `ListingService` depends on `UserService.getMe()` to resolve the current user from a raw token string).
- **`infrastructure/`** — one class per entity, thin try/catch wrappers around TypeORM repository calls. These do **not** use Nest's `@InjectRepository`; each one pulls its repository from the module-level `AppDataSource` singleton declared in `config/data-source.ts`.
- **`shared/`** — cross-cutting utilities: `JwtAuthGuard` (unused by any controller), `Cookies` param decorator, `PaginationParams` param decorator, `encrypt` (bcrypt + jwt.sign wrapper).

There are no Nest feature modules — `app.module.ts` is the only `@Module`, registering every controller and every provider flatly.

---

## 2. Entity Reference

### `User` (`users` table) — `src/domain/user/User.entity.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | string, `@PrimaryColumn` | UUID, generated with `uuidv4()` in application code — **not** `@PrimaryGeneratedColumn`, so every insert path must set `id` itself |
| `first_name`, `last_name` | string | required |
| `email` | string | required, unique |
| `password` | string | nullable, default `''` — empty for Google-only accounts |
| `is_verified` | boolean | default false; **not enforced at login** |
| `verification_token` | text | nullable; cleared (`null`) after verification |
| `created_at` / `updated_at` | timestamptz | auto |
| `listings` | `OneToMany → Listing.user` | |
| `favorite_listings` | `ManyToMany → Listing`, join table `user_favorite_listings` | toggled via `/listings/:id/favorite` |
| `interested_listings` | `ManyToMany → Listing`, join table `user_interested_listings` | toggled via `/listings/:id/interest` |

### `Listing` (`listings` table) — `src/domain/listing/Listing.entity.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | string, `@PrimaryColumn` | UUID via `uuidv4()` |
| `title`, `description` | string | |
| `images` | `json` | array of `{url, id, position}` — no separate Image entity |
| `address`, `phone_number`, `email`, `area_code` | string | all nullable |
| `date_of_birth` | string (not a real `Date` column) | |
| `is_vaccinated`, `breed`, `gender` | | `gender` is a bare `'male' \| 'female'` union, not a DB enum |
| `category` | `Category` enum, nullable | `dog\|cat\|rabbit\|bird\|reptile\|horse\|other` |
| `user` | `ManyToOne → User`, `onDelete: CASCADE` | deleting a user deletes their listings |
| `interested_users` | `text[]` | **parallel, redundant tracking** of interest as a raw string-array column on `Listing`, separate from `User.interested_listings` join table — the two are not kept in sync by the same code path; `showInterest()` only touches `User.interested_listings` + `number_of_interested_users`, never this column. Treat `interested_users` as effectively dead/unused. |
| `is_urgent`, `is_adopted`, `is_active` | boolean, default false/false/true | |
| `number_of_interested_users` | number, default 0 | incremented/decremented in `showInterest()` |
| `size` | float, default 0 | kg |
| `lat`, `lng` | float, nullable | |
| `created_at` / `updated_at` | timestamptz | |

### `PasswordResetToken` (`password_reset_tokens` table)

| Column | Type |
|---|---|
| `token` | string, `@PrimaryColumn` (the token itself is the PK, a `uuidv4()`) |
| `userId` | string |
| `expiration` | Date — checked with `tokenData.expiration < new Date()` in `resetPassword()`, 1 hour from creation |

No cleanup job removes expired/used tokens — they accumulate in the table.

---

## 3. Module Wiring

`src/app.module.ts` is the single `@Module`:

```ts
imports: [
  JwtModule.registerAsync({ secret: JWT_SECRET, signOptions: { expiresIn: '1d' } }),
  PassportModule,
  TypeOrmModule.forFeature([User]),   // effectively unused — see §1
  TypeOrmModule.forRoot(AppDataSource.options),
],
controllers: [UserController, AuthController, ListingController],
providers: [UserService, AuthService, ListingService, UserRepository, ListingRepository, AuthRepository, GoogleStrategy],
```

`main.ts` bootstrap order:
1. `AppDataSource.initialize()` (raw TypeORM connect) — only on success does it call `bootstrap()`. A DB connection failure here just logs the error via `.catch(console.error)`; the Nest app never starts and the process does not exit non-zero on its own.
2. Inside `bootstrap()`: create Nest app → `cookieParser()` middleware → global `ValidationPipe` → global prefix `/api` → CORS (`origin: [FRONTEND_URL]`, `credentials: true`) → `listen(PORT)`.

---

## 4. Auth Flow — Full Detail

### Token mechanics

- `encrypt.generateToken({ id })` signs a JWT with `JWT_SECRET`, 1-day expiry (`src/shared/encrypt.ts`).
- `AuthService.setAuthCookie()` sets it as cookie `token`: `httpOnly: true`, `secure` only in production, `sameSite: 'strict'` in production / `'lax'` in dev, `maxAge: 7 days`. **Fixed 2026-10-27**: the JWT itself expires after 1 day but the cookie lives 7 days — read paths now call `encrypt.verifyToken()` (`jwt.verify`), so an expired-signature JWT is correctly rejected with 401 once the 1-day expiry passes, even though the cookie is still sent for up to 7 days. (Previously every read path used `jwt.decode()`, which never checked the signature or expiry at all.)
- Every protected endpoint takes the cookie value as a plain `token: string` controller param via `@Cookies('token')` and passes it down to a service method, which calls `UserService.getMe(token)` → `encrypt.verifyToken(token)` → look up `User` by the decoded `id`. There is no middleware/guard layer — this repeats in every service method that needs the current user.

### Register (`POST /signup`)

1. Reject if a user with that email exists (different message if the existing account is Google-only vs password).
2. Hash password (bcrypt, 12 rounds), generate `verification_token` (`uuidv4()`), create `User` with `id = uuidv4()`, `is_verified = false`.
3. Save, send a verification email (plain HTML, not a MailerSend template) linking to `${FRONTEND_URL}/verify-email?token=...`.
4. **Issue the auth cookie immediately** — the new user is logged in before verifying their email.

### Login (`POST /login`)

1. Look up by email → 404 if missing.
2. If `password` is empty (Google-only account) → 401 with a Google-specific message.
3. `bcrypt.compareSync` → 401 if wrong.
4. Issue cookie. **`is_verified` is never checked.**

### Verify Email (`GET /auth/verify-email?token=`)

Looks up user by `verification_token`, sets `is_verified = true`, clears the token. Does not log the user in or require them to already be logged in.

### Forgot / Reset Password

- `forgotPassword`: always returns the same generic message regardless of whether the email exists (timing/enumeration-safe at the response level). If the account is Google-only, throws a 400 explaining password reset isn't available — which does leak account existence/type for that branch. Creates a `PasswordResetToken` (1-hour expiry) and emails a reset link — via a MailerSend **template** if `MAILERSEND_TEMPLATE_ID` is set, else a raw HTML fallback email.
- `resetPassword`: validates token exists and isn't expired, re-hashes password, does **not** delete the used token afterward (it remains valid/reusable until it would otherwise expire, and isn't marked used).

### Change Password (`POST /change-password`, cookie-authenticated)

Verifies the cookie token (`encrypt.verifyToken`) to get `id`, requires `currentPassword` to match, then re-hashes. Rejects Google-only accounts.

### Logout

`res.clearCookie('token')` — stateless, no server-side session/token invalidation (there's nothing to invalidate since tokens aren't tracked server-side).

### Google OAuth

1. `GET /google` → Passport `AuthGuard('google')` redirects to Google.
2. Google redirects to `GET /auth/google/callback` — the callback URL registered with Passport now comes from `GOOGLE_CALLBACK_URL` (falls back to `http://localhost:${PORT}/api/auth/google/callback` for local dev). **Fixed 2026-10-27**: previously hardcoded to `http://localhost:9000/...` regardless of environment.
3. `GoogleStrategy.validate()` extracts email/name/picture, calls `done(null, user)`.
4. `AuthController.googleLoginCallback` receives `req.user`, calls `googleLoginAndRegister()`:
   - find-or-create a `User` (`password: ''`, `is_verified: true`).
   - issue the auth cookie.
   - **redirect** to `${FRONTEND_URL}/google-callback?token=<jwt>&user=<url-encoded JSON>` — the JWT and full user object are placed in the URL query string in addition to the cookie. This value ends up in browser history and any access/proxy logs that record full request URLs.

---

## 5. Controllers & Endpoints

🔒 = reads the `token` cookie and calls `getMe()`/an ownership check somewhere in the service. "none" = no auth check of any kind in the code path.

### `AuthController` (no path prefix)

| Method | Path | Auth | Service method |
|---|---|---|---|
| POST | `/login` | — | `login` |
| POST | `/signup` | — | `signup` |
| GET | `/auth/verify-email?token=` | — | `verifyEmail` |
| POST | `/change-password` | 🔒 | `changePassword` |
| POST | `/forgot-password` | — | `forgotPassword` |
| POST | `/reset-password` | — | `resetPassword` |
| POST | `/logout` | — | `logout` |
| GET | `/google` | Passport Google guard | — |
| GET | `/auth/google/callback` | Passport Google guard | `googleLoginAndRegister` |

### `UserController` (no path prefix)

| Method | Path | Auth | Service method |
|---|---|---|---|
| GET | `/me` | 🔒 | `getMe` |
| PUT | `/users/:id` | 🔒 + `me.id !== id` check | `updateUser` |
| DELETE | `/users/:id` | 🔒 + `me.id !== id` check | `deleteUser` |
| GET | `/users/:id/listings` | none | `getUserListings` |
| GET | `/users/:id` | none | `getUser` |
| GET | `/users/:id/favorites` | none | `getUserFavorites` |

### `ListingController` (`/listings`)

| Method | Path | Auth | Service method |
|---|---|---|---|
| POST | `/` | 🔒 | `createListing` |
| PUT | `/:id` | 🔒 + ownership check (fixed 2026-10-27; previously **none** — no token param at all) | `updateListing` |
| DELETE | `/:id` | 🔒 + ownership check | `deleteListing` |
| POST | `/:id/favorite` | 🔒 | `favoriteListing` (toggle) |
| POST | `/:id/interest` | 🔒 + blocks self-interest | `showInterest` (toggle) |
| POST | `/:id/adopt` | 🔒 + ownership check | `markAsAdopted` |
| POST | `/:id/report` | takes a cookie param but `reportListing()` never reads it or does anything with the report | `reportListing` |
| GET | `/user` | 🔒 | `getMyListings` (search + pagination) |
| GET | `/` | none | `getAllListings` (search + category[] + order + pagination; `category` query param is a JSON-stringified array, parsed with `JSON.parse`) |
| GET | `/:id` | none | `getListingById` |

`getAllListings` filters `is_active: true, is_adopted: false` always (adopted/inactive listings never appear in browse results, only via `/listings/user` or `/listings/:id` direct lookup).

---

## 6. Pagination

`@PaginationParams()` (`shared/pagination.helper.ts`) reads `page`/`limit` from the query string. Both are **required** — missing either throws `400 Missing pagination params`. Response shape from listing endpoints:

```ts
{ listings: Listing[], meta: { total, page, take, totalPages } }
```

(Note: field is `take`, not `limit`, in the response meta — asymmetric with the request param name.)

---

## 7. Email Sending

Two independent code paths in `AuthService`, both guarded by presence of `MAILERSEND_API_KEY` (silently no-op/log-and-continue if unset, never throws to the caller):

- **Verification + plain-fallback reset emails**: `sendEmail()` builds raw HTML inline and calls `mailerSend.email.send()` directly with `Sender`/`Recipient`.
- **Password reset (preferred path)**: if `MAILERSEND_TEMPLATE_ID` is also set, uses `.setTemplateId()` + `.setPersonalization()` with `{name, account_name, support_email, token}` — the actual email body lives in the MailerSend dashboard template, not in this repo.

A failed send is caught and logged (`console.error`); it never fails the HTTP request (e.g. signup still succeeds even if the verification email fails to send).

---

## 8. Error Handling Conventions

- Repositories catch all TypeORM errors and rethrow as `HttpException(..., INTERNAL_SERVER_ERROR)` (or a plain `Error` in `AuthRepository`), logging the original via `console.error` first.
- Services throw Nest's built-in exceptions (`NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `HttpException`) directly — Nest's default exception filter converts these to JSON `{statusCode, message}` responses.
- No global exception filter is registered; everything relies on Nest's default behavior.
- `deleteListing`/`deleteUser` return `new HttpException('...', HttpStatus.OK)` as their success value instead of e.g. `{ message: ... }` — this works today, but it's unusual to construct an `HttpException` as a successful return value rather than throwing it.

---

## 9. Deployment Topology

This service is one of three apps on the same host, run via the root `/var/www/docker-compose.yml` and fronted by one nginx reverse proxy (`/var/www/nginx/conf.d/apps.conf`). See `/var/www/CLAUDE.md` for the full cross-service picture.

```
docker-compose service: udomi-backend
  build context: ./udomi-backend, Dockerfile (two-stage: build stage runs `npm run build`,
                  runtime stage is `npm install --production` + compiled dist/ — fixed 2026-10-27,
                  previously had no build step at all and could not boot)
  container_name: udomi_backend
  env: PORT=5000, DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME, JWT_SECRET, FRONTEND_URL,
       GOOGLE_CALLBACK_URL, NODE_ENV=production
       (fixed 2026-10-27: previously passed an unused DATABASE_URL instead of the
       individual DB_* vars this code actually reads — see data-source.ts)
  depends_on: postgres-db (shared Postgres 15-alpine container; /var/www/init-scripts/01-create-databases.sql
              now creates the `udomi_db` and `kdrive_db` databases on first volume init — this script
              didn't exist before 2026-10-27, so neither database was ever created)
  network: app-network (bridge)

nginx (udomi-me.com, www.udomi-me.com):
  location /       → udomi-frontend:80    (fixed 2026-10-27: was :3000, which nothing in that
                                            container listens on — the image is nginx:alpine
                                            serving on its default port 80)
  location /api/   → udomi-backend:5000   (fixed 2026-10-27: proxy_pass previously had a trailing
                                            slash, which strips the matched /api/ prefix before
                                            forwarding — e.g. /api/login became /login upstream,
                                            which the backend's own global prefix of /api doesn't
                                            serve. Removing the trailing path from proxy_pass makes
                                            nginx forward the original URI unchanged.)
```

Also deployable standalone to Heroku via `Procfile` (`web: node dist/main.js`). `package.json` now has a `heroku-postbuild` script (`npm run build`) so this path reliably produces `dist/` too — previously it relied on undocumented Heroku buildpack behavior to run the build.
