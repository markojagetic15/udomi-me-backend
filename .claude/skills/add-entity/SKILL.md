---
name: add-entity
description: Add a new TypeORM entity/table to the Udomi Me backend. Use when asked to add a new domain object, table, or persisted model in udomi-backend.
---

# Add an Entity

1. Create `src/domain/<area>/<Name>.entity.ts`:
   - `@Entity({ name: 'snake_case_table_name' })`.
   - Primary key convention in this codebase is `@PrimaryColumn() id: string` with the ID generated as `uuidv4()` in the *service* that creates the row (see `AuthService.signup`, `ListingService.createListing`) — **not** `@PrimaryGeneratedColumn('uuid')`. Match this unless you have a specific reason to change the convention (and call it out if you do).
   - Add `@CreateDateColumn({ type: 'timestamptz' })` / `@UpdateDateColumn({ type: 'timestamptz' })` for `created_at`/`updated_at` if the entity needs them.

2. **Register it** in `src/config/data-source.ts` — add the import and push it into the `entities: [User, Listing, PasswordResetToken]` array. Schema is created/altered automatically (`synchronize: true`) on next boot — there is no migration to generate or run. Be cautious with column renames/drops against a real database; `synchronize` will drop/recreate columns it can't reconcile.

3. Create `src/infrastructure/<name>.repository.ts`:
   - `private readonly xRepository = AppDataSource.getRepository(X);` (same `AppDataSource` singleton from step 2's import, not `@InjectRepository`).
   - Wrap every method body in try/catch, log with `console.error`, rethrow as `HttpException(..., HttpStatus.INTERNAL_SERVER_ERROR)` — match the style in `user.repository.ts`.

4. Add the repository class to `providers` in `src/app.module.ts` so Nest's DI container can inject it into services.

5. If the entity relates to `User` or `Listing`, add the inverse side relation on that entity too (e.g. `@OneToMany`/`@ManyToOne` pair) so TypeORM can resolve both directions.
