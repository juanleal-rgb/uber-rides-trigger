-- Dataset v2 fields (partner_name/phone_number/docs/city/sentiment/attempt/run_id/timestamp)
-- Additive migration.

-- riders: city + documents (JSON)
ALTER TABLE "riders"
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "documents" JSONB;

CREATE INDEX IF NOT EXISTS "riders_city_idx" ON "riders"("city");

-- rider_calls: sentiment + attempt
ALTER TABLE "rider_calls"
  ADD COLUMN IF NOT EXISTS "sentiment" TEXT,
  ADD COLUMN IF NOT EXISTS "attempt" INTEGER;

CREATE INDEX IF NOT EXISTS "rider_calls_attempt_idx" ON "rider_calls"("attempt");

