import { Match, Position } from '@prisma/client';

export declare namespace AnalyzedQuery {
  interface AnalyzedSummoner {
    complete: boolean;
    profile: Profile;
    championPool: Mastery[];
    matches: Match[];
    tags: string[];
  }
  interface Profile {
    profileIcon: number;
    name: string;
    level: number;
    tier: string;
    rank: string;
    lane: Position;
  }
  interface Mastery {
    level: number;
    points: number;
    used: number;
    wins: number;
  }
  interface Pick {
    championName: string;
  }
}
