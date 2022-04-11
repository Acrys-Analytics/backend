import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AnalyticsQuery,
  Mastery,
  Match,
  Position,
  SummonerSnapshot,
} from '@prisma/client';
import { LolService } from 'src/lol/lol.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LOL_API } from 'src/twisted/twisted.constants';
import { Constants, LolApi } from 'twisted';
import { MatchV5DTOs, SummonerV4DTO } from 'twisted/dist/models-dto';
import { AnalyzedQuery } from './interfaces/analyzedQuery.interface';
import { FetchEvent } from './interfaces/fetchEvent.interface';

const clashPositionMapping: { [key: string]: Position } = {
  UNSELECTED: Position.FILL,
  FILL: Position.FILL,
  TOP: Position.TOP,
  JUNGLE: Position.JUNGLE,
  MIDDLE: Position.MID,
  BOTTOM: Position.BOT,
  UTILITY: Position.SUPPORT,
};

//TODO: Add cache

@Injectable()
export class QueryWorker {
  constructor(
    private eventMitter: EventEmitter2,
    private prisma: PrismaService,
    private lolData: LolService,
    @Inject(LOL_API) private lolApi: LolApi,
  ) {}

  @OnEvent('fetch.clash')
  async fetchClashData(payload: FetchEvent) {
    const originSummoner = (
      await this.lolApi.Summoner.getByName(payload.summonerName, payload.region)
    ).response;

    // TODO: Maybe selection of team?
    const summonerTeams = (
      await this.lolApi.Clash.playersList(originSummoner.id, payload.region)
    ).response[0];

    const team = (
      await this.lolApi.Clash.getTeamById(summonerTeams.teamId, payload.region)
    ).response;

    let finishedTasks = 0;

    // Start collecting infos for every player
    team.players.forEach(async (player) => {
      let summoner: SummonerV4DTO;

      // Check if we already fetched the user
      if (player.summonerId === originSummoner.id) {
        summoner = originSummoner;
      } else {
        summoner = (
          await this.lolApi.Summoner.getById(player.summonerId, payload.region)
        ).response;
      }

      const entry = await this.createSummonerSnapshot(
        summoner,
        payload.queryId,
        clashPositionMapping[player.position],
      );

      await this.retrievePlayerStats(payload, entry);
      finishedTasks++;

      //! Test this behaviour
      if (finishedTasks === 5) {
        await this.setQueryAsComplete(payload.queryId);
      }
    });
  }

  @OnEvent('fetch.player')
  async fetchPlayerData(payload: FetchEvent) {
    const summoner = (
      await this.lolApi.Summoner.getByName(payload.summonerName, payload.region)
    ).response;

    const entry = await this.createSummonerSnapshot(summoner, payload.queryId);
    await this.retrievePlayerStats(payload, entry);

    await this.setQueryAsComplete(payload.queryId);
  }

  async createSummonerSnapshot(
    summoner: SummonerV4DTO,
    payload: FetchEvent,
  ): Promise<SummonerSnapshot> {
    const league = (
      await this.lolApi.League.bySummoner(summoner.id, payload.region)
    ).response;

    const entry = await this.prisma.summonerSnapshot.create({
      data: {
        puuid: summoner.puuid,
        summonerId: summoner.id,
        summonerName: summoner.name,
        summonerLevel: summoner.summonerLevel,
        summonerProfileIcon: summoner.profileIconId,
        tier: league[0].tier,
        rank: league[0].rank,

        analyticsQuery: {
          connect: {
            id: payload.queryId,
          },
        },
      },
    });

    //TODO: Maybe better implementation?
    this.emitUpdatedData(queryId);

    return entry;
  }

  async setQueryAsComplete(queryId: string) {
    await this.prisma.analyticsQuery.update({
      where: {
        id: queryId,
      },
      data: {
        complete: true,
      },
    });

    this.eventMitter.emit(`fetch.result.${queryId}.complete`);
  }

