import { InjectQueue } from '@nestjs/bull';
import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { Observable } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQueryDTO } from './dto/CreateQueryDTO';
import { AnalyzedQueriesDTOs } from './dto/AnalyzedQueryDTO';
import { QueryUpdatedEvent } from './events/query-updated.event';
import { AnalyticsQuery, Mastery, SummonerSnapshot } from '@prisma/client';

@Injectable()
export class QueryService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
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
      const championPool = await this.getMostPlayedChampions(
        snapshot,
        snapshot.masteries,
      );
      const mostPlayedPosition = await this.getPositionCount(snapshot);

      snapshots.push({
        ...snapshot,
        championPool,
        mostPlayedPosition,
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
            participants: true,
            masteries: true,
          },
        },
      },
    });
  }
}
