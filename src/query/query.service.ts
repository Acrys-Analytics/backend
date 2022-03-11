import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQueryDTO } from './dto/CreateQueryDTO';
import { FetchEvent } from './interfaces/fetchEvent.interface';

@Injectable()
export class QueryService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createAnalyticsQuery(config: CreateQueryDTO) {
    const analyticsQuery = await this.prisma.analyticsQuery.create({
      data: {
        depth: config.depth,
        type: config.type,
      },
    });

    this.eventEmitter.emit(`fetch.${config.type.toLowerCase()}`, {
      depth: config.depth,
      region: config.region,
      summonerName: config.searchName,
      queryId: analyticsQuery.id,
    } as FetchEvent);

    return analyticsQuery.id;
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

  getAnalyticsQuery(id: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        const currentState = await this.retrieveCompleteAnalyticsQuery(id);

        if (!currentState) {
          subscriber.error(`Couldn't find a query under the id ${id}`);
          return;
        }

        subscriber.next({
          data: currentState,
          type: 'currentState',
        });

        if (currentState.complete) {
          subscriber.complete();
          return;
        }

        const updateCallback = async () => {
          const state = await this.retrieveCompleteAnalyticsQuery(id);

          // Send updated data
          subscriber.next({
            data: state,
          });
        };

        const updateListener = this.eventEmitter.on(
          `fetch.result.${id}.update`,
          updateCallback,
        );

        const completeCallback = () => {
          this.eventEmitter.removeListener(
            `fetch.result.${id}.update`,
            updateCallback,
          );
          this.eventEmitter.removeListener(
            `fetch.result.${id}.complete`,
            completeCallback,
          );
          subscriber.complete();
        };

        const completeListener = this.eventEmitter.on(
          `fetch.result.${id}.complete`,
          completeCallback,
        );
      })();
    });
  }
}
