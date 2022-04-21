-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER');

-- CreateEnum
CREATE TYPE "Rank" AS ENUM ('IV', 'III', 'II', 'I');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('TOP', 'MIDDLE', 'JUNGLE', 'BOTTOM', 'UTILITY', 'FILL');

-- CreateEnum
CREATE TYPE "QueryType" AS ENUM ('PLAYER', 'CLASH');

-- CreateTable
CREATE TABLE "Mastery" (
    "id" SERIAL NOT NULL,
    "championId" INTEGER NOT NULL,
    "championName" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "summonerSnapshotId" INTEGER NOT NULL,

    CONSTRAINT "Mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" SERIAL NOT NULL,
    "summonerId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "championName" TEXT NOT NULL,
    "championLevel" INTEGER NOT NULL,
    "position" "Position" NOT NULL,
    "win" BOOLEAN NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "creepscore" INTEGER NOT NULL,
    "visionscore" INTEGER NOT NULL,
    "gold" INTEGER NOT NULL,
    "damageToChamps" INTEGER NOT NULL,
    "damageToBuildings" INTEGER NOT NULL,
    "spells" INTEGER[],
    "runes" INTEGER[],
    "items" INTEGER[],
    "matchId" TEXT NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "mapId" INTEGER NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummonerSnapshot" (
    "id" SERIAL NOT NULL,
    "puuid" TEXT NOT NULL,
    "summonerId" TEXT NOT NULL,
    "summonerIconId" INTEGER NOT NULL,
    "summonerName" TEXT NOT NULL,
    "summonerLevel" INTEGER NOT NULL,
    "clashPosition" "Position",
    "tier" "Tier",
    "rank" "Rank",
    "analyticsQueryId" TEXT NOT NULL,

    CONSTRAINT "SummonerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsQuery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "depth" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "type" "QueryType" NOT NULL,
    "search" TEXT NOT NULL,

    CONSTRAINT "AnalyticsQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParticipantToSummonerSnapshot" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipantToSummonerSnapshot_AB_unique" ON "_ParticipantToSummonerSnapshot"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipantToSummonerSnapshot_B_index" ON "_ParticipantToSummonerSnapshot"("B");

-- AddForeignKey
ALTER TABLE "Mastery" ADD CONSTRAINT "Mastery_summonerSnapshotId_fkey" FOREIGN KEY ("summonerSnapshotId") REFERENCES "SummonerSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummonerSnapshot" ADD CONSTRAINT "SummonerSnapshot_analyticsQueryId_fkey" FOREIGN KEY ("analyticsQueryId") REFERENCES "AnalyticsQuery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToSummonerSnapshot" ADD FOREIGN KEY ("A") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToSummonerSnapshot" ADD FOREIGN KEY ("B") REFERENCES "SummonerSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
