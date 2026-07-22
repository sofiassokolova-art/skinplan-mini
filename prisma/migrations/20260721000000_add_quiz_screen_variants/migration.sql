-- Варианты инфо-экранов анкеты под цель ухода (см. model QuizScreenVariant).
CREATE TABLE "quiz_screen_variants" (
    "id" SERIAL NOT NULL,
    "screen_id" TEXT NOT NULL,
    "focus_key" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "body_title" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_screen_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quiz_screen_variants_screen_id_focus_key_key" ON "quiz_screen_variants"("screen_id", "focus_key");

CREATE INDEX "quiz_screen_variants_screen_id_is_active_idx" ON "quiz_screen_variants"("screen_id", "is_active");
