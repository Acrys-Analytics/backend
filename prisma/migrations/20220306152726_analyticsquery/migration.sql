/*
  Warnings:

  - You are about to drop the column `resultId` on the `Summoner` table. All the data in the column will be lost.
  - You are about to drop the `Result` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `analyticsId` to the `Summoner` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Summoner" DROP CONSTRAINT "Summoner_resultId_fkey";

-- AlterTable
ALTER TABLE "Summoner" DROP COLUMN "resultId",
ADD COLUMN     "analyticsId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Result";

-- CreateTable
CREATE TABLE "AnalyticsQuery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "depth" INTEGER NOT NULL,
    "type" "ResultType" NOT NULL,

    CONSTRAINT "AnalyticsQuery_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Summoner" ADD CONSTRAINT "Summoner_analyticsId_fkey" FOREIGN KEY ("analyticsId") REFERENCES "AnalyticsQuery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
