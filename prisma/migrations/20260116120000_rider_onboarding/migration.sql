-- Rider onboarding domain tables
-- This migration is additive (keeps legacy "calls" table) to avoid breaking existing environments.

-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "DocumentsUploadedStatus" AS ENUM ('NO', 'PARTIAL', 'YES');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'NO_ANSWER', 'VOICEMAIL', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "riders" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "external_id" INTEGER,
    "phone_number" TEXT NOT NULL,
    "driver_name" TEXT NOT NULL,
    "sign_up_date" TIMESTAMP(3),
    "flow_type" TEXT,
    "documents_uploaded" "DocumentsUploadedStatus",
    "license_country" TEXT,
    "resident_permit_status" TEXT,
    "last_contact_at" TIMESTAMP(3),
    "last_contact_status" "ContactStatus",
    "urgent_flag" BOOLEAN NOT NULL DEFAULT false,
    "legal_issue_flag" BOOLEAN NOT NULL DEFAULT false,
    "human_requested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "rider_calls" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "run_id" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "contact_status" "ContactStatus",
    "contacted_at" TIMESTAMP(3),
    "transcript" TEXT,
    "summary" TEXT,
    "urgent_flag" BOOLEAN NOT NULL DEFAULT false,
    "legal_issue_flag" BOOLEAN NOT NULL DEFAULT false,
    "human_requested" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "rider_id" TEXT NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "rider_calls_pkey" PRIMARY KEY ("id")
);

-- Indexes / constraints (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "riders_external_id_key" ON "riders"("external_id");
CREATE INDEX IF NOT EXISTS "riders_phone_number_idx" ON "riders"("phone_number");
CREATE INDEX IF NOT EXISTS "riders_driver_name_idx" ON "riders"("driver_name");
CREATE INDEX IF NOT EXISTS "riders_flow_type_idx" ON "riders"("flow_type");
CREATE INDEX IF NOT EXISTS "riders_urgent_flag_idx" ON "riders"("urgent_flag");
CREATE INDEX IF NOT EXISTS "riders_legal_issue_flag_idx" ON "riders"("legal_issue_flag");
CREATE INDEX IF NOT EXISTS "riders_human_requested_idx" ON "riders"("human_requested");

CREATE UNIQUE INDEX IF NOT EXISTS "rider_calls_run_id_key" ON "rider_calls"("run_id");
CREATE INDEX IF NOT EXISTS "rider_calls_status_idx" ON "rider_calls"("status");
CREATE INDEX IF NOT EXISTS "rider_calls_created_at_idx" ON "rider_calls"("created_at");
CREATE INDEX IF NOT EXISTS "rider_calls_rider_id_idx" ON "rider_calls"("rider_id");
CREATE INDEX IF NOT EXISTS "rider_calls_user_id_idx" ON "rider_calls"("user_id");

-- Foreign keys
DO $$ BEGIN
    ALTER TABLE "rider_calls"
    ADD CONSTRAINT "rider_calls_rider_id_fkey"
    FOREIGN KEY ("rider_id") REFERENCES "riders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "rider_calls"
    ADD CONSTRAINT "rider_calls_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

