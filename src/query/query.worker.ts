import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Position, SummonerSnapshot } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { LOLAPI } from 'src/twisted/twisted.constants';
import { Constants, LolApi } from 'twisted';
import { MatchV5DTOs, SummonerV4DTO } from 'twisted/dist/models-dto';
import { FetchEvent } from './interfaces/fetchEvent.interface';

@Injectable()
export class QueryWorker {
  constructor(
    private eventMitter: EventEmitter2,
    private prisma: PrismaService,
    @Inject(LOLAPI) private lolApi: LolApi,
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

      const entry = await this.createPlayerEntry(summoner, payload.queryId);
      await this.getPlayerStats(payload, entry);
      finishedTasks++;

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

    const entry = await this.createPlayerEntry(summoner, payload.queryId);
    await this.getPlayerStats(payload, entry);

    await this.setQueryAsComplete(payload.queryId);
  }

  async createPlayerEntry(
    summoner: SummonerV4DTO,
    queryId: string,
  ): Promise<SummonerSnapshot> {
    const entry = await this.prisma.summonerSnapshot.create({
      data: {
        puuid: summoner.puuid,
        summonerId: summoner.id,
        summonerLevel: summoner.summonerLevel,
        summonerProfileIcon: summoner.profileIconId,

        analyticsQuery: {
          connect: {
            id: queryId,
          },
        },
      },
    });

    this.eventMitter.emit(`fetch.result.${queryId}.update`);

    return entry;
  }

  async setQueryAsComplete(queryId: string) {
    this.prisma.analyticsQuery.update({
      where: {
        id: queryId,
      },
      data: {
        complete: true,
      },
    });

    this.eventMitter.emit(`fetch.result.${queryId}.complete`);
  }

  async getPlayerStats(payload: FetchEvent, snapshot: SummonerSnapshot) {
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

    this.eventMitter.emit(`fetch.result.${payload.queryId}.update`);

    const matches = (
      await this.lolApi.MatchV5.list(
        snapshot.puuid,
        Constants.RegionGroups.EUROPE,
        {
          count: payload.depth,
        },
      )
    ).response;

    // Fetching every match
    for (let i = 0; i < matches.length; i++) {
      const match = (
        await this.lolApi.MatchV5.get(matches[i], Constants.RegionGroups.EUROPE)
      ).response;

      const participant = match.info.participants.find(
        (participant) => participant.puuid === snapshot.puuid,
      );

      const position = this.predictMatchPosition(
        participant.lane,
        participant.role,
      );

      await this.prisma.match.create({
        data: {
          createdAt: new Date(match.info.gameCreation),
          matchId: matches[i],
          mode: match.info.gameMode,

          championId: participant.championId,
          championName: participant.championName,
          position,
          win: participant.win,

          pentaKills: participant.pentaKills,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
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

      this.eventMitter.emit(`fetch.result.${payload.queryId}.update`);
    }
  }

  predictMatchPosition(
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
