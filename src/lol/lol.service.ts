import { Inject, Injectable } from '@nestjs/common';
import { LOLAPI } from 'src/twisted/twisted.constants';
import { LolApi } from 'twisted';
import { Regions } from 'twisted/dist/constants';

@Injectable()
export class LolService {
  constructor(@Inject(LOLAPI) private lolApi: LolApi) {}

  async getSummonerByName(summonerName: string, region: Regions) {
    return (await this.lolApi.Summoner.getByName(summonerName, region))
      .response;
  }

  async getCompleteProfileByName(summonerId: string, region: Regions) {
    const league = (await this.lolApi.League.bySummoner(summonerId, region))
      .response;

    const mastery = (
      await this.lolApi.Champion.masteryBySummoner(summonerId, region)
    ).response;

    return {
      leagues: league,
      mastery,
    };
  }

  // TODO: Fetch champions regularly
}
