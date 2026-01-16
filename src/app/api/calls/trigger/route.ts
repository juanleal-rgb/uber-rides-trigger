import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const triggerSchema = z.object({
  externalId: z.number().int().positive().optional(),
  driverName: z.string().min(1),
  phoneNumber: z
    .string()
    .min(1)
    .regex(/^\+\d/, "phoneNumber must be in E.164 format (e.g. +34612345678)"),
  signUpDate: z.string().optional(),
  flowType: z.string().optional(),
  documentsUploaded: z.enum(["NO", "PARTIAL", "YES"]).optional(),
  licenseCountry: z.string().optional(),
  residentPermitStatus: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = triggerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.errors },
        { status: 400 },
      );
    }

    const data = result.data;

    // Get userId from session
    const userId = session.user?.id as string | undefined;

    // Require HappyRobot endpoint
    const endpoint =
      process.env.HAPPYROBOT_ENDPOINT || process.env.HAPPYROBOT_WEBHOOK_URL;
    if (!endpoint || endpoint.trim() === "") {
      return NextResponse.json(
        {
          error: "HappyRobot endpoint not configured",
          hint: "Set HAPPYROBOT_ENDPOINT (or HAPPYROBOT_WEBHOOK_URL) in your environment variables.",
        },
        { status: 500 },
      );
    }
    const apiKey = process.env.HAPPYROBOT_X_API_KEY;
    const appUrl = process.env.APP_URL;

    const signUpDate = data.signUpDate ? new Date(data.signUpDate) : null;
    if (data.signUpDate && Number.isNaN(signUpDate?.getTime())) {
      return NextResponse.json(
        { error: "Invalid signUpDate. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }

    const rider = data.externalId
      ? await prisma.rider.upsert({
          where: { externalId: data.externalId },
          update: {
            phoneNumber: data.phoneNumber.trim(),
            driverName: data.driverName.trim(),
            signUpDate,
            flowType: data.flowType?.trim() || null,
            documentsUploaded: (data.documentsUploaded as any) || null,
            licenseCountry: data.licenseCountry?.trim() || null,
            residentPermitStatus: data.residentPermitStatus?.trim() || null,
          },
          create: {
            externalId: data.externalId,
            phoneNumber: data.phoneNumber.trim(),
            driverName: data.driverName.trim(),
            signUpDate,
            flowType: data.flowType?.trim() || null,
            documentsUploaded: (data.documentsUploaded as any) || null,
            licenseCountry: data.licenseCountry?.trim() || null,
            residentPermitStatus: data.residentPermitStatus?.trim() || null,
          },
        })
      : await prisma.rider.create({
          data: {
            phoneNumber: data.phoneNumber.trim(),
            driverName: data.driverName.trim(),
            signUpDate,
            flowType: data.flowType?.trim() || null,
            documentsUploaded: (data.documentsUploaded as any) || null,
            licenseCountry: data.licenseCountry?.trim() || null,
            residentPermitStatus: data.residentPermitStatus?.trim() || null,
          },
        });

    const riderCall = await prisma.riderCall.create({
      data: {
        riderId: rider.id,
        initiatedByUserId: userId || null,
        status: "PENDING",
        metadata: {
          source: { app: "uber-rider-onboarding", initiated_by_user_id: userId },
          riderSnapshot: {
            externalId: rider.externalId,
            driverName: rider.driverName,
            phoneNumber: rider.phoneNumber,
            signUpDate: rider.signUpDate?.toISOString() || null,
            flowType: rider.flowType,
            documentsUploaded: rider.documentsUploaded,
            licenseCountry: rider.licenseCountry,
            residentPermitStatus: rider.residentPermitStatus,
          },
        },
      },
      include: {
        rider: true,
        initiatedByUser: { select: { id: true, email: true, name: true } },
      },
    });

    // Call HappyRobot webhook
    try {
      const workflowContext = {
        rider: {
          id: rider.id,
          external_id: rider.externalId,
          driver_name: rider.driverName,
          phone_number: rider.phoneNumber,
          sign_up_date: rider.signUpDate?.toISOString() || null,
          flow_type: rider.flowType,
          documents_uploaded: rider.documentsUploaded,
          license_country: rider.licenseCountry,
          resident_permit_status: rider.residentPermitStatus,
        },
        source: {
          app: "uber-rider-onboarding",
          rider_call_id: riderCall.id,
          rider_id: rider.id,
          initiated_by_user_id: userId,
        },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-KEY": apiKey } : {}),
        },
        body: JSON.stringify({
          phone_number: data.phoneNumber.trim(),
          ...(appUrl ? { callback_url: `${appUrl.replace(/\/$/, "")}/api/calls/callback` } : {}),
          context: workflowContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await prisma.riderCall.update({
          where: { id: riderCall.id },
          data: {
            status: "FAILED",
            errorMsg: "HappyRobot API error: " + errorText,
          },
        });
        return NextResponse.json(
          { error: "Failed to trigger call", details: errorText },
          { status: 500 },
        );
      }

      const result = await response.json();
      console.log(
        "[Trigger] HappyRobot response:",
        JSON.stringify(result, null, 2),
      );

      // HappyRobot returns queued_run_ids array
      const runId = result.queued_run_ids?.[0] || result.run_id || result.id;
      console.log("[Trigger] Extracted runId:", runId);

      // Update call with run ID
      const updated = await prisma.riderCall.update({
        where: { id: riderCall.id },
        data: {
          runId: runId,
          status: "RUNNING",
        },
        include: {
          rider: true,
          initiatedByUser: { select: { id: true, email: true, name: true } },
        },
      });

      return NextResponse.json({ call: updated });
    } catch (error) {
      await prisma.riderCall.update({
        where: { id: riderCall.id },
        data: {
          status: "FAILED",
          errorMsg: "Failed to connect to HappyRobot API: " + String(error),
        },
      });
      return NextResponse.json(
        { error: "Failed to trigger call" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
