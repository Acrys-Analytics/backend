import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TwistedModule } from 'src/twisted/twisted.module';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { QueryWorker } from './query.worker';

@Module({
  imports: [PrismaModule, TwistedModule],
  controllers: [QueryController],
  providers: [QueryService, QueryWorker],
})
export class QueryModule {}
