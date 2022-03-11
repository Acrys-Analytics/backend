import { Regions } from 'twisted/dist/constants';

export class FetchEvent {
  summonerName: string;
  region: Regions;
  depth: number;
  queryId: string;
}
