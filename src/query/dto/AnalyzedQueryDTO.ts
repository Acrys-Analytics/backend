import {
  AnalyticsQuery,
  Mastery,
  Participant,
  Prisma,
  SummonerSnapshot,
} from '@prisma/client';

type CompleteSummoner = SummonerSnapshot & {
  participants: Participant[];
  masteries: Mastery[];
};

export namespace AnalyzedQueriesDTOs {
  export interface AnalyzedQuery extends AnalyticsQuery {
    snapshots: AnalyzedSnapshot[];
  }
  export interface AnalyzedSnapshot
    extends Omit<CompleteSummoner, 'participants'> {
    championPool: Champion[];
    mostPlayedPosition: PositionPlayed[];
    globalStats: GlobalStats;
    participants: MatchParticipant[];
  }
  export interface GlobalStats {
    kills: number;
    deaths: number;
    assists: number;
    totalGames: number;
    wins: number;
    avgVisionScore: number;
    avgVisionWardsBought: number;
    avgCreepScore: number;
  }
  export interface MatchParticipant
    extends Omit<Omit<Participant, 'spells'>, 'runes'> {
    spells: ItemObject[];
    runes: ItemObject[];
  }
  export interface ItemObject {
    id: number;
    image: string;
  }
  export interface Champion
    extends Prisma.MasteryCreateWithoutSummonerSnapshotInput {
    used: number;
    wins: number;
  }
  export interface PositionPlayed {
    count: number;
    position: string;
  }
}
