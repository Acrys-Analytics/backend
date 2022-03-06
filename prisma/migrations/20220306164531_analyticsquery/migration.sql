/*
  Warnings:

  - Changed the type of `type` on the `AnalyticsQuery` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "QueryType" AS ENUM ('PLAYER', 'CLASH');

-- DropForeignKey
ALTER TABLE "Summoner" DROP CONSTRAINT "Summoner_analyticsId_fkey";

-- AlterTable
ALTER TABLE "AnalyticsQuery" DROP COLUMN "type",
ADD COLUMN     "type" "QueryType" NOT NULL;

-- AlterTable
ALTER TABLE "Summoner" ALTER COLUMN "analyticsId" DROP NOT NULL;

-- DropEnum
DROP TYPE "ResultType";

-- AddForeignKey
ALTER TABLE "Summoner" ADD CONSTRAINT "Summoner_analyticsId_fkey" FOREIGN KEY ("analyticsId") REFERENCES "AnalyticsQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
