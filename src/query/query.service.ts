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

        // Send the current state so the client is up to date
        subscriber.next({
          data: currentState,
        });

        console.log('Data sent');

        if (currentState.complete) {
          subscriber.complete();

          console.log('Complete');
          return;
        }

        const updateCallback = async (data) => {
          // Send updated data
          subscriber.next({
            data,
          });
        };

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

        // Listen for update on the fetched data
        this.eventEmitter.on(`fetch.result.${id}.update`, updateCallback);
        this.eventEmitter.on(`fetch.result.${id}.complete`, completeCallback);
      })();
    });
  }
}
