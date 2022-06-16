import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { Observable } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQueryDTO } from './dto/CreateQueryDTO';
import { AnalyzedQueriesDTOs } from './dto/AnalyzedQueryDTO';
import { QueryUpdatedEvent } from './events/query-updated.event';
import { AnalyticsQuery, Mastery, SummonerSnapshot } from '@prisma/client';
import { LolService } from 'src/lol/lol.service';

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private lolService: LolService,
    @InjectQueue('query') private queryQueue: Queue<AnalyticsQuery>,
  ) {}

  async createQuery(config: CreateQueryDTO): Promise<string> {
    const query = await this.prisma.analyticsQuery.create({
      data: config,
    });

    await this.queryQueue.add(query);

    return query.id;
  }

  retrieveQuery(queryId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        const queryExists = await this.queryExists(queryId);

        if (!queryExists) {
          subscriber.error(`Couldn't find a query under the id ${queryId}`);
          return;
        }

        const currentState = await this.getAnalyzedQuery(queryId);

        subscriber.next({
          data: currentState,
        });

        if (currentState.complete) {
          subscriber.complete();
          return;
        }

        const updateCallback = (data) => {
          subscriber.next({
            data,
          });
        };

        const completeCallback = async () => {
          const data = await this.getAnalyzedQuery(queryId);
          subscriber.next({
            data,
          });

          this.eventEmitter.removeListener(
            `query.result.${queryId}.update`,
            updateCallback,
          );
          this.eventEmitter.removeListener(
            `query.result.${queryId}.complete`,
            completeCallback,
          );

          subscriber.complete();
        };

        this.eventEmitter.on(`query.result.${queryId}.update`, updateCallback);
        this.eventEmitter.on(
          `query.result.${queryId}.complete`,
          completeCallback,
        );
      })();
    });
  }

  @OnEvent('query.update')
  async handleQueryUpdate(payload: QueryUpdatedEvent) {
    const analyzedQuery = await this.getAnalyzedQuery(payload.queryId);

    this.logger.verbose(`Sending query update for id ${payload.queryId}`);

    this.eventEmitter.emit(
      `query.result.${payload.queryId}.update`,
      analyzedQuery,
    );
  }

  async getAnalyzedQuery(
    queryId: string,
  ): Promise<AnalyzedQueriesDTOs.AnalyzedQuery> {
    const query = await this.getCompleteQuery(queryId);

    const snapshots: AnalyzedQueriesDTOs.AnalyzedSnapshot[] = [];

    for (let i = 0; i < query.snapshots.length; i++) {
      const snapshot = query.snapshots[i];
      const globalStats = await this.getGlobalStats(snapshot);
      const championPool = await this.getMostPlayedChampions(
        snapshot,
        snapshot.masteries,
      );

      // Getting image path for every spell and rune
      const participants =
        snapshot.participants.map<AnalyzedQueriesDTOs.MatchParticipant>(
          (participant) => {
            const spells =
              participant.spells.map<AnalyzedQueriesDTOs.ItemObject>(
                (spellId) => {
                  return {
                    id: spellId,
                    image:
                      this.lolService.getSummonerSpellById(spellId)?.image.full,
                  };
                },
              );

            const runes = participant.runes.map<AnalyzedQueriesDTOs.ItemObject>(
              (runeId) => {
                return {
                  id: runeId,
                  image: this.lolService.getRuneById(runeId)?.icon,
                };
              },
            );

            return {
              ...participant,
              spells,
              runes,
            };
          },
        );
      const mostPlayedPosition = await this.getPositionCount(snapshot);

      snapshots.push({
        ...snapshot,
        participants,
        championPool,
        mostPlayedPosition,
        globalStats,
      });
    }

    return {
      ...query,
      snapshots,
    };
  }

  private async queryExists(queryId: string) {
    const count = await this.prisma.analyticsQuery.count({
      where: {
        id: queryId,
      },
    });

    return count > 0;
  }

  private async getGlobalStats(
    snapshot: SummonerSnapshot,
  ): Promise<AnalyzedQueriesDTOs.GlobalStats> {
    const global = await this.prisma.participant.aggregate({
      _count: {
        matchId: true,
      },
      _sum: {
        kills: true,
        deaths: true,
        assists: true,
      },
      _avg: {
        visionScore: true,
        visionWardsBoughtInGame: true,
        creepScore: true,
      },
      where: {
        snapshots: {
          some: {
            id: snapshot.id,
          },
        },
      },
    });

    const wins = await this.prisma.participant.count({
      where: {
        win: true,
        snapshots: {
          some: {
            id: snapshot.id,
          },
        },
      },
    });

    return {
      kills: global._sum.kills,
      deaths: global._sum.deaths,
      assists: global._sum.assists,
      totalGames: global._count.matchId,
      wins,
      avgVisionScore: global._avg.visionScore,
      avgVisionWardsBought: global._avg.visionWardsBoughtInGame,
      avgCreepScore: global._avg.creepScore,
    };
  }

  private async getMostPlayedChampions(
    snapshot: SummonerSnapshot,
    masteries: Mastery[],
  ): Promise<AnalyzedQueriesDTOs.Champion[]> {
    const counts = await this.prisma.participant.groupBy({
      by: ['championName', 'championId'],
      _count: {
        championName: true,
      },
      where: {
        snapshots: {
          some: {
            id: snapshot.id,
          },
        },
      },
      orderBy: {
        _count: {
          championName: 'desc',
        },
      },
      take: 10,
    });

    const mappedMasteries: { [championId: string]: Mastery } = {};

    masteries.forEach((mastery) => {
      mappedMasteries[mastery.championId] = mastery;
    });

    const championPool: AnalyzedQueriesDTOs.Champion[] = [];

    for (let i = 0; i < counts.length; i++) {
      const value = counts[i];

      const championWins = await this.prisma.participant.aggregate({
        _count: {
          win: true,
        },
        where: {
          championId: value.championId,
          win: true,
          snapshots: {
            some: {
              id: snapshot.id,
            },
          },
        },
      });

      championPool.push({
        championId: value.championId,
        championName: value.championName,
        level: mappedMasteries[value.championId]?.level || 0,
        points: mappedMasteries[value.championId]?.points || 0,
        used: value._count.championName,
        wins: championWins._count.win,
      });
    }

    return championPool;
  }

  private async getPositionCount(
    snapshot: SummonerSnapshot,
  ): Promise<AnalyzedQueriesDTOs.PositionPlayed[]> {
    const counts = await this.prisma.participant.groupBy({
      by: ['position'],
      _count: {
        position: true,
      },
      where: {
        snapshots: {
          some: {
            id: snapshot.id,
          },
        },
      },
      orderBy: {
        _count: {
          position: 'desc',
        },
      },
      take: 10,
    });

    return counts.map<AnalyzedQueriesDTOs.PositionPlayed>((value) => {
      return {
        count: value._count.position,
        position: value.position,
      };
    });
  }

  private getCompleteQuery(id: string) {
    return this.prisma.analyticsQuery.findUnique({
      where: {
        id,
      },
      include: {
        snapshots: {
          include: {
            participants: {
              orderBy: {
                Match: {
                  createdAt: 'desc',
                },
              },
            },
            masteries: true,
          },
        },
      },
    });
  }
}
