import { InjectQueue, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AnalyticsQuery,
  Position,
  Prisma,
  Rank,
  SummonerSnapshot,
  Tier,
} from '@prisma/client';
import { Job, Queue } from 'bull';
import { LolService } from 'src/lol/lol.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LOL_API } from 'src/twisted/constants';
import { Constants, LolApi } from 'twisted';
import { RegionGroups, Regions } from 'twisted/dist/constants';
import {
  ChampionMasteryDTO,
  SummonerLeagueDto,
  SummonerV4DTO,
} from 'twisted/dist/models-dto';
import { ClashTeamDto } from 'twisted/dist/models-dto/clash/team.clash.dto';
import { FetchMatchDTO } from './dto/FetchMatchDTO';
import { QueryUpdatedEvent } from './events/query-updated.event';
import { ClashPositionMapping } from './constants/clashPosition';
import { FLEX, SOLO } from './constants/leagueQueueTypes';

type SummonerMetadata = {
  leagues: SummonerLeagueDto[];
  masteries: ChampionMasteryDTO[];
};

type CompleteSummoner = SummonerV4DTO & SummonerMetadata;

@Processor('query')
export class QueryWorker {
  private readonly logger = new Logger(QueryWorker.name);

  constructor(
    private prisma: PrismaService,
    private lolService: LolService,
    private eventEmitter: EventEmitter2,
    @Inject(LOL_API) private lolApi: LolApi,
    @InjectQueue('match') private matchQueue: Queue<FetchMatchDTO>,
  ) {}

  // Only allowing one query because of matchJob problem
  // TODO: fix
  @Process({
    concurrency: 1,
  })
  async handleQuery(job: Job<AnalyticsQuery>) {
    const query = job.data;
    const region = query.region as Regions;
    const regionGroup = Constants.regionToRegionGroup(region);

    this.logger.log(`Got new queryJob: ${query.id}`);

    const summoners: Prisma.SummonerSnapshotCreateWithoutAnalyticsQueryInput[] =
      [];

    switch (query.type) {
      case 'PLAYER': {
        const searchSplit = query.search.split(',');

        for (let i = 0; i < searchSplit.length; i++) {
          const summonerSearch = searchSplit[i];

          this.logger.debug(`Searching for player ${summonerSearch}`);
          const player = await this.fetchSummonerbyName(summonerSearch, region);
          summoners.push(this.serializeSummoner(player));
        }
        break;
      }
      case 'CLASH': {
        this.logger.debug(
          `Searching for clash team with member ${query.search}`,
        );
        const originSummoner = await this.fetchSummonerbyName(
          query.search,
          region,
        );

        const clashTeam = await this.fetchClashTeam(originSummoner.id, region);

        this.logger.debug(`Got team ${clashTeam.name}`);

        const members = await Promise.all(
          clashTeam.players.map<
            Promise<Prisma.SummonerSnapshotCreateWithoutAnalyticsQueryInput>
          >(async (member) => {
            let summoner: CompleteSummoner;

            if (member.summonerId === originSummoner.id) {
              summoner = originSummoner;
            } else {
              summoner = await this.fetchSummonerbyId(
                member.summonerId,
                region,
              );
            }

            const serializedSummoner = this.serializeSummoner(summoner);
            const clashPosition: Position =
              ClashPositionMapping[member.position];

            return {
              ...serializedSummoner,
              clashPosition,
            };
          }),
        );

        summoners.push(...members);
        break;
      }
    }

    const matchesWithSnapshots: { [matchId: string]: FetchMatchDTO } = {};

    for (let i = 0; i < summoners.length; i++) {
      this.logger.debug(
        `Creating db snapshot for summoner ${summoners[i].summonerName}...`,
      );
      const snapshot = await this.prisma.summonerSnapshot.create({
        data: {
          ...summoners[i],
          AnalyticsQuery: {
            connect: {
              id: query.id,
            },
          },
        },
      });

      this.eventEmitter.emit(`query.update`, {
        queryId: query.id,
      } as QueryUpdatedEvent);

      const matches: string[] = await this.fetchMatchList(
        snapshot.puuid,
        regionGroup,
        query.depth,
      );

      this.logger.verbose(
        `Fetched ${matches.length} matchIds for ${snapshot.summonerName}`,
      );

      matches.forEach((matchId) => {
        if (!matchesWithSnapshots[matchId]) {
          matchesWithSnapshots[matchId] = {
            matchId,
            regionGroup,
            queryId: query.id,
            snapshots: [snapshot],
          };
        } else {
          matchesWithSnapshots[matchId].snapshots.push(snapshot);
        }
      });
    }

    const allMatches = Object.values(matchesWithSnapshots);
    const matchJobs: Job<FetchMatchDTO>[] = [];

    for (let i = 0; i < allMatches.length; i++) {
      const job = await this.addSummonerMatch(allMatches[i]);
      job && matchJobs.push(job);
    }

    // Wait until all matches have been resolved
    // Max listeners exceeds ????
    await Promise.all(
      matchJobs.map<Promise<any>>((job: Job<FetchMatchDTO>) => job.finished()),
    );

    await this.prisma.analyticsQuery.update({
      where: {
        id: query.id,
      },
      data: {
        complete: true,
      },
    });

    this.logger.log(`Query ${query.id} is finished!`);
    this.eventEmitter.emit(`query.result.${query.id}.complete`);
  }

  @OnQueueFailed()
  async handleError(job: Job<AnalyticsQuery>, error: Error) {
    const query = job.data;

    this.logger.error(error.message, error.stack);
    await this.prisma.analyticsQuery.update({
      where: {
        id: query.id,
      },
      data: {
        error: error.message,
        //complete: true,
      },
    });
  }

