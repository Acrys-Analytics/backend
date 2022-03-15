import { Match, Position } from '@prisma/client';

export declare namespace AnalyzedQuery {
  interface AnalyzedSummoner {
    complete: boolean;
    profile: Profile;
    masteries: Mastery[];
    matches: Match[];
    tags: string[];
  }
  interface Profile {
    profileIcon: number;
    name: string;
    level: number;
    lane: Position | undefined;
  }
  interface Mastery {
    championName: string;
    level: number;
    points: number;
    used: number;
    wins: number;
  }
  interface Pick {
    championName: string;
  }
}
