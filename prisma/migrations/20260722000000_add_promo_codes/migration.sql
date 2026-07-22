-- Промокоды для серверного пересчёта цены перед созданием платежа.
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "discount_type" TEXT NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "applies_to_product_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "max_redemptions" INTEGER,
    "max_redemptions_per_user" INTEGER NOT NULL DEFAULT 1,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_redemptions" (
    "id" TEXT NOT NULL,
    "promo_code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payments" ADD COLUMN "original_amount" INTEGER;
ALTER TABLE "payments" ADD COLUMN "discount_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "promo_code" TEXT;
ALTER TABLE "payments" ADD COLUMN "promo_code_id" TEXT;

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_active_idx" ON "promo_codes"("active");
CREATE INDEX "promo_codes_expires_at_idx" ON "promo_codes"("expires_at");

CREATE UNIQUE INDEX "promo_redemptions_payment_id_key" ON "promo_redemptions"("payment_id");
CREATE INDEX "promo_redemptions_promo_code_id_idx" ON "promo_redemptions"("promo_code_id");
CREATE INDEX "promo_redemptions_user_id_idx" ON "promo_redemptions"("user_id");
CREATE INDEX "promo_redemptions_created_at_idx" ON "promo_redemptions"("created_at");

CREATE INDEX "payments_promo_code_id_idx" ON "payments"("promo_code_id");
CREATE INDEX "payments_promo_code_idx" ON "payments"("promo_code");

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_discount_type_check"
    CHECK ("discount_type" IN ('percent', 'fixed', 'override_price'));

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_discount_value_check"
    CHECK ("discount_value" >= 0);

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_max_redemptions_check"
    CHECK ("max_redemptions" IS NULL OR "max_redemptions" > 0);

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_max_redemptions_per_user_check"
    CHECK ("max_redemptions_per_user" > 0);

ALTER TABLE "payments" ADD CONSTRAINT "payments_promo_code_id_fkey"
    FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_fkey"
    FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
