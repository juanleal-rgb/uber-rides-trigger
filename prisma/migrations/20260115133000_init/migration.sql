-- Enable UUID generation (used by gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "run_id" TEXT,
    "nombre_alumno" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "programa" TEXT,
    "formacion_previa" TEXT,
    "pais" TEXT,
    "edad" TEXT,
    "estudios_previos" TEXT,
    "motivacion" TEXT,
    "canal" TEXT,
    "razon_no_interes" TEXT,
    "palanca" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "user_id" TEXT,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "calls_run_id_key" ON "calls"("run_id");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");

-- CreateIndex
CREATE INDEX "calls_user_id_idx" ON "calls"("user_id");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
