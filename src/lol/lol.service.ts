import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lastValueFrom } from 'rxjs';
import { LOL_API } from 'src/twisted/twisted.constants';
import { LolApi } from 'twisted';
import { ChampionsDataDragonDetails } from 'twisted/dist/models-dto';
import { ChampionsFullDTO } from './dto/ChampionsFullDTO';

let champions;

@Injectable()
export class LolService implements OnModuleInit {
  constructor(
    @Inject(LOL_API) private lolApi: LolApi,
    private httpService: HttpService,
  ) {}

  async onModuleInit() {
    // Fetch the champion data once on startup
    await this.fetchChampionData();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async fetchChampionData() {
    const version = (await this.lolApi.DataDragon.getVersions())[0];

    champions = (
      await lastValueFrom(
        this.httpService.get<ChampionsFullDTO>(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/championFull.json`,
        ),
      )
    ).data;
  }

  async getChampionName(id: number): Promise<string> {
    return champions.keys[id];
  }

  async getChampionData(id: number): Promise<ChampionsDataDragonDetails> {
    const champName = await this.getChampionName(id);

    return champions.data[champName];
  }
}
