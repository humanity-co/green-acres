# 🌿 Green Acres — Modern Gated Community & Society Management Platform

An enterprise-grade, multi-tenant society management and smart gate security platform inspired by modern gated-community architectures (such as MyGate). Built with **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS v4**, **Drizzle ORM**, and **PostgreSQL** with hardware-grade **Row Level Security (RLS)** isolation.

[![GitHub Repository](https://img.shields.io/badge/GitHub-Varad1604%2Fcommunity-blue?logo=github)](https://github.com/Varad1604/community)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-PostgreSQL-C5F74F?logo=postgresql)](https://orm.drizzle.team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)

---

## 🌟 About the Project

**Green Acres** digitizes the operations of residential societies, gated communities, and high-rise apartments into a unified, high-security digital ecosystem. It connects society management committees, security guards at gate posts, facility managers, accountants, and residents into a seamless, synchronized workflow.

### Key Highlights
- **Multi-Tenant Architecture**: Strict relational hierarchy (`Platform → Society → Building → Floor → Unit → Resident`).
- **PostgreSQL Row Level Security (RLS)**: Deep tenant isolation at the database layer ensuring zero cross-tenant data leakage or IDOR vulnerabilities.
- **Offline-First Guard Console**: Uninterrupted gate operations with local IndexedDB queuing and 24h allowlist caching for continuous security even during total internet blackouts.
- **Concurrency-Safe Amenity Booking**: Database pessimistic row locking (`FOR UPDATE`) with automated invoicing and tiered refund policies.
- **Role-Based Access Control (RBAC)**: Fine-grained permission model for 12 distinct roles (Super Admin, Society Admin, RWA Members, Accountants, Security Guards, Residents, Domestic Help, Vendors, etc.).
- **Append-Only Audit Logging**: Comprehensive audit trail for sensitive administrative and security events.

---

## 🚀 Key Modules & Capabilities

### 1. 🛡️ Smart Gate Security & Visitor Management
- **Visitor Passes**: Pre-approved resident guest invites, delivery entries, cab verification, and domestic help attendance.
- **Verification Engine**: 6-digit dynamic OTP & QR code check-ins.
- **Offline-First Guard Station**:
  - Offline check-in and check-out against local IndexedDB cached allowlist.
  - Emergency manual pass creation during connectivity loss.
  - Background queue sync drawer with idempotent retry/dismiss resolution.
- **Overstay & Departure Alerts**: Real-time tracking of active entries inside the society premises.

### 2. 🏊 Amenity Booking & Concurrency Engine
- **Slot Concurrency Protection**: High-concurrency slot reservations protected via transactional pessimistic row locks (`FOR UPDATE`) preventing double-booking.
- **Same-Day Past Slot Expiry**: Automatic rejection of slots that have already started.
- **Automated Billing**: Auto-generates itemized invoices upon booking paid amenities.
- **Tiered Cancellation Policy**:
  - **> 24 hours notice**: 100% full refund initiated at payment gateway.
  - **6 – 24 hours notice**: 50% partial refund.
  - **< 6 hours notice**: Non-refundable late cancellation (frees slot for others).

### 3. 💳 Maintenance Billing & Payments
- **Automated Billing**: Monthly society maintenance generation, electricity/water bill tracking, and itemized invoice statements.
- **Payment Gateway Abstraction**: Pluggable provider architecture (`mock` / `razorpay` / `phonepe`) with webhook signature HMAC verification and idempotent state updates.

### 4. 🎫 Helpdesk & Incident Management
- **Service Request Lifecycle**: Resident ticketing for plumbing, electrical, carpentry, and common property issues.
- **SLA Timers & Priority Queues**: Urgency tracking, admin assignments, resident-staff comment threads, and resolution tracking.

### 5. 👥 Community & Communication
- **Digital Noticeboard**: Society-wide and building-targeted emergency announcements.
- **Opinion Polls**: Resident voting and democratic decision polls.
- **Domestic Help Directory**: Daily helper directory with ratings, assigned flats, and real-time on-premise check-in status.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) + Turbopack |
| **Frontend Runtime** | [React 19](https://react.dev/) |
| **Styling & Components** | [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/) |
| **Forms & Validation** | [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/) |
| **Database & ORM** | [PostgreSQL (Neon Serverless)](https://neon.tech/) + [Drizzle ORM](https://orm.drizzle.team/) |
| **Security & Tenancy** | Native PostgreSQL Row Level Security (RLS) policies |
| **Authentication** | Phone OTP Authentication (Mock / MSG91 / Twilio) + JWT HTTP-only sessions |
| **Offline Architecture** | Client Service Worker + IndexedDB + Idempotent Queue Sync |
| **Runtime & Tooling** | Node.js 20+ / [Bun](https://bun.sh/) |

---

## 🏁 Startup & Installation Guide

Follow these steps to set up and run Green Acres on your local machine:

### 1. Prerequisites
- **Node.js**: `v20.0.0` or later (or [Bun](https://bun.sh/) `v1.1+`)
- **Package Manager**: `npm` or `bun`
- **PostgreSQL**: A running PostgreSQL instance (or free serverless database like [Neon](https://neon.tech/))
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/Varad1604/community.git
cd community
```

### 3. Install Dependencies
Using **npm**:
```bash
npm install
```
*(Or using **bun**: `bun install`)*

### 4. Configure Environment Variables
Create a local `.env` file in the root directory:
```bash
cp .env.example .env
```
Open `.env` and fill in the necessary configuration:
```env
# Database Connections
# DATABASE_URL: Privileged connection used for migrations, seeding, and administrative scripts
DATABASE_URL="postgresql://neondb_owner:your_password@ep-example.neon.tech/neondb?sslmode=require"

# APP_DATABASE_URL: Unprivileged connection with NOBYPASSRLS for tenant app queries
APP_DATABASE_URL="postgresql://app_user:your_password@ep-example.neon.tech/neondb?sslmode=require"

# Authentication Secrets (generate random 32+ character strings)
BETTER_AUTH_SECRET="your-super-secret-random-jwt-key"
NEXTAUTH_SECRET="your-super-secret-random-jwt-key"

# OTP Configuration
# Set OTP_PROVIDER="mock" and MOCK_OTP_ENABLED="true" for local development (OTP: 123456)
OTP_PROVIDER="mock"
MOCK_OTP_ENABLED="true"
MSG91_AUTH_KEY=""

# Payments Configuration
# Set PAYMENT_GATEWAY="mock" for simulated local checkout
PAYMENT_GATEWAY="mock"
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
```

### 5. Run Database Migrations & Seeds
Push the schema migrations to PostgreSQL:
```bash
npm run db:migrate
```
*(Optional) Launch Drizzle Studio to view database tables in browser:*
```bash
npm run db:studio
```

### 6. Start the Development Server
```bash
npm run dev
```
*(Or with bun: `bun run dev --port 4000`)*

Open your browser and navigate to:
```
http://localhost:3000
```
*(or `http://localhost:4000` if custom port is used)*

---

## 🧪 Testing & Verification

Ensure all TypeScript types and automated test suites pass:

```bash
# 1. Run strict TypeScript compilation check (0 errors)
npm run typecheck

# 2. Run automated test suites
npm test

# 3. Run individual feature test suites
npx tsx tests/amenities-concurrency.test.ts   # Amenity slot concurrency & refunds (32 tests)
npx tsx tests/guard-offline.test.ts          # Guard offline sync & manual pass (20 tests)
npx tsx tests/audit-remediation-full.test.ts # Security & RLS isolation (35 tests)
```

---

## 📂 Project Architecture

```plaintext
GREEN ACRES/
├── drizzle/                    # PostgreSQL RLS & Schema migrations
├── src/
│   ├── app/                    # Next.js App Router (Pages & API routes)
│   │   ├── admin/              # Management cockpit (Units, Helpdesk, Gate passes, Finance)
│   │   ├── amenities/          # Amenity directory & booking flow
│   │   ├── api/                # REST API routes (Auth, Visitors, Guard, Payments, Bookings)
│   │   ├── bookings/           # Resident booking history & refund cockpit
│   │   ├── guard/              # Security guard station console with offline drawer
│   │   ├── helpdesk/           # Incident reporting & ticketing
│   │   └── visitors/           # Resident guest & delivery invites
│   ├── components/
│   │   ├── shared/             # Common AppShell, Navigation, StatusBadge, PageHeader
│   │   └── ui/                 # Accessible Radix UI components (Shadcn new-york)
│   └── lib/
│       ├── audit.ts            # Append-only audit logger
│       ├── auth/               # OTP generator, JWT tokens, session provider
│       ├── db/                 # Drizzle schemas, PostgreSQL connection pools
│       ├── offline/            # IndexedDB offline store & sync queue engine
│       ├── payments/           # Razorpay & Mock payment gateway abstraction
│       └── tenant.ts           # Multi-tenancy RLS context injector
├── tests/                      # Concurrency, security, and offline test suites
├── .env.example                # Example environment variable template
├── package.json                # Project scripts and dependencies
└── README.md                   # Project documentation
```

---

## 🔒 Security Best Practices

1. **Row Level Security (RLS)**:
   Every query executes under `SET LOCAL app.society_id = '<current_tenant_uuid>'`. Application roles possess `NOBYPASSRLS`, making SQL-level isolation independent of application code bugs.
2. **Offline Guard Safety**:
   Offline gate operations are constrained to cached 24h allowlists and manual emergency entries with cryptographic UUID idempotency to prevent double-entry replay attacks.
3. **Pessimistic Concurrency**:
   Booking transactions acquire row locks (`FOR UPDATE`) on parent amenities and target slots to avoid race conditions during peak reservation windows.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
