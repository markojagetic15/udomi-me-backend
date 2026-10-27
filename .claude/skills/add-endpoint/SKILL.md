---
name: add-endpoint
description: Add a new REST endpoint to the Udomi Me backend. Use when asked to add, expose, or create a new API route in udomi-backend.
---

# Add a REST Endpoint

This codebase has no Nest guards or interceptors wired up — follow the existing manual pattern exactly, don't reach for `@UseGuards` (it's present in the code — `JwtAuthGuard` — but not applied to any controller; see `CLAUDE.md`).

## Steps

1. **DTO** (if the route takes a body): add `src/application/dto/<area>/<name>.dto.ts` with class-validator decorators (`@IsString`, `@IsOptional`, etc.), mirroring the style in `create-listing.dto.ts` / `register.dto.ts`. The global `ValidationPipe` (`main.ts`) enforces it automatically — no per-route wiring needed.

2. **Controller method** in `src/application/controllers/<area>/<area>.controller.ts`:
   - Use `@Get/@Post/@Put/@Delete('/path')`.
   - If the route needs the current user, add `@Cookies('token') token: string` (from `@shared/cookie.helper`) as a param and pass it straight to the service — do not try to decode/verify it in the controller.
   - If it needs pagination, add `@PaginationParams() paginationParams: Pagination` (from `@shared/pagination.helper`) — note this throws 400 if `page`/`limit` query params are missing, so the frontend must always send both.
   - Keep the controller method a one-line call into the service. No logic here.

3. **Service method** in `src/services/<area>/<area>.service.ts`:
   - To resolve the caller, call `this.userService.getMe(token)` (inject `UserService` if not already) — this throws 401/404 itself if the token is missing/invalid/user not found.
   - For ownership checks, compare `resource.user.id !== me.id` and throw `ForbiddenException` — follow the pattern in `deleteListing`/`markAsAdopted`.
   - **Do not add new `jwt.decode()`/`jwt.verify()` calls** — always go through `UserService.getMe()` so there's one place that resolves identity from a token.

4. **Repository method** (only if you need a new query shape) in `src/infrastructure/<entity>.repository.ts` — wrap it in the existing try/catch-and-rethrow-as-HttpException style, call `this.<entity>Repository` (the field backed by `AppDataSource.getRepository(Entity)`), not `@InjectRepository`.

5. **Wire it up**: new controllers/services/repositories must be added to `providers`/`controllers` arrays in `src/app.module.ts` — there are no feature modules, everything is flat in the one `AppModule`.

6. `UserService.getMe()` already performs real signature/expiry verification (`encrypt.verifyToken()`, not `jwt.decode()`) as of 2026-10-27, so going through it (step 3) gets you real auth for free — you don't need to hand-roll verification in a new endpoint.
