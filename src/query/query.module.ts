import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { LolModule } from 'src/lol/lol.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MatchWorker } from './match.worker';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { QueryWorker } from './query.worker';

@Module({
  imports: [
    PrismaModule,
    LolModule,
    BullModule.registerQueue({
      name: 'query',
    }),
    BullModule.registerQueue({
      name: 'match',
    }),
  ],
  controllers: [QueryController],
  providers: [QueryService, QueryWorker, MatchWorker],
})
export class QueryModule {}
