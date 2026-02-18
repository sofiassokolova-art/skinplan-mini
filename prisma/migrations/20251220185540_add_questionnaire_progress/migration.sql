-- CreateTable
CREATE TABLE "questionnaire_progress" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "questionnaire_id" INTEGER NOT NULL,
    "question_index" INTEGER NOT NULL DEFAULT 0,
    "info_screen_index" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_progress_user_id_questionnaire_id_key" ON "questionnaire_progress"("user_id", "questionnaire_id");

-- CreateIndex
CREATE INDEX "questionnaire_progress_user_id_idx" ON "questionnaire_progress"("user_id");

-- CreateIndex
CREATE INDEX "questionnaire_progress_questionnaire_id_idx" ON "questionnaire_progress"("questionnaire_id");

-- AddForeignKey
ALTER TABLE "questionnaire_progress" ADD CONSTRAINT "questionnaire_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_progress" ADD CONSTRAINT "questionnaire_progress_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

