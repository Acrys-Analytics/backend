/*
  Warnings:

  - Added the required column `depth` to the `Result` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "depth" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Summoner" ALTER COLUMN "tier" DROP NOT NULL,
ALTER COLUMN "rank" DROP NOT NULL;
