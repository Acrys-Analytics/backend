import { HttpService } from '@nestjs/axios';
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';
import { LOL_API } from 'src/twisted/twisted.constants';
import { LolApi } from 'twisted';
import { ChampionsDataDragonDetails } from 'twisted/dist/models-dto';
import { ChampionsFullDTO } from './dto/ChampionsFullDTO';
import { CHAMPIONS } from './lol.constants';

@Injectable()
export class LolService implements OnModuleInit {
  constructor(
    @Inject(LOL_API) private lolApi: LolApi,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private httpService: HttpService,
  ) {}

  async onModuleInit() {
    // Fetch the champion data once on startup
    await this.fetchChampionData();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async fetchChampionData() {
    const version = (await this.lolApi.DataDragon.getVersions())[0];

    const champions: ChampionsFullDTO = (
      await lastValueFrom(
        this.httpService.get<ChampionsFullDTO>(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/championFull.json`,
        ),
      )
    ).data;

    await this.cacheManager.set(CHAMPIONS, champions);
  }

  async getChampionName(id: number): Promise<string> {
    return ((await this.cacheManager.get(CHAMPIONS)) as ChampionsFullDTO).keys[
      id
    ];
  }

  async getChampionData(id: number): Promise<ChampionsDataDragonDetails> {
    const champName = await this.getChampionName(id);

    return ((await this.cacheManager.get(CHAMPIONS)) as ChampionsFullDTO).data[
      champName
    ];
  }
}
