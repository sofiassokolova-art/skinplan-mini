-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_active" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone_number" TEXT,
    "current_profile_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skin_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "skin_type" TEXT,
    "sensitivity_level" TEXT,
    "dehydration_level" INTEGER,
    "acne_level" INTEGER,
    "rosacea_risk" TEXT,
    "pigmentation_risk" TEXT,
    "age_group" TEXT,
    "has_pregnancy" BOOLEAN DEFAULT false,
    "medical_markers" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaires" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_groups" (
    "id" SERIAL NOT NULL,
    "questionnaire_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "questionnaire_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_options" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "score_json" JSONB,

    CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_answers" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "questionnaire_id" INTEGER NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer_value" TEXT,
    "answer_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_answers_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "questionnaire_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "questionnaire_id" INTEGER NOT NULL,
    "client_submission_id" TEXT,
    "profile_id" TEXT,
    "profile_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,

    CONSTRAINT "questionnaire_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "logo_url" TEXT,
    "slug" TEXT,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "brand_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "line" TEXT,
    "category" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "skin_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_fragrance_free" BOOLEAN NOT NULL DEFAULT false,
    "is_non_comedogenic" BOOLEAN NOT NULL DEFAULT false,
    "price_segment" TEXT,
    "description_user" TEXT,
    "market_links" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "price" INTEGER,
    "active_ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoid_if" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_hero" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT,
    "volume" TEXT,
    "composition" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "conditions_json" JSONB NOT NULL,
    "steps_json" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "rule_id" INTEGER,
    "products" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_rule_history" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "conditions_json" JSONB NOT NULL,
    "steps_json" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_rule_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "telegram_id" TEXT,
    "telegram_username" TEXT,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_whitelist" (
    "id" SERIAL NOT NULL,
    "phone_number" TEXT,
    "telegram_id" TEXT,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_email_whitelist" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_email_whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'plan_recommendations',

    CONSTRAINT "plan_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan28" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skin_profile_id" TEXT NOT NULL,
    "profile_version" INTEGER NOT NULL,
    "plan_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan28_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "total_completed_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_replacements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_product_id" INTEGER NOT NULL,
    "new_product_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_replacements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "content" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_messages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "buttons_json" JSONB,
    "image_url" TEXT,

    CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_chats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unread" INTEGER NOT NULL DEFAULT 0,
    "unread_admin" INTEGER NOT NULL DEFAULT 0,
    "last_message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "auto_reply_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "support_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_logs" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "telegram_id" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "user_agent" TEXT,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_retaking_quiz" BOOLEAN NOT NULL DEFAULT false,
    "full_retake_from_home" BOOLEAN NOT NULL DEFAULT false,
    "payment_retaking_completed" BOOLEAN NOT NULL DEFAULT false,
    "payment_full_retake_completed" BOOLEAN NOT NULL DEFAULT false,
    "has_plan_progress" BOOLEAN NOT NULL DEFAULT false,
    "routine_products" JSONB,
    "plan_feedback_sent" BOOLEAN NOT NULL DEFAULT false,
    "service_feedback_sent" BOOLEAN NOT NULL DEFAULT false,
    "last_plan_feedback_date" TIMESTAMP(3),
    "last_service_feedback_date" TIMESTAMP(3),
    "extra" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "provider" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "provider_payload" JSONB,
    "status" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "valid_until" TIMESTAMP(3),
    "last_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_last_active_idx" ON "users"("last_active");

-- CreateIndex
CREATE INDEX "users_current_profile_id_idx" ON "users"("current_profile_id");

-- CreateIndex
CREATE INDEX "skin_profiles_user_id_idx" ON "skin_profiles"("user_id");

-- CreateIndex
CREATE INDEX "skin_profiles_user_id_created_at_idx" ON "skin_profiles"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "skin_profiles_user_id_version_key" ON "skin_profiles"("user_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaires_version_key" ON "questionnaires"("version");

-- CreateIndex
CREATE INDEX "questionnaires_is_active_idx" ON "questionnaires"("is_active");

-- CreateIndex
CREATE INDEX "question_groups_questionnaire_id_idx" ON "question_groups"("questionnaire_id");

-- CreateIndex
CREATE INDEX "questions_questionnaire_id_idx" ON "questions"("questionnaire_id");

-- CreateIndex
CREATE INDEX "questions_group_id_idx" ON "questions"("group_id");

-- CreateIndex
CREATE INDEX "answer_options_question_id_idx" ON "answer_options"("question_id");

-- CreateIndex
CREATE INDEX "user_answers_user_id_idx" ON "user_answers"("user_id");

-- CreateIndex
CREATE INDEX "user_answers_questionnaire_id_idx" ON "user_answers"("questionnaire_id");

-- CreateIndex
CREATE INDEX "user_answers_question_id_idx" ON "user_answers"("question_id");

-- CreateIndex
CREATE INDEX "user_answers_user_id_questionnaire_id_idx" ON "user_answers"("user_id", "questionnaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_answers_user_id_questionnaire_id_question_id_key" ON "user_answers"("user_id", "questionnaire_id", "question_id");

-- CreateIndex
CREATE INDEX "questionnaire_progress_user_id_idx" ON "questionnaire_progress"("user_id");

-- CreateIndex
CREATE INDEX "questionnaire_progress_questionnaire_id_idx" ON "questionnaire_progress"("questionnaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_progress_user_id_questionnaire_id_key" ON "questionnaire_progress"("user_id", "questionnaire_id");

-- CreateIndex
CREATE INDEX "questionnaire_submissions_user_id_idx" ON "questionnaire_submissions"("user_id");

-- CreateIndex
CREATE INDEX "questionnaire_submissions_questionnaire_id_idx" ON "questionnaire_submissions"("questionnaire_id");

-- CreateIndex
CREATE INDEX "questionnaire_submissions_profile_id_idx" ON "questionnaire_submissions"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_submissions_user_id_questionnaire_id_client_s_key" ON "questionnaire_submissions"("user_id", "questionnaire_id", "client_submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_submissions_user_id_questionnaire_id_key" ON "questionnaire_submissions"("user_id", "questionnaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_published_idx" ON "products"("published");

-- CreateIndex
CREATE INDEX "products_step_idx" ON "products"("step");

-- CreateIndex
CREATE INDEX "products_is_hero_priority_idx" ON "products"("is_hero", "priority");

-- CreateIndex
CREATE INDEX "recommendation_rules_is_active_priority_idx" ON "recommendation_rules"("is_active", "priority");

-- CreateIndex
CREATE INDEX "recommendation_sessions_user_id_idx" ON "recommendation_sessions"("user_id");

-- CreateIndex
CREATE INDEX "recommendation_sessions_profile_id_idx" ON "recommendation_sessions"("profile_id");

-- CreateIndex
CREATE INDEX "recommendation_sessions_created_at_idx" ON "recommendation_sessions"("created_at");

-- CreateIndex
CREATE INDEX "recommendation_rule_history_rule_id_idx" ON "recommendation_rule_history"("rule_id");

-- CreateIndex
CREATE INDEX "recommendation_rule_history_rule_id_version_idx" ON "recommendation_rule_history"("rule_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegram_id_key" ON "admins"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegram_username_key" ON "admins"("telegram_username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_whitelist_phone_number_key" ON "admin_whitelist"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "admin_whitelist_telegram_id_key" ON "admin_whitelist"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_whitelist_email_key" ON "admin_email_whitelist"("email");

-- CreateIndex
CREATE INDEX "plan_feedback_user_id_idx" ON "plan_feedback"("user_id");

-- CreateIndex
CREATE INDEX "plan_feedback_created_at_idx" ON "plan_feedback"("created_at");

-- CreateIndex
CREATE INDEX "plan_feedback_rating_idx" ON "plan_feedback"("rating");

-- CreateIndex
CREATE INDEX "plan_feedback_type_idx" ON "plan_feedback"("type");

-- CreateIndex
CREATE INDEX "plan28_user_id_idx" ON "plan28"("user_id");

-- CreateIndex
CREATE INDEX "plan28_skin_profile_id_idx" ON "plan28"("skin_profile_id");

-- CreateIndex
CREATE INDEX "plan28_profile_version_idx" ON "plan28"("profile_version");

-- CreateIndex
CREATE INDEX "plan28_user_id_profile_version_idx" ON "plan28"("user_id", "profile_version");

-- CreateIndex
CREATE UNIQUE INDEX "plan28_user_id_profile_version_key" ON "plan28"("user_id", "profile_version");

-- CreateIndex
CREATE UNIQUE INDEX "plan_progress_user_id_key" ON "plan_progress"("user_id");

-- CreateIndex
CREATE INDEX "plan_progress_user_id_idx" ON "plan_progress"("user_id");

-- CreateIndex
CREATE INDEX "wishlist_user_id_idx" ON "wishlist"("user_id");

-- CreateIndex
CREATE INDEX "wishlist_product_id_idx" ON "wishlist"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_user_id_product_id_key" ON "wishlist"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "cart_user_id_idx" ON "cart"("user_id");

-- CreateIndex
CREATE INDEX "cart_product_id_idx" ON "cart"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_user_id_product_id_key" ON "cart"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "wishlist_feedback_user_id_idx" ON "wishlist_feedback"("user_id");

-- CreateIndex
CREATE INDEX "wishlist_feedback_product_id_idx" ON "wishlist_feedback"("product_id");

-- CreateIndex
CREATE INDEX "wishlist_feedback_feedback_idx" ON "wishlist_feedback"("feedback");

-- CreateIndex
CREATE INDEX "wishlist_feedback_created_at_idx" ON "wishlist_feedback"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_feedback_user_id_product_id_key" ON "wishlist_feedback"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "product_replacements_user_id_idx" ON "product_replacements"("user_id");

-- CreateIndex
CREATE INDEX "product_replacements_old_product_id_idx" ON "product_replacements"("old_product_id");

-- CreateIndex
CREATE INDEX "product_replacements_new_product_id_idx" ON "product_replacements"("new_product_id");

-- CreateIndex
CREATE INDEX "bot_messages_user_id_idx" ON "bot_messages"("user_id");

-- CreateIndex
CREATE INDEX "bot_messages_chat_id_idx" ON "bot_messages"("chat_id");

-- CreateIndex
CREATE INDEX "bot_messages_created_at_idx" ON "bot_messages"("created_at");

-- CreateIndex
CREATE INDEX "bot_messages_direction_idx" ON "bot_messages"("direction");

-- CreateIndex
CREATE INDEX "broadcast_messages_status_idx" ON "broadcast_messages"("status");

-- CreateIndex
CREATE INDEX "broadcast_messages_scheduled_at_idx" ON "broadcast_messages"("scheduled_at");

-- CreateIndex
CREATE INDEX "support_chats_user_id_idx" ON "support_chats"("user_id");

-- CreateIndex
CREATE INDEX "support_chats_status_idx" ON "support_chats"("status");

-- CreateIndex
CREATE INDEX "support_chats_updated_at_idx" ON "support_chats"("updated_at");

-- CreateIndex
CREATE INDEX "support_messages_chat_id_idx" ON "support_messages"("chat_id");

-- CreateIndex
CREATE INDEX "support_messages_created_at_idx" ON "support_messages"("created_at");

-- CreateIndex
CREATE INDEX "broadcast_logs_broadcast_id_idx" ON "broadcast_logs"("broadcast_id");

-- CreateIndex
CREATE INDEX "broadcast_logs_user_id_idx" ON "broadcast_logs"("user_id");

-- CreateIndex
CREATE INDEX "broadcast_logs_status_idx" ON "broadcast_logs"("status");

-- CreateIndex
CREATE INDEX "client_logs_user_id_idx" ON "client_logs"("user_id");

-- CreateIndex
CREATE INDEX "client_logs_telegram_id_idx" ON "client_logs"("telegram_id");

-- CreateIndex
CREATE INDEX "client_logs_level_idx" ON "client_logs"("level");

-- CreateIndex
CREATE INDEX "client_logs_created_at_idx" ON "client_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_idempotency_key_idx" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "entitlements_user_id_idx" ON "entitlements"("user_id");

-- CreateIndex
CREATE INDEX "entitlements_active_valid_until_idx" ON "entitlements"("active", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_user_id_code_key" ON "entitlements"("user_id", "code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_current_profile_id_fkey" FOREIGN KEY ("current_profile_id") REFERENCES "skin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skin_profiles" ADD CONSTRAINT "skin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "question_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_answers" ADD CONSTRAINT "user_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_progress" ADD CONSTRAINT "questionnaire_progress_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_progress" ADD CONSTRAINT "questionnaire_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "skin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_submissions" ADD CONSTRAINT "questionnaire_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "skin_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "recommendation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rule_history" ADD CONSTRAINT "recommendation_rule_history_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "recommendation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_feedback" ADD CONSTRAINT "plan_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan28" ADD CONSTRAINT "plan28_skin_profile_id_fkey" FOREIGN KEY ("skin_profile_id") REFERENCES "skin_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan28" ADD CONSTRAINT "plan28_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_progress" ADD CONSTRAINT "plan_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_feedback" ADD CONSTRAINT "wishlist_feedback_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_feedback" ADD CONSTRAINT "wishlist_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_replacements" ADD CONSTRAINT "product_replacements_new_product_id_fkey" FOREIGN KEY ("new_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_replacements" ADD CONSTRAINT "product_replacements_old_product_id_fkey" FOREIGN KEY ("old_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_replacements" ADD CONSTRAINT "product_replacements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_chats" ADD CONSTRAINT "support_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "support_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcast_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_logs" ADD CONSTRAINT "client_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_last_payment_id_fkey" FOREIGN KEY ("last_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

