import { CacheModule, Module } from '@nestjs/common';
import { QueryModule } from './query/query.module';
import { PrismaModule } from './prisma/prisma.module';
import { TwistedModule } from './twisted/twisted.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LolModule } from './lol/lol.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    PrismaModule,
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    TwistedModule.forRoot(process.env.RIOT_API_KEY),
    LolModule,
    QueryModule,
  ],
})
export class AppModule {}