  async retrievePlayerStats(payload: FetchEvent, snapshot: SummonerSnapshot) {
    /// FETCHING MASTERY ///
    const mastery = (
      await this.lolApi.Champion.masteryBySummoner(
        snapshot.summonerId,
        payload.region,
      )
    ).response;

    // Create entry for every mastery
    for (let i = 0; i < mastery.length; i++) {
      const master = mastery[i];

      await this.prisma.mastery.create({
        data: {
          championId: master.championId,
          championLevel: master.championLevel,
          championPoints: master.championPoints,

          summonerSnapshot: {
            connect: {
              id: snapshot.id,
            },
          },
        },
      });
    }

    this.emitUpdatedData(payload.queryId);

    /// FETCHING MATCHES ///
    const regionGroup = Constants.regionToRegionGroup(payload.region);

    const matches = (
      await this.lolApi.MatchV5.list(snapshot.puuid, regionGroup, {
        start: 0,
        count: payload.depth,
      })
    ).response;

    console.log(matches);

    // Getting data for every match
    for (let i = 0; i < matches.length; i++) {
      const matchId: string = matches[i];

      const match = (await this.lolApi.MatchV5.get(matchId, regionGroup))
        .response;

      const participant = match.info.participants.find(
        (participant) => participant.puuid === snapshot.puuid,
      );

      const position = this.predictMatchPosition(
        participant.lane,
        participant.role,
      );

      const championName = await this.lolData.getChampionName(
        participant.championId,
      );

      const items: number[] = [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6,
      ];

      await this.prisma.match.create({
        data: {
          createdAt: new Date(match.info.gameCreation),
          matchId,
          mode: match.info.gameMode,

          championId: participant.championId,
          championName,
          championLevel: participant.champLevel,
          position,
          win: participant.win,

          pentaKills: participant.pentaKills,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,

          items,
          visionScore: participant.visionScore,
          damageDealtToChampions: participant.totalDamageDealtToChampions,
          damageDealtToBuildings: participant.damageDealtToBuildings,

          summonerSnapshot: {
            connect: {
              id: snapshot.id,
            },
          },
        },
      });

      this.emitUpdatedData(payload.queryId);
    }
  }

  async emitUpdatedData(id: string) {
    const data = await this.retrieveCompleteAnalyticsQuery(id);

    const snapshots = data.snapshots.map((snapshot) =>
      this.analyzeSummonerSnapshot(data, snapshot),
    );

    this.eventMitter.emit(`fetch.result.${id}.update`, {
      ...data,
      snapshots,
    });
  }

  private analyzeSummonerSnapshot(
    query: AnalyticsQuery,
    snapshot: SummonerSnapshot & {
      matches: Match[];
      masteries: Mastery[];
    },
  ): AnalyzedQuery.AnalyzedSummoner {
    const championPool: {
      [championId: number]: AnalyzedQuery.Mastery;
    } = {};

    const positions = [];

    // Analyze every match
    snapshot.matches.forEach((match) => {
      if (!championPool[match.championId]) {
        // Creating champ entry including their masterylevel
        const masteryData = snapshot.masteries.find(
          (mastery) => mastery.championId === match.championId,
        );

        championPool[match.championId] = {
          level: masteryData.championLevel,
          points: masteryData.championPoints,
          used: 1,
          wins: match.win ? 1 : 0,
        };
      } else {
        // Just update the already existing entry
        if (match.win) {
          championPool[match.championId].wins++;
        }
        championPool[match.championId].used++;
      }
    });

    const champIdsSorted = Object.keys(championPool).sort(
      (a, b) => championPool[b].used - championPool[a].used,
    );

    const sortedChampionPool: AnalyzedQuery.Mastery[] = [];

    for (let id in champIdsSorted) {
      sortedChampionPool.push(championPool[id]);
    }

    return {
      complete: snapshot.matches.length === query.depth,
      profile: {
        profileIcon: snapshot.summonerProfileIcon,
        name: snapshot.summonerName,
        level: snapshot.summonerLevel,
        rank: snapshot.rank,
        tier: snapshot.tier,
        lane: snapshot.clashRole,
      },
      championPool: sortedChampionPool,
      matches: snapshot.matches,
      tags: [], //TODO: Add tag system
    };
  }

  private async retrieveCompleteAnalyticsQuery(id: string) {
    return await this.prisma.analyticsQuery.findUnique({
      where: {
        id,
      },
      include: {
        snapshots: {
          include: {
            matches: true,
            masteries: true,
          },
        },
      },
    });
  }

  private predictMatchPosition(
    lane: MatchV5DTOs.Lane,
    role: MatchV5DTOs.Role,
  ): Position {
    switch (lane) {
      case 'TOP': {
        if (role === 'SOLO') {
          return Position.TOP;
        }
      }
      case 'JUNGLE': {
        if (role === 'NONE') {
          return Position.JUNGLE;
        }
      }
      case 'MIDDLE': {
        if (role === 'SOLO') {
          return Position.MID;
        }
      }
      case 'BOTTOM': {
        switch (role) {
          case 'CARRY': {
            return Position.BOT;
          }
          case 'SUPPORT': {
            return Position.SUPPORT;
          }
        }
      }
      default: {
        return Position.FILL;
      }
    }
  }
}
