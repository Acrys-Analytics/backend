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
  export interface AnalyzedSnapshot extends CompleteSummoner {
    championPool: Champion[];
    mostPlayedPosition: PositionPlayed[];
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
