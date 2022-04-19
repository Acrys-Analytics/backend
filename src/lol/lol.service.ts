import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lastValueFrom } from 'rxjs';
import { LOL_API } from 'src/twisted/constants';
import { LolApi } from 'twisted';
import { ChampionsDataDragonDetails } from 'twisted/dist/models-dto';
import { RunesReforgedDTO } from 'twisted/dist/models-dto/data-dragon/runes-reforged.dto';
import { ChampionsFullDTO } from './dto/ChampionsFullDTO';
import { SummonerSpellDTO } from './dto/SummonerSpellDTO';

@Injectable()
export class LolService implements OnModuleInit {
  private readonly logger = new Logger(LolService.name);

  private champions: ChampionsFullDTO;
  private runes: { [key: number]: RunesReforgedDTO };
  private summonerSpells: { [key: number]: SummonerSpellDTO };

  constructor(
    @Inject(LOL_API) private lolApi: LolApi,
    private httpService: HttpService,
  ) {}

  async onModuleInit() {
    // Fetch the champions once on startup
    await this.fetchChampionData();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async fetchChampionData() {
    const version = (await this.lolApi.DataDragon.getVersions())[0];
    this.logger.log(`Fetching data from DataDragon for v${version}...`);

    this.champions = (
      await lastValueFrom(
        this.httpService.get<ChampionsFullDTO>(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/championFull.json`,
        ),
      )
    ).data;

    const runesList: RunesReforgedDTO[] =
      await this.lolApi.DataDragon.getRunesReforged();

    this.runes = {};
    runesList.forEach((rune) => {
      this.runes[rune.id] = rune;
    });

    let spells = (
      await lastValueFrom(
        this.httpService.get<{ data: { [key: string]: SummonerSpellDTO } }>(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/summoner.json`,
        ),
      )
    ).data.data;

    this.summonerSpells = {};
    Object.values(spells).forEach((spell) => {
      this.summonerSpells[spell.key] = spell;
    });

    this.logger.log(`Successfully fetched all required data for v${version}!`);
  }

  getChampionName(id: number): string {
    return this.champions.keys[id];
  }

  getChampionData(id: number): ChampionsDataDragonDetails {
    const championName = this.getChampionName(id);
    return this.champions.data[championName];
  }

  getSummonerSpellById(id: number): SummonerSpellDTO {
    return this.summonerSpells[id];
  }

  getRuneById(id: number): RunesReforgedDTO {
    return this.runes[id];
  }
}
