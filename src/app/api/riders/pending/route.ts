import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { ContactStatus } from "@prisma/client";

/**
 * List riders that are pending onboarding contact.
 *
 * Definition:
 * - rider.lastContactStatus is NULL or PENDING
 *
 * Optional query params:
 * - search: matches driverName or phoneNumber
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search") || "";

  const where: any = {
    OR: [
      { lastContactStatus: null },
      { lastContactStatus: ContactStatus.PENDING },
    ],
  };

  if (search.trim()) {
    where.AND = [
      {
        OR: [
          { driverName: { contains: search.trim(), mode: "insensitive" } },
          { phoneNumber: { contains: search.trim() } },
        ],
      },
    ];
  }

  const riders = await prisma.rider.findMany({
    where,
    orderBy: [{ urgentFlag: "desc" }, { updatedAt: "desc" }],
    take: 50,
    include: {
      calls: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          runId: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json(
    riders.map((r) => ({
      ...r,
      latestCall: r.calls[0] || null,
      calls: undefined,
    })),
  );
}

