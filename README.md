# Udomi Me - Backend

REST API for **Udomi Me**, a pet adoption platform. Users can list pets for adoption, browse and filter listings, favorite them, show interest, and mark them as adopted.

Built with [NestJS](https://nestjs.com/) 10, TypeORM, and PostgreSQL.

## Tech Stack

| Concern           | Technology                                          |
| ------------------ | ---------------------------------------------------- |
| Language           | TypeScript 5.1                                      |
| Framework          | NestJS 10 (Express platform)                        |
| Database           | PostgreSQL 16                                       |
| ORM                | TypeORM 0.3 (`synchronize: true`, no migrations)    |
| Auth               | JWT (1-day token, 7-day HTTP-only cookie) + Passport |
| OAuth              | Google (`passport-google-oauth20`)                  |
| Email              | MailerSend (verification + password reset)          |
| Password hashing   | bcrypt (12 salt rounds)                             |
| Validation         | class-validator / class-transformer                 |
| Deployment         | Heroku (`Procfile`)                                 |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Docker (for local PostgreSQL)

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```bash
# Database
DB_HOST=localhost
DB_PORT=5433
DB_USER=udomi
DB_PASSWORD=udomi_password
DB_NAME=udomi_me

# Auth
JWT_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (MailerSend)
MAILERSEND_API_KEY=
MAILERSEND_TEMPLATE_ID=
SUPPORT_EMAIL=
BUSINESS_NAME=

# Misc
FRONTEND_URL=http://localhost:3000
PORT=8080
NODE_ENV=development
```

Start the database:

```bash
docker-compose up -d
```

This spins up Postgres 16 on `localhost:5433` (user `udomi`, db `udomi_me`).

Run the API:

```bash
npm run start:dev
```

The server listens on `PORT` (default `8080`) with all routes prefixed under `/api`.

> Schema is created automatically via TypeORM `synchronize: true` - no migrations to run.

## Scripts

| Command               | Description                          |
| ---------------------- | ------------------------------------- |
| `npm run start:dev`    | Start with hot reload                |
| `npm run start:debug`  | Start with hot reload + debugger     |
| `npm run build`        | Compile to `dist/`                   |
| `npm run start:prod`   | Run the compiled build               |
| `npm run lint`         | ESLint with autofix                  |
| `npm run format`       | Prettier write                       |
| `npm test`             | Unit tests (Jest)                    |
| `npm run test:e2e`     | End-to-end tests                     |
| `npm run test:cov`     | Coverage report                      |

## Project Structure

The codebase follows a lightweight layered architecture:

```
src/
├── application/
│   ├── controllers/     # HTTP layer - routing, request/response shaping
│   │   ├── auth/
│   │   ├── listing/
│   │   └── user/
│   └── dto/              # Request/response DTOs, validated with class-validator
├── domain/               # TypeORM entities (User, Listing, PasswordResetToken)
├── services/             # Business logic, one per domain area
├── infrastructure/       # Repositories - persistence access
├── shared/               # Cross-cutting helpers (JWT guard, cookies, bcrypt/JWT utils, pagination)
├── auth/strategies/      # Passport strategies (Google OAuth)
├── config/               # TypeORM data source configuration
├── app.module.ts
└── main.ts
```

Path aliases (see `tsconfig.json`): `@application`, `@domain`, `@services`, `@infrastructure`, `@shared`, `@config`.

## API Reference

All routes are prefixed with `/api`. Authenticated routes read the JWT from an HTTP-only `token` cookie set on login/signup.

### Auth

| Method | Path                     | Auth | Description                        |
| ------ | ------------------------ | ---- | ----------------------------------- |
| POST   | `/login`                 | -    | Email/password login               |
| POST   | `/signup`                | -    | Register + send verification email |
| GET    | `/auth/verify-email`     | -    | Verify email via token (query)     |
| POST   | `/change-password`       | 🔒   | Change password                    |
| POST   | `/forgot-password`       | -    | Request password reset email       |
| POST   | `/reset-password`        | -    | Reset password via token           |
| POST   | `/logout`                | -    | Clear auth cookie                  |
| GET    | `/google`                | -    | Start Google OAuth flow            |
| GET    | `/auth/google/callback`  | -    | Google OAuth callback              |

### Users

| Method | Path                       | Auth | Description                  |
| ------ | -------------------------- | ---- | ------------------------------ |
| GET    | `/me`                      | 🔒   | Current user profile         |
| GET    | `/users/:id`               | -    | Public user profile          |
| PUT    | `/users/:id`               | 🔒   | Update profile                |
| DELETE | `/users/:id`               | 🔒   | Delete account                |
| GET    | `/users/:id/listings`      | -    | Paginated listings for a user |
| GET    | `/users/:id/favorites`     | -    | User's favorited listings     |

### Listings

| Method | Path                     | Auth | Description                          |
| ------ | ------------------------ | ---- | -------------------------------------- |
| POST   | `/listings/`             | 🔒   | Create a listing                     |
| GET    | `/listings/`             | -    | Browse listings (search/category/order/pagination) |
| GET    | `/listings/user`         | 🔒   | Current user's listings              |
| GET    | `/listings/:id`          | -    | Listing detail                       |
| PUT    | `/listings/:id`          | 🔒   | Update a listing                     |
| DELETE | `/listings/:id`          | 🔒   | Delete a listing                     |
| POST   | `/listings/:id/favorite` | 🔒   | Toggle favorite                      |
| POST   | `/listings/:id/interest` | 🔒   | Show interest                        |
| POST   | `/listings/:id/adopt`    | 🔒   | Mark as adopted                      |
| POST   | `/listings/:id/report`   | 🔒   | Report a listing                     |

## Data Model

**User** - `first_name`, `last_name`, `email` (unique), `password` (nullable for Google accounts), `is_verified`, `verification_token`; owns `listings`, `favorite_listings`, `interested_listings`.

**Listing** - `title`, `description`, `images` (JSON array of `{url, id, position}`), `address`, `phone_number`, `email`, `category` (`dog` | `cat` | `rabbit` | `bird` | `reptile` | `horse` | `other`), `gender`, `breed`, `date_of_birth`, `is_vaccinated`, `size`, `lat`/`lng`/`area_code`, `is_urgent`, `is_adopted`, `is_active`, `interested_users`, `number_of_interested_users`.

**PasswordResetToken** - one-time, 1-hour-expiry token tied to a user.

All entities use UUID primary keys and `created_at`/`updated_at` timestamps.

## Auth Notes

- Passwords require 8–20 characters with at least one uppercase letter, one lowercase letter, and a digit or symbol.
- Tokens are signed with `JWT_SECRET` and expire after 1 day; the cookie itself lives for 7 days (`secure` + `sameSite: strict` in production, `lax` in development).
- Google OAuth users are auto-registered and pre-verified with no password set.

## Deployment

Deployed to Heroku (`Procfile`: `web: node dist/main.js`). Build with `npm run build`, then run `npm run start:prod`.
