import { Module } from '@nestjs/common';
import { QueryModule } from './query/query.module';
import { PrismaModule } from './prisma/prisma.module';
import { TwistedModule } from './twisted/twisted.module';
import { BullModule } from '@nestjs/bull';
import { LolModule } from './lol/lol.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    QueryModule,
    PrismaModule,
    TwistedModule.forRoot({
      key: process.env.RIOT_API_KEY,
      rateLimitRetry: true,
      rateLimitRetryAttempts: 50, //TODO: so fucking sketchy
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    }),
    LolModule,
  ],
})
export class AppModule {}
