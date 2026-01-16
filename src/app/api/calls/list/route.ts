import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { CallStatus, ContactStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const contactStatus = searchParams.get("contactStatus") || "";

    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { rider: { driverName: { contains: search, mode: "insensitive" } } },
        { rider: { phoneNumber: { contains: search } } },
        { runId: { contains: search } },
      ];
    }

    if (status && Object.values(CallStatus).includes(status as CallStatus)) {
      where.status = status as CallStatus;
    }

    if (
      contactStatus &&
      Object.values(ContactStatus).includes(contactStatus as ContactStatus)
    ) {
      where.contactStatus = contactStatus as ContactStatus;
    }

    const [calls, total] = await Promise.all([
      prisma.riderCall.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          rider: true,
        },
      }),
      prisma.riderCall.count({ where }),
    ]);

    return NextResponse.json({
      calls,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("List error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
