import { Module } from '@nestjs/common';
import { LolModule } from 'src/lol/lol.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { QueryWorker } from './query.worker';

@Module({
  imports: [PrismaModule, LolModule],
  controllers: [QueryController],
  providers: [QueryService, QueryWorker],
})
export class QueryModule {}
