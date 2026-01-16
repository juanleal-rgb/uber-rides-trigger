/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();

function parseYesNo(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

function parseDate(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBooleanLoose(v) {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (!s || s === "-") return null;
  if (["true", "yes", "y", "1", "t"].includes(s)) return true;
  if (["false", "no", "n", "0", "f"].includes(s)) return false;
  return null;
}

function parseIntLoose(v) {
  const s = String(v || "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeHeader(h) {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function detectDelimiter(content) {
  const firstLine = String(content).split(/\r?\n/, 1)[0] || "";
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function deriveDocumentsUploaded(docFlags) {
  const vals = docFlags.filter((v) => v !== null);
  if (vals.length === 0) return null;
  const trues = vals.filter(Boolean).length;
  if (trues === 0) return "NO";
  if (trues === vals.length) return "YES";
  return "PARTIAL";
}

// Minimal delimited parser that supports quoted fields containing delimiters/newlines.
function parseDelimited(content, delimiter) {
  const rows = [];
  let row = [];
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
      if (row.some((v) => String(v).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    if (c === "\r") continue;
    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => String(v).trim() !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];
  const rawHeaders = rows[0].map((h) => String(h).trim());
  const seen = {};
  const headers = rawHeaders.map((h) => {
    const norm = normalizeHeader(h);
    const count = (seen[norm] = (seen[norm] || 0) + 1);
    return count === 1 ? norm : `${norm}_${count}`;
  });
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = String(r[idx] ?? "").trim();
    });
    return obj;
  });
}

async function importFromCsv(csvText, initiatedByUserId) {
  const delimiter = detectDelimiter(csvText);
  const records = parseDelimited(csvText, delimiter);
  console.log(`Importing riders from CSV: ${records.length} rows`);

  let ridersUpserted = 0;
  let callsCreated = 0;
  let callsUpdated = 0;

  for (const r of records) {
    const isDatasetV2 = typeof r["partner_name"] === "string";

    if (isDatasetV2) {
      const partnerName = String(r["partner_name"] || "").trim();
      const phoneNumber = String(r["phone_number"] || "").trim();
      const city = String(r["city"] || "").trim() || null;

      if (!partnerName || !phoneNumber) continue;

      const docFlags = Object.entries(r)
        .filter(([k]) => String(k).startsWith("document"))
        .map(([, v]) => parseBooleanLoose(v));
      const documentsUploaded = deriveDocumentsUploaded(docFlags);
      const documentsJson = {
        flags: docFlags,
        count: docFlags.filter((v) => v !== null).length,
        trueCount: docFlags.filter((v) => v === true).length,
      };

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
            documents: documentsJson,
            documentsUploaded,
            humanRequested,
          },
        });
      } else {
        rider = await prisma.rider.create({
          data: {
            driverName: partnerName,
            phoneNumber,
            city,
            documents: documentsJson,
            documentsUploaded,
            humanRequested,
          },
        });
      }
      ridersUpserted++;

      const runStatus =
        contactStatus && contactStatus !== "PENDING" ? "COMPLETED" : "PENDING";

      const callData = {
        status: runStatus,
        contactStatus,
        contactedAt: ts,
        summary,
        sentiment: sentiment && sentiment !== "-" ? sentiment : null,
        attempt,
        runId,
        humanRequested,
        metadata: { source: "dataset_v2_seed", city },
      };

      let existingCall = null;
      if (runId) existingCall = await prisma.riderCall.findUnique({ where: { runId } });
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
        await prisma.riderCall.update({ where: { id: existingCall.id }, data: callData });
        callsUpdated++;
      } else {
        await prisma.riderCall.create({
          data: { riderId: rider.id, initiatedByUserId: initiatedByUserId || null, ...callData },
        });
        callsCreated++;
      }

      if (ts) {
        await prisma.rider.update({
          where: { id: rider.id },
          data: { lastContactAt: ts, lastContactStatus: contactStatus },
        });
      }
    } else {
      // Legacy dataset
      const externalId = r["id"] ? Number(r["id"]) : null;
      const phoneNumber = r["phone_number"] || "";
      const driverName = r["driver_name"] || "";

      if (!externalId || !phoneNumber || !driverName) continue;

      const signUpDate = parseDate(r["sign-up_date"]);
      const lastContactAt = parseDate(r["last_contact_date"]);

      const docs = String(r["documents_uploaded"] || "").trim().toLowerCase();
      const documentsUploaded =
        docs === "yes"
          ? "YES"
          : docs === "partial"
            ? "PARTIAL"
            : docs === "no"
              ? "NO"
              : null;

      const callStatusRaw = String(r["call_status"] || "").trim().toLowerCase();
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
          documentsUploaded,
          licenseCountry: r["license_country"] || null,
          residentPermitStatus: r["resident_permit_status"] || null,
          lastContactAt,
          lastContactStatus: contactStatus,
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
          documentsUploaded,
          licenseCountry: r["license_country"] || null,
          residentPermitStatus: r["resident_permit_status"] || null,
          lastContactAt,
          lastContactStatus: contactStatus,
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
          ...(contactStatus ? { contactStatus } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      const runStatus =
        contactStatus && contactStatus !== "PENDING" ? "COMPLETED" : "PENDING";

      const callData = {
        status: runStatus,
        contactStatus,
        contactedAt: lastContactAt,
        transcript: r["transcript"] || null,
        summary: r["summary"] || null,
        urgentFlag,
        legalIssueFlag,
        humanRequested,
        metadata: {
          source: "csv_seed",
          externalId,
        },
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

  return { ridersUpserted, callsCreated, callsUpdated };
}

async function main() {
  console.log("Seeding database...");

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
  const res = await importFromCsv(csv, demoUser.id);
  console.log("Import completed:", res);
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