  private async fetchClashTeam(
    summonerId: string,
    region: Regions,
  ): Promise<ClashTeamDto> {
    const summonerTeams = (
      await this.lolApi.Clash.playersList(summonerId, region)
    ).response;

    if (summonerTeams.length < 1 || !summonerTeams[0]?.teamId)
      throw new Error("Couldn't find clash team");

    const clashTeam = (
      await this.lolApi.Clash.getTeamById(summonerTeams[0].teamId, region)
    ).response;

    return clashTeam;
  }

  private async fetchSummonerbyName(
    summonerName: string,
    region: Regions,
  ): Promise<CompleteSummoner> {
    let summoner: SummonerV4DTO;

    try {
      summoner = await this.getSummonerByName(summonerName, region);
    } catch (e) {
      throw new Error(`Couldn't find summoner ${summonerName}.`);
    }
    const metaData = await this.fetchMetadataForSummoner(summoner, region);

    return {
      ...summoner,
      ...metaData,
    };
  }

  private async fetchSummonerbyId(
    summonerId: string,
    region: Regions,
  ): Promise<CompleteSummoner> {
    const summoner = await this.getSummonerById(summonerId, region);
    const metaData = await this.fetchMetadataForSummoner(summoner, region);

    return {
      ...summoner,
      ...metaData,
    };
  }

  private async fetchMetadataForSummoner(
    summoner: SummonerV4DTO,
    region: Regions,
  ): Promise<SummonerMetadata> {
    const leagues = (await this.lolApi.League.bySummoner(summoner.id, region))
      .response;
    const masteries = (
      await this.lolApi.Champion.masteryBySummoner(summoner.id, region)
    ).response;

    return {
      leagues,
      masteries,
    };
  }

  private async getSummonerById(
    id: string,
    region: Regions,
  ): Promise<SummonerV4DTO> {
    return (await this.lolApi.Summoner.getById(id, region)).response;
  }

  private async getSummonerByName(
    name: string,
    region: Regions,
  ): Promise<SummonerV4DTO> {
    return (await this.lolApi.Summoner.getByName(name, region)).response;
  }

  private async fetchMatchList(
    puuid: string,
    regionGroup: RegionGroups,
    count: number,
  ) {
    return (
      await this.lolApi.MatchV5.list(puuid, regionGroup, {
        count,
      })
    ).response;
  }

  // TODO: Fix this for concurrent Queries
  private async addSummonerMatch(
    fetchRequest: FetchMatchDTO,
  ): Promise<Job<FetchMatchDTO>> {
    /*
    const possibleMatchJob = await this.matchJobAlreadyExists(
      fetchRequest.matchId,
    );

    if (possibleMatchJob) {
      this.logger.debug(
        `Job for match ${fetchRequest.matchId} already found. Adding snapshot links to job.`,
      );
      possibleMatchJob.update({
        ...possibleMatchJob.data,
        snapshots: [
          ...possibleMatchJob.data.snapshots,
          ...fetchRequest.snapshots,
        ],
      });
      return;
    }
    */

    const possibleDbMatch = await this.matchInDbExists(fetchRequest.matchId);

    if (possibleDbMatch) {
      for (let i = 0; i < fetchRequest.snapshots.length; i++) {
        const snapshot = fetchRequest.snapshots[i];

        this.logger.debug(
          `Match ${fetchRequest.matchId} found in Db. Linking snapshot for ${snapshot.summonerName}.`,
        );

        await this.linkMatch(fetchRequest.matchId, snapshot);
      }
      return;
    }

    this.logger.debug(`Adding match ${fetchRequest.matchId} to matchQueue.`);
    return await this.matchQueue.add(fetchRequest);
  }

  private async linkMatch(matchId: string, snapshot: SummonerSnapshot) {
    const participant = await this.prisma.participant.findUnique({
      where: {
        summonerId_matchId: {
          matchId,
          summonerId: snapshot.summonerId,
        },
      },
    });

    await this.prisma.participant.update({
      where: {
        id: participant.id,
      },
      data: {
        snapshots: {
          connect: {
            id: snapshot.id,
          },
        },
      },
    });
  }

  private async matchJobAlreadyExists(
    matchId: string,
  ): Promise<Job<FetchMatchDTO>> {
    const jobs = await this.matchQueue.getJobs([
      'waiting',
      'delayed',
      'paused',
    ]);

    return jobs.find((job) => job.data.matchId === matchId);
  }

  private async matchInDbExists(matchId: string): Promise<boolean> {
    const matchCount = await this.prisma.match.count({
      where: {
        id: matchId,
      },
    });

    return matchCount > 0;
  }

  private serializeSummoner(
    summoner: CompleteSummoner,
  ): Prisma.SummonerSnapshotCreateWithoutAnalyticsQueryInput {
    const masteries =
      summoner.masteries.map<Prisma.MasteryCreateWithoutSummonerSnapshotInput>(
        (mastery) => {
          return {
            championId: mastery.championId,
            championName: this.lolService.getChampionName(mastery.championId),
            level: mastery.championLevel,
            points: mastery.championPoints,
          };
        },
      );

    const soloLeague = summoner.leagues.find(
      (league) => league.queueType === SOLO,
    );

    const flexLeague = summoner.leagues.find(
      (league) => league.queueType === FLEX,
    );

    return {
      puuid: summoner.puuid,
      summonerId: summoner.id,
      summonerName: summoner.name,
      summonerIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
      tier: Tier[soloLeague?.tier || flexLeague?.tier],
      rank: Rank[soloLeague?.rank || flexLeague?.rank],
      leaguePoints: soloLeague?.leaguePoints,
      masteries: {
        createMany: {
          data: masteries,
        },
      },
    };
  }
}
