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

function parseBooleanLoose(v: string | undefined | null): boolean | null {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (!s || s === "-") return null;
  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  if (s === "t") return true;
  if (s === "f") return false;
  return null;
}

function parseIntLoose(v: string | undefined | null): number | null {
  const s = String(v || "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

// Minimal delimited parser that supports quoted fields containing delimiters/newlines.
function parseDelimited(
  content: string,
  delimiter: "," | "\t",
): Array<Record<string, string>> {
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

    if (c === delimiter) {
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
  const rawHeaders = rows[0].map((h) => h.trim());
  // Make headers unique (dataset can have duplicates like "Document 1" repeated)
  const seen: Record<string, number> = {};
  const headers = rawHeaders.map((h) => {
    const norm = normalizeHeader(h);
    const count = (seen[norm] = (seen[norm] || 0) + 1);
    return count === 1 ? norm : `${norm}_${count}`;
  });

  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

function detectDelimiter(content: string): "," | "\t" {
  const firstLine = content.split(/\r?\n/, 1)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function deriveDocumentsUploaded(docFlags: Array<boolean | null>): "NO" | "PARTIAL" | "YES" | null {
  const vals = docFlags.filter((v): v is boolean => v !== null);
  if (vals.length === 0) return null;
  const trues = vals.filter(Boolean).length;
  if (trues === 0) return "NO";
  if (trues === vals.length) return "YES";
  return "PARTIAL";
}

async function importFromCsv(csvText: string, initiatedByUserId?: string | null) {
  const delimiter = detectDelimiter(csvText);
  const records = parseDelimited(csvText, delimiter);

  let ridersUpserted = 0;
  let callsCreated = 0;
  let callsUpdated = 0;
  let skipped = 0;

  for (const r of records) {
    const isDatasetV2 = typeof r["partner_name"] === "string";

    if (isDatasetV2) {
      const partnerName = (r["partner_name"] || "").trim();
      const phoneNumber = (r["phone_number"] || "").trim();
      const city = (r["city"] || "").trim() || null;

      if (!partnerName || !phoneNumber) {
        skipped++;
        continue;
      }

      const docFlags = Object.entries(r)
        .filter(([k]) => k.startsWith("document"))
        .map(([, v]) => parseBooleanLoose(v));
      const documentsUploaded = deriveDocumentsUploaded(docFlags);

      const callStatusRaw = String(r["call_status"] || "").trim().toLowerCase();
      const contactStatus =
        !callStatusRaw || callStatusRaw === "-" || callStatusRaw === "pending"
          ? "PENDING"
          : callStatusRaw === "completed"
            ? "COMPLETED"
            : callStatusRaw === "voicemail"
              ? "VOICEMAIL"
              : callStatusRaw === "no answer" || callStatusRaw === "no_answer"
                ? "NO_ANSWER"
                : null;

      const sentiment = String(r["sentiment"] || "").trim();
      const humanRequested = Boolean(parseBooleanLoose(r["call_human"]));
      const summary = String(r["summary"] || "").trim() || null;
      const attempt = parseIntLoose(r["attempt"]);
      const runIdRaw = String(r["run_id"] || "").trim();
      const runId = runIdRaw && runIdRaw !== "-" ? runIdRaw : null;
      const ts = parseDate(r["timestamp"]);

      const documentsJson = {
        flags: docFlags,
        count: docFlags.filter((v) => v !== null).length,
        trueCount: docFlags.filter((v) => v === true).length,
      };

      let rider = await prisma.rider.findFirst({
        where: {
          driverName: partnerName,
          phoneNumber,
          ...(city ? { city } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });

      if (rider) {
        rider = await prisma.rider.update({
          where: { id: rider.id },
          data: {
            driverName: partnerName,
            phoneNumber,
            city,
            documents: documentsJson as any,
            documentsUploaded: documentsUploaded as any,
            humanRequested,
          },
        });
      } else {
        rider = await prisma.rider.create({
          data: {
            driverName: partnerName,
            phoneNumber,
            city,
            documents: documentsJson as any,
            documentsUploaded: documentsUploaded as any,
            humanRequested,
          },
        });
      }
      ridersUpserted++;

      const runStatus =
        contactStatus && contactStatus !== "PENDING" ? "COMPLETED" : "PENDING";

      const callData = {
        status: runStatus as any,
        contactStatus: contactStatus as any,
        contactedAt: ts,
        summary,
        sentiment: sentiment && sentiment !== "-" ? sentiment : null,
        attempt,
        runId,
        humanRequested,
        metadata: {
          source: "dataset_v2_import",
          city,
        } as any,
      };

      let existingCall = null as any;
      if (runId) {
        existingCall = await prisma.riderCall.findUnique({ where: { runId } });
      }
      if (!existingCall && attempt !== null) {
        existingCall = await prisma.riderCall.findFirst({
          where: { riderId: rider.id, attempt },
          orderBy: { createdAt: "desc" },
        });
      }
      if (!existingCall && ts) {
        existingCall = await prisma.riderCall.findFirst({
          where: { riderId: rider.id, contactedAt: ts },
          orderBy: { createdAt: "desc" },
        });
      }

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

      // Keep rider "last contact" fields consistent when we have a timestamp/status
      if (ts) {
        await prisma.rider.update({
          where: { id: rider.id },
          data: {
            lastContactAt: ts,
            lastContactStatus: contactStatus as any,
          },
        });
      }
    } else {
      // Legacy dataset (CSV from previous version)
      const externalId = r["id"] ? Number(r["id"]) : null;
      const phoneNumber = r["phone_number"] || "";
      const driverName = r["driver_name"] || "";

      if (!externalId || !phoneNumber || !driverName) {
        skipped++;
        continue;
      }

      const signUpDate = parseDate(r["sign-up_date"]);
      const lastContactAt = parseDate(r["last_contact_date"]);

      const docs = (r["documents_uploaded"] || "").trim().toLowerCase();
      const documentsUploaded =
        docs === "yes"
          ? "YES"
          : docs === "partial"
            ? "PARTIAL"
            : docs === "no"
              ? "NO"
              : null;

      const callStatusRaw = (r["call_status"] || "").trim().toLowerCase();
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

      const urgentFlag = parseYesNo(r["urgent_flag"]);
      const legalIssueFlag = parseYesNo(r["legal_issue_flag"]);
      const humanRequested = parseYesNo(r["human_requested"]);

      const rider = await prisma.rider.upsert({
        where: { externalId },
        update: {
          phoneNumber,
          driverName,
          signUpDate,
          flowType: r["flow_type"] || null,
          documentsUploaded: documentsUploaded as any,
          licenseCountry: r["license_country"] || null,
          residentPermitStatus: r["resident_permit_status"] || null,
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
          flowType: r["flow_type"] || null,
          documentsUploaded: documentsUploaded as any,
          licenseCountry: r["license_country"] || null,
          residentPermitStatus: r["resident_permit_status"] || null,
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
        transcript: r["transcript"] || null,
        summary: r["summary"] || null,
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

