import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { CallStatus } from "@prisma/client";

const HAPPYROBOT_PLATFORM_API = "https://platform.happyrobot.ai/api/v1";

// Map HappyRobot status to our status
const statusMap: Record<string, CallStatus> = {
  pending: CallStatus.PENDING,
  running: CallStatus.RUNNING,
  completed: CallStatus.COMPLETED,
  failed: CallStatus.FAILED,
  canceled: CallStatus.CANCELED,
};

// Poll HappyRobot Platform API for a single run
async function pollRunStatus(runId: string): Promise<CallStatus | null> {
  const pollingSecret = process.env.HAPPYROBOT_POLLING_SECRET;
  const orgId = process.env.HAPPYROBOT_ORG_ID;

  console.log(`[HappyRobot Poll] Checking run: ${runId}`);
  console.log(
    `[HappyRobot Poll] Polling Secret configured: ${!!pollingSecret}, Org ID configured: ${!!orgId}`,
  );

  // Skip polling if not configured
  if (!pollingSecret || !orgId) {
    console.log(`[HappyRobot Poll] SKIPPING - missing credentials`);
    return null;
  }

  try {
    const url = `${HAPPYROBOT_PLATFORM_API}/runs/${runId}`;
    console.log(`[HappyRobot Poll] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pollingSecret}`,
        "X-Organization-Id": orgId,
      },
    });

    console.log(`[HappyRobot Poll] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[HappyRobot Poll] FAILED for ${runId}: ${response.status} - ${errorText}`,
      );
      return null;
    }

    const data = await response.json();
    console.log(
      `[HappyRobot Poll] SUCCESS - Status from HappyRobot: ${data.status}`,
    );
    return statusMap[data.status] || null;
  } catch (error) {
    console.error(`[HappyRobot Poll] ERROR for ${runId}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pollingSecret = process.env.HAPPYROBOT_POLLING_SECRET;
    const orgId = process.env.HAPPYROBOT_ORG_ID;
    const canPollHappyRobot = Boolean(pollingSecret && orgId);

    // Get recent rider calls (include completed) so the UI can show history + summaries.
    const calls = await prisma.riderCall.findMany({
      include: {
        rider: true,
        initiatedByUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // If polling credentials aren't configured, just return DB state (callbacks can still mark calls completed).
    if (!canPollHappyRobot) {
      return NextResponse.json(calls);
    }

    // Poll HappyRobot for RUNNING calls with runId
    console.log(
      `[Status API] Found ${calls.length} calls, checking for RUNNING...`,
    );

    const updatedCalls = await Promise.all(
      calls.map(async (call) => {
        console.log(
          `[Status API] Call ${call.id}: status=${call.status}, runId=${call.runId}`,
        );

        // Only poll if RUNNING and has a runId
        if (call.status === "RUNNING" && call.runId) {
          console.log(`[Status API] -> Polling HappyRobot for this call...`);
          const newStatus = await pollRunStatus(call.runId);

          if (newStatus && newStatus !== call.status) {
            // Update database
            const updated = await prisma.riderCall.update({
              where: { id: call.id },
              data: {
                status: newStatus,
                completedAt:
                  newStatus === CallStatus.COMPLETED ||
                  newStatus === CallStatus.FAILED ||
                  newStatus === CallStatus.CANCELED
                    ? new Date()
                    : null,
              },
              include: {
                rider: true,
                initiatedByUser: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            });
            console.log(`[Status API] Updated call ${call.id} to ${newStatus}`);
            return updated;
          }
        }
        return call;
      }),
    );

    return NextResponse.json(updatedCalls);
  } catch (error) {
    console.error("Status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
