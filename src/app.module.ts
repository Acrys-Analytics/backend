import { CacheModule, Module } from '@nestjs/common';
import { QueryModule } from './query/query.module';
import { PrismaModule } from './prisma/prisma.module';
import { TwistedModule } from './twisted/twisted.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    PrismaModule,
    CacheModule.register(),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    TwistedModule.forRoot(process.env.RIOT_API_KEY),
    QueryModule,
  ],
})
export class AppModule {}
