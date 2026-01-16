# Integrating HappyRobot into Your Application

> A universal guide for integrating HappyRobot AI Voice Agents into any application.

---

## Table of Contents

1. [What is HappyRobot?](#what-is-happyrobot)
2. [Recommended Stack](#recommended-stack)
3. [Integration Pattern Overview](#integration-pattern-overview)
4. [Environment Variables](#environment-variables)
5. [Database Requirements](#database-requirements)
6. [Step 1: Triggering a Workflow](#step-1-triggering-a-workflow)
7. [Step 2: Polling for Status](#step-2-polling-for-status)
8. [Step 3: Receiving Webhooks](#step-3-receiving-webhooks)
9. [Frontend Polling Hook](#frontend-polling-hook)
10. [Real-time Updates (Choose Your Stack)](#real-time-updates-choose-your-stack)
11. [Error Handling & Best Practices](#error-handling--best-practices)
12. [Implementation Checklist](#implementation-checklist)

---

## What is HappyRobot?

HappyRobot is an AI voice agent platform. You define **workflows** in their dashboard, and then trigger them via API. Each workflow execution is called a **run** and has a unique `run_id`.

**Key concepts:**

| Term             | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| **Workflow**     | A template you create in HappyRobot that defines what the AI does |
| **Run**          | A single execution of a workflow                                  |
| **Run ID**       | Unique identifier for tracking a run (e.g., `run_abc123`)         |
| **Webhook URL**  | HappyRobot's URL where you POST to trigger workflows              |
| **Callback URL** | Your URL where HappyRobot POSTs status updates                    |
| **Platform API** | HappyRobot's REST API for querying run status                     |

---

## Recommended Stack

If non technical, use **Lovable**. If technical and thinking of extending later on, **Railway** with the following stack:

| Component     | Recommendation                 | Why                                                      |
| ------------- | ------------------------------ | -------------------------------------------------------- |
| **Hosting**   | [Railway](https://railway.app) | One-click deploy, auto-scaling, easy env management      |
| **Framework** | [Next.js](https://nextjs.org)  | Frontend + `/api` routes = minimal backend for most apps |
| **Database**  | PostgreSQL (on Railway)        | Native Railway integration, reliable, scalable           |
| **Real-time** | Redis SSE (on Railway)         | Server-Sent Events via Redis pub/sub for live updates    |

### Why This Stack?

1. **Simplicity**: Next.js `/api` routes eliminate the need for a separate backend service
2. **All-in-one**: Railway hosts your app, database, and Redis in one place
3. **Cost-effective**: Pay for what you use, no infrastructure management
4. **Fast deployment**: Push to GitHub → auto-deploy to Railway

### Railway Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Add services
railway add --database postgres
railway add --database redis

# Deploy
railway up
```

Your environment variables (including `HAPPYROBOT_*`) are configured in the Railway dashboard.

---

## Integration Pattern Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         THE 3-PHASE PATTERN                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PHASE 1: TRIGGER                                                       │
│  ════════════════                                                       │
│  Your App ──POST──▶ HappyRobot Webhook URL                              │
│                           │                                             │
│                           ▼                                             │
│                     Returns: { queued_run_ids: ["run_xxx"] }            │
│                           │                                             │
│                           ▼                                             │
│             Save run_id to your database or frontend state              │
│                                                                         │
│                                                                         │
│  PHASE 2: POLL (easier to implement  than SSE)                          │
│  ═════════════                                                          │
│  Your App ──GET──▶ HappyRobot Platform API (/runs/{run_id})             │
│      │                    │                                             │
│      │                    ▼                                             │
│      │              Returns: { status: "running" | "completed" | ... }  │
│      │                                                                  │
│      └──── repeat every 3-5 seconds until terminal status ────┘         │
│                                                                         │
│                                                                         │
│  PHASE 3: WEBHOOKS (Optional but recommended)                           │
│  ════════════════════════════════════════════                           │
│  HappyRobot ──POST──▶ Your Callback URL                                 │
│                           │                                             │
│                           ▼                                             │
│       "Real-time" logs & completion events such as summaries            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

```bash
# ═══════════════════════════════════════════════════════════════════════════
# REQUIRED: For triggering workflows
# ═══════════════════════════════════════════════════════════════════════════
# The webhook URL to trigger your HappyRobot workflow
HAPPYROBOT_WEBHOOK_URL="https://hooks.happyrobot.ai/webhook/xxxxx"

# API key defined in the Incoming Hook node. Use as X-API-KEY header.
HAPPYROBOT_X_API_KEY="your_workflow_api_key"


# ═══════════════════════════════════════════════════════════════════════════
# REQUIRED: For polling run status via Platform API
# ═══════════════════════════════════════════════════════════════════════════
# Your personal user API key for the HappyRobot Platform API
HAPPYROBOT_API_KEY="hr_api_xxxxxxxxxxxxx"

# Your organization ID
HAPPYROBOT_ORG_ID="org_xxxxxxxxxxxxx"

# ═══════════════════════════════════════════════════════════════════════════
# OPTIONAL: For linking to runs in HappyRobot dashboard
# ═══════════════════════════════════════════════════════════════════════════
# Your organization slug (for Platform UI URLs)
HAPPYROBOT_ORG_SLUG="your_org_slug"

# Your workflow ID (for Platform UI URLs)
HAPPYROBOT_WORKFLOW_ID="your_workflow_id"

# Your app's public URL (used to construct callback URLs)
APP_URL="https://v2.platform.happyrobot.ai/"
```

---

## Database Requirements

You need ONE table to track HappyRobot runs:

### AgentRun Table

```sql
CREATE TABLE agent_runs (
    id              SERIAL PRIMARY KEY,

    -- HappyRobot's unique run identifier
    run_id          VARCHAR(255) UNIQUE NOT NULL,

    -- YOUR domain's correlation ID (order_id, ticket_id, user_id, etc.)
    -- Name this whatever makes sense for your domain
    context_id      VARCHAR(255) NOT NULL,

    -- Metadata
    name            VARCHAR(255),           -- Display name for UI
    description     TEXT,                   -- What this run is doing

    -- Status tracking
    status          VARCHAR(50) DEFAULT 'PENDING',

    -- Store any logs/results from HappyRobot
    metadata        JSONB DEFAULT '{}',

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_agent_runs_context ON agent_runs(context_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
```

### Status Values

```typescript
type RunStatus =
  | "PENDING" // Created, not yet started
  | "RUNNING" // Currently executing
  | "COMPLETED" // Finished successfully
  | "FAILED" // Execution failed
  | "CANCELED"; // Manually canceled
```

---

## Step 1: Triggering a Workflow

### How It Works

1. You POST a payload to HappyRobot's webhook URL
2. HappyRobot queues the workflow and returns `queued_run_ids`
3. You save the run IDs to your database

### HappyRobot's Expected Response

```typescript
interface HappyRobotTriggerResponse {
  queued_run_ids: string[]; // e.g., ["run_abc123", "run_def456"]
  status?: string; // Usually "queued"
}
```

### Your Payload Structure

HappyRobot accepts any JSON payload. Structure it based on what your workflow needs:

```typescript
interface WorkflowPayload {
  // Include a callback URL so HappyRobot can send you updates
  callback_url: string;

  // Everything else is YOUR custom data for the workflow
  // Examples:
  customer_phone?: string;
  customer_name?: string;
  context?: Record<string, any>;
  // ... whatever your workflow needs
}
```

### Implementation

```typescript
// POST /api/happyrobot/trigger
export async function POST(request: Request) {
  const body = await request.json();

  // 1. Build your payload (customize for your workflow)
  const payload = {
    callback_url: `${process.env.APP_URL}/api/webhooks/happyrobot`,
    ...body, // Pass through whatever context you need
  };

  // 2. Trigger HappyRobot
  const apiKey = process.env.HAPPYROBOT_X_API_KEY;
  const response = await fetch(process.env.HAPPYROBOT_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { "X-API-KEY": apiKey }),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("HappyRobot trigger failed:", error);
    return Response.json(
      { error: "Failed to trigger workflow" },
      { status: 502 },
    );
  }

  // 3. Parse response
  const result = await response.json();
  const runIds = result.queued_run_ids || [];

  // 4. Save to database
  for (const runId of runIds) {
    await db.agentRun.create({
      data: {
        runId: runId,
        contextId: body.context_id, // Your correlation ID
        name: body.name || "HappyRobot Run",
        status: "RUNNING",
        metadata: {},
      },
    });
  }

  // 5. Return success
  return Response.json({
    success: true,
    run_ids: runIds,
  });
}
```

---

## Step 2: Polling for Status

### HappyRobot Platform API

```
Base URL: https://platform.happyrobot.ai/api/v1
Endpoint: GET /runs/{run_id}

Headers:
  x-api-key = {HAPPYROBOT_API_KEY}
```

### HappyRobot Status Values

```typescript
type HappyRobotStatus =
  | "pending" // Queued, not started
  | "running" // In progress
  | "completed" // Success
  | "failed" // Error
  | "canceled"; // Manually stopped
```

### Implementation

```typescript
// GET /api/happyrobot/status?run_id=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("run_id");

  if (!runId) {
    return Response.json({ error: "run_id required" }, { status: 400 });
  }

  // 1. Get from your database
  const agentRun = await db.agentRun.findUnique({
    where: { runId },
  });

  if (!agentRun) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  // 2. Query HappyRobot Platform API
  let happyRobotStatus = null;

  try {
    const response = await fetch(
      `https://platform.happyrobot.ai/api/v1/runs/${runId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HAPPYROBOT_API_KEY}`,
          "X-Organization-Id": process.env.HAPPYROBOT_ORG_ID!,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      happyRobotStatus = data.status;

      // 3. Map HappyRobot status to your status
      const statusMap: Record<string, string> = {
        pending: "PENDING",
        running: "RUNNING",
        completed: "COMPLETED",
        failed: "FAILED",
        canceled: "CANCELED",
      };

      const newStatus = statusMap[happyRobotStatus] || agentRun.status;

      // 4. Update database if status changed
      if (newStatus !== agentRun.status) {
        await db.agentRun.update({
          where: { runId },
          data: { status: newStatus },
        });
      }
    }
  } catch (error) {
    console.error("Failed to query HappyRobot API:", error);
    // Continue with database status as fallback
  }

  // 5. Return status
  return Response.json({
    run_id: runId,
    status: happyRobotStatus || agentRun.status.toLowerCase(),
    name: agentRun.name,
    created_at: agentRun.createdAt,
    updated_at: agentRun.updatedAt,
  });
}
```

---

## Step 3: Receiving Webhooks

HappyRobot can POST to your callback URL during and after execution.

### Configure in HappyRobot

When triggering, include `callback_url` in your payload. HappyRobot will POST updates there.

### Expected Webhook Payloads

HappyRobot may send different event types. Handle them based on your workflow:

```typescript
// Generic webhook payload structure
interface HappyRobotWebhook {
  run_id: string;
  event_type: string; // "log", "completed", "failed", etc.
  timestamp: string;
  data?: Record<string, any>;
}
```

### Implementation

```typescript
// POST /api/webhooks/happyrobot
export async function POST(request: Request) {
  // 1. Validate webhook using X-API-KEY (optional but recommended)
  const apiKey = request.headers.get("X-API-KEY");
  const expectedKey = process.env.HAPPYROBOT_X_API_KEY;

  if (expectedKey && apiKey !== expectedKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  const payload = await request.json();
  const { run_id, event_type, data } = payload;

  if (!run_id) {
    return Response.json({ error: "run_id required" }, { status: 400 });
  }

  // 3. Find the run
  const agentRun = await db.agentRun.findUnique({
    where: { runId: run_id },
  });

  if (!agentRun) {
    console.warn(`Received webhook for unknown run: ${run_id}`);
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  // 4. Handle different event types
  switch (event_type) {
    case "log":
      // Append log to metadata
      await db.agentRun.update({
        where: { runId: run_id },
        data: {
          metadata: {
            ...agentRun.metadata,
            logs: [...(agentRun.metadata.logs || []), data],
          },
        },
      });
      break;

    case "completed":
      await db.agentRun.update({
        where: { runId: run_id },
        data: {
          status: "COMPLETED",
          metadata: { ...agentRun.metadata, result: data },
        },
      });
      break;

    case "failed":
      await db.agentRun.update({
        where: { runId: run_id },
        data: {
          status: "FAILED",
          metadata: { ...agentRun.metadata, error: data },
        },
      });
      break;

    default:
      console.log(`Unknown event type: ${event_type}`);
  }

  // 5. Broadcast to connected clients (YOUR real-time implementation)
  await broadcastUpdate(agentRun.contextId, {
    run_id,
    event_type,
    data,
  });

  return Response.json({ success: true });
}
```

---

## Frontend Polling Hook

A generic React hook for polling HappyRobot run status:

```typescript
import { useState, useEffect, useRef, useCallback } from "react";

interface Run {
  id: string;
  runId: string;
  contextId: string;
  name: string;
  status: string;
  createdAt: string;
}

interface UseHappyRobotOptions {
  contextId?: string; // Filter by your domain's ID
  pollWhenRunning?: boolean; // Enable polling (default: true)
  pollInterval?: number; // Milliseconds (default: 5000)
}

export function useHappyRobot(options: UseHappyRobotOptions = {}) {
  const { contextId, pollWhenRunning = true, pollInterval = 5000 } = options;

  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch runs from your API
  const fetchRuns = useCallback(async () => {
    const url = contextId
      ? `/api/happyrobot/runs?context_id=${contextId}`
      : "/api/happyrobot/runs";

    const response = await fetch(url);
    const data = await response.json();
    setRuns(data);
    setIsLoading(false);
  }, [contextId]);

  // Check status for a single run
  const checkStatus = useCallback(
    async (run: Run) => {
      if (run.status !== "RUNNING" && run.status !== "PENDING") {
        return;
      }

      try {
        const response = await fetch(
          `/api/happyrobot/status?run_id=${run.runId}`,
        );
        const data = await response.json();

        // If terminal status, refresh all runs
        if (["completed", "failed", "canceled"].includes(data.status)) {
          await fetchRuns();
        }
      } catch (error) {
        console.error("Status check failed:", error);
      }
    },
    [fetchRuns],
  );

  // Poll all running runs
  const pollRunning = useCallback(() => {
    const activeRuns = runs.filter(
      (r) => r.status === "RUNNING" || r.status === "PENDING",
    );
    activeRuns.forEach(checkStatus);
  }, [runs, checkStatus]);

  // Initial fetch
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Set up polling
  useEffect(() => {
    if (!pollWhenRunning) return;

    const activeRuns = runs.filter(
      (r) => r.status === "RUNNING" || r.status === "PENDING",
    );

    if (activeRuns.length > 0) {
      // Poll immediately
      pollRunning();

      // Then on interval
      pollingRef.current = setInterval(pollRunning, pollInterval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollWhenRunning, pollInterval, runs.length, pollRunning]);

  // Trigger a new run
  const trigger = async (payload: Record<string, any>) => {
    const response = await fetch("/api/happyrobot/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Refresh runs list
    await fetchRuns();

    return result;
  };

  // Computed stats
  const stats = {
    total: runs.length,
    pending: runs.filter((r) => r.status === "PENDING").length,
    running: runs.filter((r) => r.status === "RUNNING").length,
    completed: runs.filter((r) => r.status === "COMPLETED").length,
    failed: runs.filter((r) => r.status === "FAILED").length,
  };

  return {
    runs,
    isLoading,
    stats,
    trigger,
    refetch: fetchRuns,
    isPolling: pollingRef.current !== null,
  };
}
```

### Usage

```tsx
function MyComponent() {
  const { runs, stats, trigger, isLoading } = useHappyRobot({
    contextId: "order_123", // Your domain's ID
    pollWhenRunning: true,
    pollInterval: 3000,
  });

  const handleStart = async () => {
    await trigger({
      context_id: "order_123",
      customer_phone: "+1234567890",
      // ... your workflow data
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleStart}>Start AI Agent</button>

      <div>
        Running: {stats.running} | Completed: {stats.completed}
      </div>

      {runs.map((run) => (
        <div key={run.id}>
          {run.name}: {run.status}
        </div>
      ))}
    </div>
  );
}
```

---

## Real-time Updates (Choose Your Stack)

Polling works, but for instant updates you need real-time communication. Here are your options:

### Option A: WebSockets (Native)

```typescript
// Server: Create WebSocket server
const clients = new Map<WebSocket, string>(); // ws -> contextId

wss.on("connection", (ws, req) => {
  const contextId = new URL(req.url!, "http://localhost").searchParams.get(
    "context_id",
  );
  clients.set(ws, contextId!);
  ws.on("close", () => clients.delete(ws));
});

// Broadcast function
function broadcast(contextId: string, data: any) {
  clients.forEach((id, ws) => {
    if (id === contextId) {
      ws.send(JSON.stringify(data));
    }
  });
}
```

### Option B: Server-Sent Events (SSE)

```typescript
// GET /api/events?context_id=xxx
export async function GET(request: Request) {
  const contextId = new URL(request.url).searchParams.get("context_id");

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Subscribe to updates for this context
      const unsubscribe = subscribe(contextId!, send);

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### Option C: Third-Party Services

| Service               | Pros                 | Cons                 |
| --------------------- | -------------------- | -------------------- |
| **Pusher**            | Easy setup, reliable | Paid after free tier |
| **Ably**              | Global, scalable     | Paid                 |
| **Socket.io**         | Popular, fallbacks   | Self-hosted          |
| **Supabase Realtime** | DB-integrated        | Supabase lock-in     |
| **Firebase**          | Google-backed        | Firebase lock-in     |

### Broadcast from Webhook Handler

```typescript
// In your webhook handler, after processing:
async function broadcastUpdate(contextId: string, data: any) {
  // Choose ONE based on your stack:

  // WebSocket
  wsServer.broadcast(contextId, data);

  // SSE
  sseEmitter.emit(contextId, data);

  // Pusher
  await pusher.trigger(`context-${contextId}`, "update", data);

  // Ably
  await ably.channels.get(contextId).publish("update", data);
}
```

---

## Error Handling & Best Practices

### 1. Platform UI Links

Generate links to view runs in the HappyRobot dashboard:

```typescript
// Helper to generate run URLs for the HappyRobot Platform UI
function getRunUrl(runId: string): string {
  const org = process.env.HAPPYROBOT_ORG_SLUG;
  const workflowId = process.env.HAPPYROBOT_WORKFLOW_ID;
  return `https://v2.platform.happyrobot.ai/${org}/workflow/${workflowId}/runs?run_id=${runId}`;
}

// Usage in your UI
<a href={getRunUrl(agent.runId)} target="_blank">View in HappyRobot</a>
```

### 2. Retry Failed Triggers

```typescript
async function triggerWithRetry(
  payload: any,
  maxRetries = 3,
): Promise<Response> {
  const apiKey = process.env.HAPPYROBOT_X_API_KEY;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(process.env.HAPPYROBOT_WEBHOOK_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "X-API-KEY": apiKey }),
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return response;

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

### 3. Graceful Polling Fallback

```typescript
async function getRunStatus(runId: string) {
  // Try HappyRobot API first
  try {
    const response = await fetch(`${HAPPYROBOT_API}/runs/${runId}`, {
      headers: {
        /* ... */
      },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn("HappyRobot API unavailable, using database");
  }

  // Fallback to database
  const run = await db.agentRun.findUnique({ where: { runId } });
  return { status: run?.status.toLowerCase() || "unknown" };
}
```

### 4. Webhook Idempotency

```typescript
// Prevent duplicate processing
const processedWebhooks = new Set<string>();

export async function POST(request: Request) {
  const webhookId = request.headers.get("X-Webhook-Id");

  if (webhookId && processedWebhooks.has(webhookId)) {
    return Response.json({ success: true, duplicate: true });
  }

  // Process webhook...

  if (webhookId) {
    processedWebhooks.add(webhookId);
    // Clean up old entries periodically
  }
}
```

### 5. Timeout Handling

```typescript
// Mark stale runs as failed
async function cleanupStaleRuns() {
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

  await db.agentRun.updateMany({
    where: {
      status: "RUNNING",
      updatedAt: { lt: staleThreshold },
    },
    data: {
      status: "FAILED",
      metadata: { error: "Timed out" },
    },
  });
}

// Run periodically
setInterval(cleanupStaleRuns, 5 * 60 * 1000); // Every 5 minutes
```

---

## Implementation Checklist

### Backend

- [ ] Set environment variables
- [ ] Create `agent_runs` database table
- [ ] Implement `POST /api/happyrobot/trigger`
- [ ] Implement `GET /api/happyrobot/status`
- [ ] Implement `GET /api/happyrobot/runs` (list runs)
- [ ] Implement `POST /api/webhooks/happyrobot`
- [ ] Add error handling and retries
- [ ] Set up real-time broadcast (optional)

### Frontend

- [ ] Create polling hook (`useHappyRobot`)
- [ ] Build trigger UI
- [ ] Build status display
- [ ] Connect to real-time updates (optional)
- [ ] Handle loading/error states

### HappyRobot Dashboard

- [ ] Create your workflow
- [ ] Configure webhook URL
- [ ] Get API key and org ID
- [ ] Test with sample payload

### Testing

- [ ] Test trigger → poll → complete flow
- [ ] Test webhook delivery
- [ ] Test error scenarios (timeout, failure)
- [ ] Test concurrent runs

---

## Quick Reference

### API Endpoints Summary

| Your Endpoint              | Method | Purpose           |
| -------------------------- | ------ | ----------------- |
| `/api/happyrobot/trigger`  | POST   | Start a workflow  |
| `/api/happyrobot/status`   | GET    | Poll run status   |
| `/api/happyrobot/runs`     | GET    | List all runs     |
| `/api/webhooks/happyrobot` | POST   | Receive callbacks |

### HappyRobot APIs

| API             | URL                                                                               | Auth                                             |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Trigger Webhook | `{HAPPYROBOT_WEBHOOK_URL}`                                                        | X-API-KEY header (optional, defined in workflow) |
| Platform API    | `https://platform.happyrobot.ai/api/v1/runs/{id}`                                 | Bearer token + x-organization-id header          |
| Platform UI     | `https://v2.platform.happyrobot.ai/{org}/workflow/{workflow_id}/runs?run_id={id}` | N/A (browser)                                    |

### Status Flow

```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELED
```

---

## Summary

The HappyRobot integration is simple:

1. **Trigger**: POST your payload, get run IDs back
2. **Poll**: Query status every few seconds until terminal
3. **Webhooks**: Receive real-time updates (optional but recommended)

That's it. Everything else is just your domain logic built on top of these three primitives.

---

_Last updated: January 2025_
