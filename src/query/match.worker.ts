import {
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Match, Position } from '@prisma/client';
import { Job } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { LOL_API } from 'src/twisted/constants';
import { LolApi } from 'twisted';
import { MatchV5DTOs } from 'twisted/dist/models-dto';
import { FetchMatchDTO } from './dto/FetchMatchDTO';
import { QueryUpdatedEvent } from './events/query-updated.event';

@Processor('match')
export class MatchWorker {
  private readonly logger = new Logger(MatchWorker.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @Inject(LOL_API) private lolApi: LolApi,
  ) {}

  @OnQueueFailed()
  async handleError(job: Job<FetchMatchDTO>, error: Error) {
    this.logger.error(error);
  }

  @Process({
    concurrency: 20,
  })
  async processMatch(job: Job<FetchMatchDTO>) {
    const { matchId, queryId, regionGroup } = job.data;

    this.logger.debug(`Fetching ${job.data.matchId}...`);
    const match = (await this.lolApi.MatchV5.get(matchId, regionGroup))
      .response;

    const dbMatch = await this.saveMatch(match);
    this.eventEmitter.emit(`query.update`, { queryId } as QueryUpdatedEvent);

    this.logger.debug(`Successfully fetched match ${dbMatch.id}`);
    return dbMatch;
  }

  @OnQueueCompleted()
  async linkSnapshots(job: Job<FetchMatchDTO>, result: Match) {
    const { snapshots } = job.data;

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];

      await this.prisma.participant.update({
        where: {
          summonerId_matchId: {
            matchId: job.data.matchId,
            summonerId: snapshot.summonerId,
          },
        },
        data: {
          snapshots: {
            connect: {
              id: snapshot.id,
            },
          },
        },
      });

      this.logger.debug(
        `Succesfully linked snapshot of ${snapshot.summonerName} to match ${job.data.matchId}.`,
      );
    }
  }

  private async saveMatch(result: MatchV5DTOs.MatchDto): Promise<Match> {
    const match = await this.prisma.match.create({
      data: {
        id: result.metadata.matchId,
        createdAt: new Date(result.info.gameCreation),
        duration: result.info.gameDuration,
        type: result.info.gameType,
        mapId: result.info.mapId,
        version: result.info.gameVersion,
      },
    });

    const participants = result.info.participants;

    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];

      const position = this.predictPosition(participant.lane, participant.role);

      const runes = participant.perks.styles.map<number>(
        (perkStyle) => perkStyle.style,
      );

      await this.prisma.participant.create({
        data: {
          summonerId: participant.summonerId,
          championId: participant.championId,
          championName: participant.championName,
          championLevel: participant.champLevel,
          position,
          win: participant.win,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          creepScore: participant.totalMinionsKilled,
          visionScore: participant.visionScore,
          visionWardsBoughtInGame: participant.visionWardsBoughtInGame,
          gold: participant.goldEarned,
          damageToChamps: participant.totalDamageDealtToChampions,
          damageToBuildings: participant.damageDealtToBuildings,
          spells: [participant.summoner1Id, participant.summoner2Id],
          runes,
          items: [
            participant.item0,
            participant.item1,
            participant.item2,
            participant.item3,
            participant.item4,
            participant.item5,
            participant.item6,
          ],
          Match: {
            connect: {
              id: match.id,
            },
          },
        },
      });
    }

    return match;
  }

  private predictPosition(
    lane: MatchV5DTOs.Lane,
    role: MatchV5DTOs.Role,
  ): Position {
    switch (lane) {
      case 'TOP': {
        return Position.TOP;
      }
      case 'JUNGLE': {
        return Position.JUNGLE;
      }
      case 'MIDDLE': {
        return Position.MIDDLE;
      }
      case 'BOTTOM': {
        if (role === 'CARRY') {
          return Position.BOTTOM;
        } else if (role === 'SUPPORT') {
          return Position.UTILITY;
        }
      }
    }
    return Position.FILL;
  }
}
