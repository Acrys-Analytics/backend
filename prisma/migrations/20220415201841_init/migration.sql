/*
  Warnings:

  - You are about to drop the column `creepscore` on the `Participant` table. All the data in the column will be lost.
  - You are about to drop the column `visionscore` on the `Participant` table. All the data in the column will be lost.
  - Added the required column `creepScore` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visionScore` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visionWardsBoughtInGame` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Participant" DROP COLUMN "creepscore",
DROP COLUMN "visionscore",
ADD COLUMN     "creepScore" INTEGER NOT NULL,
ADD COLUMN     "visionScore" INTEGER NOT NULL,
ADD COLUMN     "visionWardsBoughtInGame" INTEGER NOT NULL;
