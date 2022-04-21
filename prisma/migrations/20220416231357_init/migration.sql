/*
  Warnings:

  - A unique constraint covering the columns `[summonerId,matchId]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Participant_summonerId_matchId_key" ON "Participant"("summonerId", "matchId");
