import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

function parseYesNo(v: string | undefined | null): boolean {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

function parseDate(v: string | undefined | null): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Minimal CSV parser that supports quoted fields containing commas/newlines.
function parseCsv(content: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];

    if (inQuotes) {
      if (c === '"') {
        const next = content[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    if (c === "\r") continue;
    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

async function importFromCsv(csvText: string, initiatedByUserId?: string | null) {
  const records = parseCsv(csvText);

  let ridersUpserted = 0;
  let callsCreated = 0;
  let callsUpdated = 0;
  let skipped = 0;

  for (const r of records) {
    const externalId = r["Id"] ? Number(r["Id"]) : null;
    const phoneNumber = r["Phone Number"] || "";
    const driverName = r["Driver Name"] || "";

    if (!externalId || !phoneNumber || !driverName) {
      skipped++;
      continue;
    }

    const signUpDate = parseDate(r["Sign-up Date"]);
    const lastContactAt = parseDate(r["Last Contact Date"]);

    const docs = (r["Documents Uploaded"] || "").trim().toLowerCase();
    const documentsUploaded =
      docs === "yes"
        ? "YES"
        : docs === "partial"
          ? "PARTIAL"
          : docs === "no"
            ? "NO"
            : null;

    const callStatusRaw = (r["Call Status"] || "").trim().toLowerCase();
    const contactStatus =
      callStatusRaw === "completed"
        ? "COMPLETED"
        : callStatusRaw === "voicemail"
          ? "VOICEMAIL"
          : callStatusRaw === "no answer" || callStatusRaw === "no_answer"
            ? "NO_ANSWER"
            : callStatusRaw === "pending"
              ? "PENDING"
              : null;

    const urgentFlag = parseYesNo(r["Urgent Flag"]);
    const legalIssueFlag = parseYesNo(r["Legal Issue Flag"]);
    const humanRequested = parseYesNo(r["Human Requested"]);

    const rider = await prisma.rider.upsert({
      where: { externalId },
      update: {
        phoneNumber,
        driverName,
        signUpDate,
        flowType: r["Flow Type"] || null,
        documentsUploaded: documentsUploaded as any,
        licenseCountry: r["License Country"] || null,
        residentPermitStatus: r["Resident Permit Status"] || null,
        lastContactAt,
        lastContactStatus: contactStatus as any,
        urgentFlag,
        legalIssueFlag,
        humanRequested,
      },
      create: {
        externalId,
        phoneNumber,
        driverName,
        signUpDate,
        flowType: r["Flow Type"] || null,
        documentsUploaded: documentsUploaded as any,
        licenseCountry: r["License Country"] || null,
        residentPermitStatus: r["Resident Permit Status"] || null,
        lastContactAt,
        lastContactStatus: contactStatus as any,
        urgentFlag,
        legalIssueFlag,
        humanRequested,
      },
    });
    ridersUpserted++;

    const existingCall = await prisma.riderCall.findFirst({
      where: {
        riderId: rider.id,
        contactedAt: lastContactAt,
        ...(contactStatus ? { contactStatus: contactStatus as any } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const runStatus =
      contactStatus && contactStatus !== "PENDING" ? "COMPLETED" : "PENDING";

    const callData = {
      status: runStatus as any,
      contactStatus: contactStatus as any,
      contactedAt: lastContactAt,
      transcript: r["Transcript"] || null,
      summary: r["Summary"] || null,
      urgentFlag,
      legalIssueFlag,
      humanRequested,
      metadata: {
        source: "csv_import",
        externalId,
      } as any,
    };

    if (existingCall) {
      await prisma.riderCall.update({
        where: { id: existingCall.id },
        data: callData,
      });
      callsUpdated++;
    } else {
      await prisma.riderCall.create({
        data: {
          riderId: rider.id,
          initiatedByUserId: initiatedByUserId || null,
          ...callData,
        },
      });
      callsCreated++;
    }
  }

  return { ridersUpserted, callsCreated, callsUpdated, skipped };
}

/**
 * Import rider onboarding CSV.
 *
 * Auth options:
 * - If env `IMPORT_API_KEY` is set: send header `x-import-api-key: <key>`
 * - Otherwise: must be logged in (NextAuth session)
 *
 * Usage (multipart):
 * - POST multipart/form-data with field `file` containing the CSV.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.IMPORT_API_KEY;
  const providedKey = req.headers.get("x-import-api-key");

  if (apiKey) {
    if (!providedKey || providedKey !== apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let csvText: string | null = null;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file && typeof file !== "string" && "text" in file) {
      csvText = await (file as Blob).text();
    } else if (typeof file === "string" && file.trim()) {
      csvText = file;
    }
  } else if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as any;
    if (body?.csv && typeof body.csv === "string") csvText = body.csv;
  } else {
    // plain text
    const txt = await req.text().catch(() => "");
    if (txt.trim()) csvText = txt;
  }

  if (!csvText) {
    return NextResponse.json(
      { error: "Missing CSV. Send multipart field `file` or JSON { csv }." },
      { status: 400 },
    );
  }

  const res = await importFromCsv(csvText, null);
  return NextResponse.json({ ok: true, ...res });
}

