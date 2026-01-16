# UNIR Call Trigger - Project Specification

> Standalone web application to trigger HappyRobot voice agent calls with lead context.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Authentication](#authentication)
6. [Pages & Routes](#pages--routes)
7. [API Endpoints](#api-endpoints)
8. [HappyRobot Integration](#happyrobot-integration)
9. [UI/UX Specifications](#uiux-specifications)
10. [Environment Variables](#environment-variables)
11. [Deployment (Railway)](#deployment-railway)
12. [Implementation Checklist](#implementation-checklist)

---

## Project Overview

### Purpose
A demo tool that allows UNIR team members to trigger outbound voice agent calls by filling in lead information. The agent will call the specified phone number with the provided context.

### Key Features
- Single login page (shared credentials for team)
- Form to input lead data + phone number
- Trigger HappyRobot webhook with context
- Track multiple concurrent calls with status polling
- Store call history in database
- Full-featured call history page with search and filters
- Light/Dark theme toggle
- Fully responsive design

### Repo Name
`unir-call-trigger`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Auth | NextAuth.js (Credentials Provider) |
| Database | PostgreSQL (Railway) |
| ORM | Prisma |
| Styling | Tailwind CSS |
| Data Fetching | TanStack React Query |
| Validation | Zod |
| Icons | Lucide React |
| Deployment | Railway |

### Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "next-auth": "^4.24.0",
    "@prisma/client": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "lucide-react": "^0.300.0",
    "tailwindcss": "^3.4.0",
    "zod": "^3.22.0",
    "libphonenumber-js": "^1.10.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0"
  }
}
```

> **Note:** GSAP animations removed from scope - will be handled separately.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UNIR CALL TRIGGER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │  LOGIN PAGE  │────▶│  /trigger    │────▶│  HAPPYROBOT WEBHOOK      │ │
│  │  (NextAuth)  │     │  Form + Live │     │  (Trigger Call)          │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│                              │                         │                 │
│                              ▼                         ▼                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │  /llamadas   │◀────│  PostgreSQL  │◀────│  Status Polling          │ │
│  │  (History)   │     │  (Railway)   │     │  (HappyRobot API)        │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow

1. User logs in with shared credentials
2. User fills form with lead data + phone number
3. Click "Trigger Call" → POST to `/api/calls/trigger`
4. Backend POSTs to HappyRobot webhook with context
5. HappyRobot returns `queued_run_ids`
6. Store call in database with `run_id`
7. Frontend polls `/api/calls/status` every 3 seconds for updates
8. Display call status in UI (multiple concurrent calls supported)
9. All users see all calls (global visibility)

---

## Database Schema

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Call {
  id        String   @id @default(cuid())
  runId     String   @unique  // HappyRobot run_id

  // Lead Data
  nombreAlumno     String
  telefono         String
  programa         String
  formacionPrevia  String
  pais             String
  edad             String?
  estudiosPrevios  String?
  motivacion       String?
  canal            String?
  razonNoInteres   String?

  // Status
  status    CallStatus @default(PENDING)

  // Metadata (full audit trail)
  metadata  Json       @default("{}")  // Stores HR response, timestamps, etc.
  errorMsg  String?

  // Timestamps
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([status])
  @@index([createdAt])
  @@index([nombreAlumno])
  @@index([telefono])
}

enum CallStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELED
}
```

### Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const passwordHash = await hash('unir2024!', 12);

  await prisma.user.upsert({
    where: { email: 'demo@unir.net' },
    update: {},
    create: {
      email: 'demo@unir.net',
      passwordHash,
      name: 'UNIR Demo',
    },
  });

  console.log('Seeded demo user');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Authentication

### NextAuth Configuration

Reference implementation from `unir-demo/src/lib/auth.ts`:

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("User not found");
        }

        const isPasswordValid = await compare(credentials.password, user.passwordHash);

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
```

### Demo Credentials
- **Email:** `demo@unir.net`
- **Password:** `unir2024!`

> **Note:** Credentials should NOT be displayed on login page - share separately.

### Auto-redirect
If user is already authenticated, redirect from `/login` to `/trigger`.

---

## Pages & Routes

### Route Structure

```
src/app/
├── (auth)/
│   └── login/
│       └── page.tsx          # Login page
├── (app)/
│   ├── layout.tsx            # App layout with sidebar + auth check
│   ├── trigger/
│   │   └── page.tsx          # Main form page with active calls
│   └── llamadas/
│       └── page.tsx          # Call history with search/filters
├── api/
│   ├── auth/
│   │   └── [...nextauth]/
│   │       └── route.ts      # NextAuth handler
│   └── calls/
│       ├── trigger/
│       │   └── route.ts      # POST - Trigger new call
│       ├── status/
│       │   └── route.ts      # GET - Poll call status
│       └── list/
│           └── route.ts      # GET - List calls (paginated)
├── layout.tsx
├── globals.css
└── page.tsx                  # Redirect to /login or /trigger
```

### Page Details

#### 1. Login Page (`/login`)
- Based on design from `unir-demo/src/app/login/page.tsx`
- Email and password inputs
- Eye toggle for password visibility
- Error display with icon
- Loading state with spinner
- **No credentials hint displayed** - share separately
- Auto-redirect if already authenticated

#### 2. Trigger Page (`/trigger`) - Protected
**Two sections:**

**Left: Form**
- All lead input fields (see Form Fields section below)
- Phone number with +34 pre-filled
- "Trigger Call" button
- Form validation with Zod
- Form remains filled after successful trigger
- Button disabled during API call

**Right: Active Calls**
- List of PENDING + RUNNING calls only
- Auto-refresh every 3 seconds (always poll, even in background)
- Cards show: nombre, telefono (formatted), programa, país, status badge, duration, time ago
- Visual pulse animation when status changes
- New cards animate in when calls triggered
- Show warning badge if HappyRobot API unreachable

#### 3. Llamadas Page (`/llamadas`) - Protected
**Full-featured call history:**
- Server-side pagination (50 per page)
- Search by name and phone
- Filter by status (PENDING, RUNNING, COMPLETED, FAILED, CANCELED)
- Filter by date (Today, Last 7 days, Last 30 days, All time)
- Table with columns: nombre, telefono (formatted), programa, país, status, createdAt
- Sort by createdAt (newest first)
- Data retained forever

### Sidebar Navigation

Based on `unir-demo` sidebar with these modifications:
- **Only 2 nav items:**
  - Trigger Call → `/trigger`
  - Llamadas → `/llamadas`
- **Removed:** User avatar, status indicator, settings
- **Added:** Sign Out button at bottom with logout icon
- Uses `signOut` from `next-auth/react` directly

---

## API Endpoints

### POST `/api/calls/trigger`

Triggers a new HappyRobot call.

**Request:**
```typescript
interface TriggerCallRequest {
  nombreAlumno: string;      // Required
  telefono: string;          // Required, E.164 format (e.g., +34612345678)
  programa: string;          // Required
  formacionPrevia: string;   // Required
  pais: string;              // Required
  edad?: string;
  estudiosPrevios?: string;
  motivacion?: string;
  canal?: string;
  razonNoInteres?: string;
}
```

**Response:**
```typescript
interface TriggerCallResponse {
  success: boolean;
  callId: string;          // Our DB ID
  runId: string;           // HappyRobot run_id
  status: "PENDING";
}
```

**Error handling:**
- If HappyRobot webhook fails: Return error, don't create DB record
- Toast notification shown on frontend

---

### GET `/api/calls/status?runId=xxx`

Poll status for a specific call.

**Response:**
```typescript
interface CallStatusResponse {
  runId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  updatedAt: string;
  metadata?: Record<string, any>;
  apiUnreachable?: boolean;  // True if couldn't reach HappyRobot API
}
```

**Behavior:**
- If terminal status (COMPLETED, FAILED, CANCELED), return from DB directly
- Otherwise, query HappyRobot Platform API for latest status
- Update database if status changed
- If HappyRobot API unreachable, fall back to database status and flag `apiUnreachable: true`
- Stale calls are NOT auto-marked as failed - trust HappyRobot

---

### GET `/api/calls/list`

List calls with pagination and filters.

**Query Params:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50)
- `status` (optional): Filter by status
- `search` (optional): Search by nombreAlumno or telefono
- `dateRange` (optional): "today" | "7days" | "30days" | "all"

**Response:**
```typescript
interface CallListResponse {
  calls: Array<{
    id: string;
    runId: string;
    nombreAlumno: string;
    telefono: string;
    programa: string;
    pais: string;
    status: string;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

### GET `/api/calls/active`

List active calls only (for main page).

**Response:**
```typescript
interface ActiveCallsResponse {
  calls: Array<{
    id: string;
    runId: string;
    nombreAlumno: string;
    telefono: string;
    programa: string;
    pais: string;
    status: "PENDING" | "RUNNING";
    createdAt: string;
    updatedAt: string;
  }>;
}
```

---

## HappyRobot Integration

> **Reference:** See `docs/HAPPYROBOT_INTEGRATION_GUIDE.md` for complete integration patterns.

### Webhook Payload

```typescript
interface HappyRobotPayload {
  // Phone to call
  phone_number: string;

  // Lead context (used by the voice agent prompt)
  context: {
    nombre_alumno: string;
    programa: string;
    formacion_previa: string;
    edad?: string;
    estudios_previos?: string;
    pais: string;
    motivacion?: string;
    canal?: string;
    razon_no_interes?: string;
  };
}
```

> **Note:** `callback_url` is NOT included - webhooks are optional, relying on polling only.

### Trigger Implementation

```typescript
// src/app/api/calls/trigger/route.ts

export async function POST(request: Request) {
  const body = await request.json();

  // Validate with Zod
  const validated = triggerCallSchema.parse(body);

  // Validate phone number (E.164 format)
  const phoneNumber = parsePhoneNumber(validated.telefono);
  if (!phoneNumber?.isValid()) {
    return Response.json({ error: "Invalid phone number" }, { status: 400 });
  }

  // Build HappyRobot payload
  const payload = {
    phone_number: phoneNumber.format('E.164'),
    context: {
      nombre_alumno: validated.nombreAlumno,
      programa: validated.programa,
      formacion_previa: validated.formacionPrevia,
      pais: validated.pais,
      edad: validated.edad,
      estudios_previos: validated.estudiosPrevios,
      motivacion: validated.motivacion,
      canal: validated.canal,
      razon_no_interes: validated.razonNoInteres,
    },
  };

  // Trigger HappyRobot
  const response = await fetch(process.env.HAPPYROBOT_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("HappyRobot trigger failed:", error);
    return Response.json({ error: "Failed to trigger call" }, { status: 502 });
  }

  const result = await response.json();
  const runId = result.queued_run_ids?.[0];

  if (!runId) {
    return Response.json({ error: "No run_id received" }, { status: 502 });
  }

  // Save to database with full audit trail
  const call = await prisma.call.create({
    data: {
      runId,
      nombreAlumno: validated.nombreAlumno,
      telefono: phoneNumber.format('E.164'),
      programa: validated.programa,
      formacionPrevia: validated.formacionPrevia,
      pais: validated.pais,
      edad: validated.edad,
      estudiosPrevios: validated.estudiosPrevios,
      motivacion: validated.motivacion,
      canal: validated.canal,
      razonNoInteres: validated.razonNoInteres,
      status: "PENDING",
      metadata: {
        triggerResponse: result,
        triggeredAt: new Date().toISOString(),
      },
    },
  });

  return Response.json({
    success: true,
    callId: call.id,
    runId: call.runId,
    status: call.status,
  });
}
```

### Status Polling Implementation

```typescript
// src/app/api/calls/status/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  // Get from database
  const call = await prisma.call.findUnique({
    where: { runId },
  });

  if (!call) {
    return Response.json({ error: "Call not found" }, { status: 404 });
  }

  // If terminal status, return directly
  if (["COMPLETED", "FAILED", "CANCELED"].includes(call.status)) {
    return Response.json({
      runId: call.runId,
      status: call.status,
      updatedAt: call.updatedAt,
    });
  }

  // Otherwise, query HappyRobot Platform API for latest status
  let apiUnreachable = false;

  try {
    const response = await fetch(
      `https://platform.happyrobot.ai/api/v1/runs/${runId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HAPPYROBOT_API_KEY}`,
          "X-Organization-Id": process.env.HAPPYROBOT_ORG_ID!,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const statusMap: Record<string, string> = {
        pending: "PENDING",
        running: "RUNNING",
        completed: "COMPLETED",
        failed: "FAILED",
        canceled: "CANCELED",
      };

      const newStatus = statusMap[data.status] || call.status;

      if (newStatus !== call.status) {
        await prisma.call.update({
          where: { runId },
          data: {
            status: newStatus as any,
            metadata: {
              ...call.metadata as object,
              lastPollResponse: data,
              lastPollAt: new Date().toISOString(),
            },
          },
        });
      }

      return Response.json({
        runId,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("HappyRobot API error:", error);
    apiUnreachable = true;
  }

  // Fallback to database status
  return Response.json({
    runId: call.runId,
    status: call.status,
    updatedAt: call.updatedAt,
    apiUnreachable,
  });
}
```

---

## UI/UX Specifications

### Design System

Reference styles from `unir-demo`:
- **Theme:** Dark/Light toggle (default to system preference or dark)
- **Primary Color:** Blue (#3B82F6)
- **Font:** System default (Inter if needed)
- **Border Radius:** 8px (rounded-lg)
- **Input Style:** `.linear-input` class from unir-demo

### Theme Toggle
- Light/Dark mode switch
- Persisted in localStorage
- Uses ThemeProvider pattern from unir-demo

### Form Fields

| Field | Type | Required | Options/Validation |
|-------|------|----------|-------------------|
| Nombre Alumno | Text input | Yes | - |
| Teléfono | Text input | Yes | E.164 format, +34 pre-filled |
| Programa | Dropdown | Yes | `MAESTRIA_EN_APRENDIZAJE_COGNICION_Y_DESARROLLO_EDUCATIVO` |
| Formación Previa | Dropdown | Yes | `Licenciado` |
| País | Dropdown | Yes | `México` |
| Edad | Number input | No | Min 18, Max 99 |
| Estudios Previos | Textarea | No | - |
| Motivación | Textarea | No | - |
| Canal | Text input | No | - |
| Razón No Interés | Textarea | No | - |

**Form Layout:**
- All fields visible (no collapsible sections)
- Required fields marked with asterisk
- Optional fields clearly labeled

### Main Page Layout (`/trigger`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo]                                      [Theme Toggle]             │
├────────┬────────────────────────────────────────────────────────────────┤
│        │                                                                │
│ NAV    │  ┌─────────────────────────────┐  ┌─────────────────────────┐ │
│        │  │      TRIGGER NEW CALL       │  │    ACTIVE CALLS (3)     │ │
│ Trigger│  │                             │  │                         │ │
│ Call   │  │  Nombre Alumno *            │  │  ┌─────────────────────┐│ │
│        │  │  [____________________]     │  │  │ Andrés Cordón       ││ │
│ ─────  │  │                             │  │  │ +34 612 345 678     ││ │
│        │  │  Teléfono *                 │  │  │ Maestría en...      ││ │
│Llamadas│  │  [+34______________]        │  │  │ México              ││ │
│        │  │                             │  │  │ ● RUNNING  2m ago   ││ │
│        │  │  Programa *                 │  │  └─────────────────────┘│ │
│        │  │  [v Maestría en...    ]     │  │                         │ │
│        │  │                             │  │  ┌─────────────────────┐│ │
│        │  │  Formación Previa *         │  │  │ María López         ││ │
│        │  │  [v Licenciado        ]     │  │  │ +34 698 765 432     ││ │
│        │  │                             │  │  │ Maestría en...      ││ │
│        │  │  País *                     │  │  │ México              ││ │
│        │  │  [v México            ]     │  │  │ ● PENDING  just now ││ │
│        │  │                             │  │  └─────────────────────┘│ │
│        │  │  Edad                       │  │                         │ │
│        │  │  [____________________]     │  │                         │ │
│        │  │                             │  │                         │ │
│        │  │  Estudios Previos           │  │                         │ │
│        │  │  [____________________]     │  │                         │ │
│        │  │  [                    ]     │  │                         │ │
│        │  │                             │  │                         │ │
│        │  │  Motivación                 │  │                         │ │
│        │  │  [____________________]     │  │                         │ │
│        │  │  [                    ]     │  │                         │ │
│        │  │                             │  │                         │ │
│        │  │  Canal                      │  │                         │ │
│        │  │  [____________________]     │  │                         │ │
│        │  │                             │  │                         │ │
│        │  │  Razón No Interés           │  │                         │ │
│        │  │  [____________________]     │  │                         │ │
│        │  │  [                    ]     │  │                         │ │
│        │  │                             │  │                         │ │
│        │  │  [    TRIGGER CALL    ]     │  │                         │ │
│        │  │                             │  │                         │ │
│        │  └─────────────────────────────┘  └─────────────────────────┘ │
│ ─────  │                                                                │
│Sign Out│                                                                │
└────────┴────────────────────────────────────────────────────────────────┘
```

### Status Badges

| Status | Color | Icon |
|--------|-------|------|
| PENDING | Yellow (#EAB308) | Clock |
| RUNNING | Blue (#3B82F6) | Phone (animated pulse) |
| COMPLETED | Green (#22C55E) | CheckCircle |
| FAILED | Red (#EF4444) | XCircle |
| CANCELED | Gray (#6B7280) | Ban |

### Phone Number Display
- Use `libphonenumber-js` to format phone numbers
- Example: +34612345678 → +34 612 345 678

### Polling Behavior

```typescript
// Frontend hook
function useCallPolling() {
  const [calls, setCalls] = useState<Call[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchActiveCalls();

    // Poll every 3 seconds (even when tab is in background)
    const interval = setInterval(() => {
      // Fetch active calls and poll status for each
      const activeCalls = calls.filter(c =>
        c.status === "PENDING" || c.status === "RUNNING"
      );

      if (activeCalls.length > 0) {
        activeCalls.forEach(call => pollStatus(call.runId));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [calls]);
}
```

### Responsive Design
- Fully responsive for desktop and mobile
- On mobile: Stack form above active calls
- Sidebar collapses to hamburger menu on mobile

---

## Environment Variables

```bash
# .env.local

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════════════════
DATABASE_URL="postgresql://user:password@host:5432/unir_call_trigger"

# ═══════════════════════════════════════════════════════════════════════════
# NEXTAUTH
# ═══════════════════════════════════════════════════════════════════════════
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl"

# ═══════════════════════════════════════════════════════════════════════════
# HAPPYROBOT
# ═══════════════════════════════════════════════════════════════════════════
HAPPYROBOT_WEBHOOK_URL="https://hooks.happyrobot.ai/webhook/xxxxx"
HAPPYROBOT_API_KEY="hr_api_xxxxxxxxxxxxx"
HAPPYROBOT_ORG_ID="org_xxxxxxxxxxxxx"

# ═══════════════════════════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════════════════════════
APP_URL="http://localhost:3000"
```

---

## Deployment (Railway)

### Step 1: Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### Step 2: Add PostgreSQL

1. Go to Railway dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Copy the `DATABASE_URL` from the connect panel

### Step 3: Configure Environment Variables

In Railway dashboard → Variables:

```
DATABASE_URL=<from Railway PostgreSQL>
NEXTAUTH_URL=https://your-app.up.railway.app
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
HAPPYROBOT_WEBHOOK_URL=<your webhook URL>
HAPPYROBOT_API_KEY=<your API key>
HAPPYROBOT_ORG_ID=<your org ID>
APP_URL=https://your-app.up.railway.app
```

### Step 4: Deploy

```bash
# Push to Railway
railway up
```

### Step 5: Run Database Migrations

```bash
# Connect to Railway and run migrations
railway run npx prisma migrate deploy
railway run npx prisma db seed
```

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Implementation Checklist

### Phase 1: Project Setup
- [ ] Create new repo `unir-call-trigger`
- [ ] Initialize Next.js 14 with TypeScript
- [ ] Install dependencies
- [ ] Configure Tailwind CSS (copy design system from unir-demo)
- [ ] Set up ThemeProvider for light/dark toggle
- [ ] Set up Prisma with PostgreSQL
- [ ] Create database schema
- [ ] Create seed script

### Phase 2: Authentication
- [ ] Configure NextAuth
- [ ] Create `/api/auth/[...nextauth]/route.ts`
- [ ] Create login page (based on unir-demo)
- [ ] Implement auto-redirect if authenticated
- [ ] Test login flow

### Phase 3: Layout & Navigation
- [ ] Create app layout with sidebar
- [ ] Implement sidebar with 2 nav items + sign out
- [ ] Create AuthGuard component
- [ ] Add theme toggle to layout
- [ ] Make layout fully responsive

### Phase 4: Trigger Page (`/trigger`)
- [ ] Create form component with all fields
- [ ] Implement dropdowns for Programa, Formación Previa, País
- [ ] Phone input with +34 pre-fill
- [ ] Add Zod validation
- [ ] Build active calls list component
- [ ] Add status badges with icons
- [ ] Implement polling hook (3-second interval)
- [ ] Add visual pulse on status change
- [ ] Show warning badge when API unreachable
- [ ] Test form submission and call triggering

### Phase 5: Llamadas Page (`/llamadas`)
- [ ] Create call history table
- [ ] Implement server-side pagination
- [ ] Add search by name/phone
- [ ] Add status filter dropdown
- [ ] Add date range filter (Today, 7 days, 30 days, All)
- [ ] Format phone numbers in display
- [ ] Test pagination and filters

### Phase 6: API Endpoints
- [ ] `POST /api/calls/trigger`
- [ ] `GET /api/calls/status`
- [ ] `GET /api/calls/list`
- [ ] `GET /api/calls/active`
- [ ] Test HappyRobot integration

### Phase 7: Polish
- [ ] Add loading states
- [ ] Add error handling with toasts
- [ ] Test concurrent calls from multiple users
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing

### Phase 8: Deployment
- [ ] Create Railway project
- [ ] Add PostgreSQL database
- [ ] Configure environment variables
- [ ] Deploy
- [ ] Run migrations and seed
- [ ] Test production

---

## Quick Start Commands

```bash
# Clone and setup
git clone <repo>
cd unir-call-trigger
npm install

# Setup database
cp .env.example .env.local
# Edit .env.local with your values

npx prisma migrate dev
npx prisma db seed

# Run dev server
npm run dev

# Deploy to Railway
railway login
railway init
railway up
```

---

## Notes

### Multiple Concurrent Users
- All users share same credentials (`demo@unir.net`)
- Each call is independent (different phone, different context)
- Calls are tracked by `runId`, not by user
- UI shows all calls regardless of who triggered them (global visibility)

### Polling Strategy
- Poll every 3 seconds for all PENDING/RUNNING calls
- Continue polling even when tab is in background
- Stop polling when terminal status reached
- On page reload, fetch current state from DB

### Error Handling
- If HappyRobot webhook fails: Show toast error, don't create call record
- If status polling fails: Show warning badge, fall back to database status
- Stale calls: Leave as-is (trust HappyRobot's eventual response)

### Form State
- Form is client-side React state (isolated per browser)
- Form remains filled after successful trigger
- Button disabled only during API call

### Data Retention
- Call history kept forever
- Full audit trail in metadata JSON field

---

*Last updated: January 2025*
