import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { CallStatus, ContactStatus, Prisma } from "@prisma/client";

function normalizeStatus(status: unknown): CallStatus | null {
  if (typeof status !== "string") return null;
  const s = status.toLowerCase();
  if (s === "pending") return CallStatus.PENDING;
  if (s === "running") return CallStatus.RUNNING;
  if (s === "completed" || s === "success") return CallStatus.COMPLETED;
  if (s === "failed" || s === "error") return CallStatus.FAILED;
  if (s === "canceled" || s === "cancelled") return CallStatus.CANCELED;
  return null;
}

function normalizeContactStatus(status: unknown): ContactStatus | null {
  if (typeof status !== "string") return null;
  const s = status.trim().toLowerCase();
  if (s === "pending") return ContactStatus.PENDING;
  if (s === "completed" || s === "success") return ContactStatus.COMPLETED;
  if (s === "voicemail") return ContactStatus.VOICEMAIL;
  if (s === "no_answer" || s === "no answer") return ContactStatus.NO_ANSWER;
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(s)) return true;
    if (["false", "no", "n", "0"].includes(s)) return false;
  }
  return null;
}

/**
 * HappyRobot callback endpoint.
 *
 * Configure your workflow to POST here when it has a final summary / contract draft.
 * Correlation:
 * - Prefer sending `context.source.rider_call_id` (we set this when triggering).
 * - Optionally include `run_id` as well.
 *
 * Optional security:
 * - Set env HAPPYROBOT_CALLBACK_SECRET and send header `x-happyrobot-callback-secret`.
 */
export async function POST(req: NextRequest) {
  try {
    const requiredSecret = process.env.HAPPYROBOT_CALLBACK_SECRET;
    if (requiredSecret) {
      const provided =
        req.headers.get("x-happyrobot-callback-secret") ||
        req.headers.get("x-callback-secret");
      if (provided !== requiredSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const anyBody = body as any;
    console.log("[HappyRobot Callback] received payload keys:", Object.keys(anyBody || {}));

    const riderCallId =
      asString(anyBody?.context?.source?.rider_call_id) ||
      asString(anyBody?.context?.source?.call_id) || // legacy
      asString(anyBody?.call_id) ||
      asString(anyBody?.callId) ||
      asString(anyBody?.metadata?.callId);

    const runId =
      asString(anyBody?.run_id) || asString(anyBody?.runId) || asString(anyBody?.id);

    if (!riderCallId && !runId) {
      return NextResponse.json(
        {
          error: "Missing correlation id",
          hint: "Send context.source.rider_call_id (recommended) or run_id.",
        },
        { status: 400 },
      );
    }

    const status = normalizeStatus(anyBody?.status);
    const contactStatus =
      normalizeContactStatus(anyBody?.contact_status) ||
      normalizeContactStatus(anyBody?.call_status) ||
      normalizeContactStatus(anyBody?.result?.call_status) ||
      normalizeContactStatus(anyBody?.result?.contact_status);

    // Flexible extraction for your workflow outputs
    const summary =
      asString(anyBody?.result?.summary) ||
      asString(anyBody?.summary) ||
      asString(anyBody?.outputs?.summary) ||
      asString(anyBody?.extracted?.summary);

    const transcript =
      asString(anyBody?.result?.transcript) ||
      asString(anyBody?.transcript) ||
      asString(anyBody?.outputs?.transcript) ||
      asString(anyBody?.extracted?.transcript);

    const urgentFlag =
      asBoolean(anyBody?.urgent_flag) ??
      asBoolean(anyBody?.urgent) ??
      asBoolean(anyBody?.result?.urgent_flag) ??
      asBoolean(anyBody?.result?.urgent);

    const legalIssueFlag =
      asBoolean(anyBody?.legal_issue_flag) ??
      asBoolean(anyBody?.legal_issue) ??
      asBoolean(anyBody?.result?.legal_issue_flag) ??
      asBoolean(anyBody?.result?.legal_issue);

    const humanRequested =
      asBoolean(anyBody?.human_requested) ??
      asBoolean(anyBody?.humanRequested) ??
      asBoolean(anyBody?.result?.human_requested) ??
      asBoolean(anyBody?.result?.humanRequested);

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const where = riderCallId ? { id: riderCallId } : { runId: runId! };
      const existing = await tx.riderCall.findUnique({ where });
      if (!existing) return null;

      const existingMetadata =
        (existing.metadata as Record<string, unknown> | null) || {};

      const mergedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        workflowResult: {
          ...(typeof (existingMetadata as any).workflowResult === "object"
            ? (existingMetadata as any).workflowResult
            : {}),
          ...(summary ? { summary } : {}),
          ...(transcript ? { transcript } : {}),
          ...(contactStatus ? { contactStatus } : {}),
          ...(urgentFlag !== null ? { urgentFlag } : {}),
          ...(legalIssueFlag !== null ? { legalIssueFlag } : {}),
          ...(humanRequested !== null ? { humanRequested } : {}),
          lastCallbackAt: now.toISOString(),
        },
        happyrobotCallback: {
          receivedAt: now.toISOString(),
          runId: runId || existing.runId,
        },
      };

      const terminalStatus =
        status === CallStatus.COMPLETED ||
        status === CallStatus.FAILED ||
        status === CallStatus.CANCELED;

      const updatedCall = await tx.riderCall.update({
        where,
        data: {
          ...(runId && !existing.runId ? { runId } : {}),
          ...(status ? { status } : {}),
          ...(terminalStatus ? { completedAt: now } : {}),
          ...(contactStatus ? { contactStatus } : {}),
          contactedAt: now,
          ...(summary ? { summary } : {}),
          ...(transcript ? { transcript } : {}),
          ...(urgentFlag !== null ? { urgentFlag } : {}),
          ...(legalIssueFlag !== null ? { legalIssueFlag } : {}),
          ...(humanRequested !== null ? { humanRequested } : {}),
          metadata: mergedMetadata as unknown as Prisma.InputJsonValue,
        },
      });

      // Also update rider derived fields for fast filtering
      await tx.rider.update({
        where: { id: updatedCall.riderId },
        data: {
          lastContactAt: now,
          ...(contactStatus ? { lastContactStatus: contactStatus } : {}),
          ...(urgentFlag !== null ? { urgentFlag } : {}),
          ...(legalIssueFlag !== null ? { legalIssueFlag } : {}),
          ...(humanRequested !== null ? { humanRequested } : {}),
        },
      });

      return updatedCall;
    });

    if (!updated) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    console.log("[HappyRobot Callback] updated call:", { id: updated.id, status: updated.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("HappyRobot callback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

