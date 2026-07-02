-- CreateEnum
CREATE TYPE "Quality" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "EsgRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CertType" AS ENUM ('FSC', 'PEFC', 'BOTH', 'NONE');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED', 'NONE');

-- CreateEnum
CREATE TYPE "DdraStatus" AS ENUM ('COMPLIANT', 'UNDER_REVIEW', 'NON_COMPLIANT', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "volume" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "growth" DOUBLE PRECISION NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "region" TEXT NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_records" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "species_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER NOT NULL,
    "quality" "Quality" NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_indices" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "price_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "index_points" (
    "id" TEXT NOT NULL,
    "index_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "index_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esg_scores" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "env" INTEGER NOT NULL,
    "soc" INTEGER NOT NULL,
    "gov" INTEGER NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "risk" "EsgRisk" NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esg_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "CertType" NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "CertStatus" NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deforestation_alerts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "alert_date" TIMESTAMP(3) NOT NULL,
    "area_ha" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,

    CONSTRAINT "deforestation_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ddra_records" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "status" "DdraStatus" NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ddra_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effective_date" TEXT NOT NULL,
    "last_change" TEXT NOT NULL,
    "price_impact" DOUBLE PRECISION NOT NULL,
    "compliance_cost" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "compliance_rate" INTEGER NOT NULL,
    "cam_status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "key_requirements" TEXT[],
    "tags" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,

    CONSTRAINT "regulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "species_name_key" ON "species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "markets_code_key" ON "markets"("code");

-- CreateIndex
CREATE INDEX "markets_region_idx" ON "markets"("region");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "price_records_species_id_idx" ON "price_records"("species_id");

-- CreateIndex
CREATE INDEX "price_records_market_id_idx" ON "price_records"("market_id");

-- CreateIndex
CREATE INDEX "price_records_quality_idx" ON "price_records"("quality");

-- CreateIndex
CREATE INDEX "price_records_recorded_at_idx" ON "price_records"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "price_indices_code_key" ON "price_indices"("code");

-- CreateIndex
CREATE INDEX "index_points_index_id_date_idx" ON "index_points"("index_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "index_points_index_id_date_key" ON "index_points"("index_id", "date");

-- CreateIndex
CREATE INDEX "esg_scores_company_id_assessed_at_idx" ON "esg_scores"("company_id", "assessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE INDEX "certificates_type_idx" ON "certificates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "deforestation_alerts_code_key" ON "deforestation_alerts"("code");

-- CreateIndex
CREATE INDEX "deforestation_alerts_severity_alert_date_idx" ON "deforestation_alerts"("severity", "alert_date");

-- CreateIndex
CREATE UNIQUE INDEX "ddra_records_code_key" ON "ddra_records"("code");

-- CreateIndex
CREATE INDEX "ddra_records_status_idx" ON "ddra_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "regulations_code_key" ON "regulations"("code");

-- CreateIndex
CREATE INDEX "regulations_region_idx" ON "regulations"("region");

-- AddForeignKey
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_records" ADD CONSTRAINT "price_records_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "index_points" ADD CONSTRAINT "index_points_index_id_fkey" FOREIGN KEY ("index_id") REFERENCES "price_indices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esg_scores" ADD CONSTRAINT "esg_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddra_records" ADD CONSTRAINT "ddra_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
