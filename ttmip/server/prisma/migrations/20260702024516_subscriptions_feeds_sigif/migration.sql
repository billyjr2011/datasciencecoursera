-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PRODUCER', 'TRADER', 'BUYER', 'ANALYST', 'REGULATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "FeedStatus" AS ENUM ('LIVE', 'DELAYED', 'DOWN');

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "feed_type" TEXT NOT NULL DEFAULT 'REST',
ADD COLUMN     "last_sync_at" TIMESTAMP(3),
ADD COLUMN     "poll_seconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "record_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "region" TEXT NOT NULL DEFAULT 'Global',
ADD COLUMN     "status" "FeedStatus" NOT NULL DEFAULT 'LIVE',
ADD COLUMN     "url" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'TRADER';

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "price_usd" DOUBLE PRECISION NOT NULL,
    "features" TEXT[],
    "max_seats" INTEGER NOT NULL,
    "api_rate_limit" INTEGER NOT NULL,
    "feed_delay_mins" INTEGER NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renews_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sigif_quotas" (
    "id" TEXT NOT NULL,
    "concession" TEXT NOT NULL,
    "title_holder" TEXT NOT NULL,
    "species_name" TEXT NOT NULL,
    "yearly_quota" DOUBLE PRECISION NOT NULL,
    "used_volume" DOUBLE PRECISION NOT NULL,
    "available_m3" DOUBLE PRECISION NOT NULL,
    "permit_number" TEXT NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sigif_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "sigif_quotas_species_name_idx" ON "sigif_quotas"("species_name");

-- CreateIndex
CREATE UNIQUE INDEX "sigif_quotas_concession_species_name_key" ON "sigif_quotas"("concession", "species_name");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
