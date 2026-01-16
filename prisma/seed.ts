import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function parseYesNo(v: string | undefined | null): boolean {
  const s = (v || "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

function parseDate(v: string | undefined | null): Date | null {
  const s = (v || "").trim();
  if (!s) return null;
  // CSV uses YYYY-MM-DD
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
      // ignore empty last line
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    if (c === "\r") continue;
    field += c;
  }

  // flush last row
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

async function main() {
  console.log("Seeding database...");

  // Create demo user
  const passwordHash = await hash("UNIRxHR2026!", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@unir.net" },
    update: { passwordHash },
    create: {
      email: "demo@unir.net",
      name: "Demo User",
      passwordHash,
      role: "admin",
    },
  });

  console.log("Created demo user:", demoUser.email);

  // Import demo rider onboarding leads from the CSV in the repo root (if present)
  const csvPath = path.join(
    process.cwd(),
    "Testing Uber Onboarding - HappyRobot - Sheet1.csv",
  );

  if (!fs.existsSync(csvPath)) {
    console.log("CSV not found, skipping rider seed:", csvPath);
    console.log("Seeding completed!");
    return;
  }

  const csv = fs.readFileSync(csvPath, "utf8");
  const records = parseCsv(csv);

  console.log(`Importing riders from CSV: ${records.length} rows`);

  for (const r of records) {
    const externalId = r["Id"] ? Number(r["Id"]) : null;
    const phoneNumber = r["Phone Number"] || "";
    const driverName = r["Driver Name"] || "";

    if (!externalId || !phoneNumber || !driverName) continue;

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

    // Avoid duplicating calls on re-seed: attempt to find an existing call for same rider+contact timestamp
    const existingCall = await prisma.riderCall.findFirst({
      where: {
        riderId: rider.id,
        contactedAt: lastContactAt,
        contactStatus: (contactStatus as any) || undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    const runStatus =
      contactStatus && contactStatus !== "PENDING" ? "COMPLETED" : "PENDING";

    if (existingCall) {
      await prisma.riderCall.update({
        where: { id: existingCall.id },
        data: {
          status: runStatus as any,
          contactStatus: contactStatus as any,
          contactedAt: lastContactAt,
          transcript: r["Transcript"] || null,
          summary: r["Summary"] || null,
          urgentFlag,
          legalIssueFlag,
          humanRequested,
          metadata: {
            source: "csv_seed",
            externalId,
          } as any,
        },
      });
    } else {
      await prisma.riderCall.create({
        data: {
          riderId: rider.id,
          initiatedByUserId: demoUser.id,
          status: runStatus as any,
          contactStatus: contactStatus as any,
          contactedAt: lastContactAt,
          transcript: r["Transcript"] || null,
          summary: r["Summary"] || null,
          urgentFlag,
          legalIssueFlag,
          humanRequested,
          metadata: {
            source: "csv_seed",
            externalId,
          } as any,
        },
      });
    }
  }

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
