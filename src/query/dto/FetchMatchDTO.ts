import { SummonerSnapshot } from '@prisma/client';
import { RegionGroups } from 'twisted/dist/constants';

export class FetchMatchDTO {
  matchId: string;
  queryId: string;
  snapshots: SummonerSnapshot[];
  regionGroup: RegionGroups;
}
