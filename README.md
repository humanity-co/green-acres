# Green Acres

Green Acres is a multi-tenant platform for managing gated communities and residential societies. It brings resident services, gate operations, amenity bookings, billing, helpdesk requests, and community communication into one application.

The application is built with Next.js, React, TypeScript, PostgreSQL, and Drizzle ORM. Tenant isolation is enforced with PostgreSQL Row Level Security (RLS), and guard workflows support limited offline operation.

## Features

### Resident and society management

- Society, building, floor, unit, and resident relationships
- Role-based access control for administrators, guards, residents, accountants, facility managers, vendors, and service providers
- Society announcements, events, polls, and community updates
- Resident profiles, vehicles, parking, and domestic help records

### Gate and visitor operations

- Resident guest invitations and delivery entries
- Guard check-in and check-out workflows
- Resident, vehicle, and visitor verification
- OTP and QR-based verification flows
- Limited offline check-in and check-out using a cached allowlist
- Queued offline actions with idempotent synchronization

### Amenities and bookings

- Amenity and slot management
- Transactional booking protection using PostgreSQL row locks
- Capacity checks and prevention of active duplicate bookings
- Automatic billing for paid amenities
- Cancellation and refund calculations based on notice period

### Billing and payments

- Maintenance and utility bill tracking
- Itemized bill records
- Payment provider abstraction with mock, Razorpay, and PhonePe configuration options
- Server-side payment verification and webhook handling
- Idempotent payment state transitions

### Helpdesk and auditing

- Resident service requests and issue tracking
- Assignment, status transitions, comments, priorities, and SLA information
- Append-only audit records for sensitive changes
- CSV exports for administrative reports
- Audit annually
- 

## Technology

| Area | Technology |
| --- | --- |
| Application | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, Lucide React |
| Forms and validation | React Hook Form, Zod |
| Data access | PostgreSQL, Drizzle ORM, Neon-compatible connections |
| Authentication | Phone OTP, JWT-based HTTP-only sessions |
| Offline support | Service worker, IndexedDB, queued synchronization |
| Tooling | Bun, TypeScript, Drizzle Kit |

## Requirements

- Node.js 20 or later
- Bun 1.1 or later
- PostgreSQL 14 or later, or a compatible hosted PostgreSQL service

Bun is the project package manager. Use it for installation, development, testing, and database commands.

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/humanity-co/green-acres.git
cd green-acres
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure the environment

Copy the example environment file and fill in the values for your local database and authentication setup.

```bash
cp .env.example .env
```

For local development, the mock providers can be enabled with the following settings:

```env
OTP_PROVIDER=mock
MOCK_OTP_ENABLED=true
PAYMENT_GATEWAY=mock
```

Do not commit `.env` or any file containing credentials. The mock OTP is intended only for local development.

### 4. Apply database migrations

```bash
bun run db:migrate
```

To inspect the database with Drizzle Studio:

```bash
bun run db:studio
```

### 5. Start the development server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser. To use port 4000:

```bash
bun run dev --port 4000
```

## Environment variables

The complete list of supported variables is in `.env.example`. The most important settings are:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Privileged connection for migrations and administrative scripts |
| `APP_DATABASE_URL` | Application connection used with tenant RLS |
| `BETTER_AUTH_SECRET` | Secret used for authentication sessions |
| `NEXTAUTH_SECRET` | Secret used by authentication integrations |
| `OTP_PROVIDER` | `mock`, `msg91`, or `twilio` |
| `PAYMENT_GATEWAY` | `mock`, `razorpay`, or `phonepe` |

Use strong, unique secrets outside local development. Payment and messaging provider credentials must remain server-side.

## Production database setup

Production uses separate database credentials. `DATABASE_URL` is reserved for migrations and trusted administration. The application must use `APP_DATABASE_URL` with the restricted `app_user` role; the application will refuse to start if that variable is missing.

1. Apply the Drizzle migrations with the migration connection:

	```bash
	DATABASE_URL="$DATABASE_URL" bun run db:migrate
	```

2. Set `APP_DATABASE_PASSWORD` through the deployment secret manager and run the role setup command:

	```bash
	bun run db:setup-role
	```

3. Configure `APP_DATABASE_URL` with the resulting `app_user` credentials and verify the database:

	```bash
	bun run db:verify-production
	```

The verification command checks the runtime role, immutable audit-log permissions, forced RLS and all four policy operations on tenant tables, no-context isolation, and cross-society read isolation. Do not deploy unless it passes.

## Project structure

```text
drizzle/                 Database schema and migrations
public/                  Static files and service worker
scripts/                 Database and maintenance scripts
src/app/                 Pages and API route handlers
src/components/          Shared and UI components
src/lib/                 Authentication, database, audit, and provider modules
tests/                   Feature, security, concurrency, and offline tests
.env.example             Environment variable template
package.json             Project scripts and dependencies
```

## Security model

- Every tenant-scoped record is associated with a society.
- PostgreSQL RLS policies enforce tenant boundaries at the database layer.
- Route handlers derive the authenticated user and society context from the server session.
- Authorization checks are performed on the server using explicit permissions.
- Payment verification and webhook processing happen on the server.
- Mutations write append-only audit records.
- Offline guard actions are limited to cached data and are synchronized with idempotency keys.

## Commands

```bash
bun run typecheck       # TypeScript validation
bun run test            # Test suite configured in package.json
bun run db:generate     # Generate Drizzle migrations
bun run db:migrate      # Apply database migrations
bun run db:seed         # Seed development data
```

Individual tests can be run with `bunx tsx`, for example:

```bash
bunx tsx tests/amenities-concurrency.test.ts
```

## Status

This repository is under active development. Database credentials, production provider configuration, and deployment settings are environment-specific and are not included in the repository.
