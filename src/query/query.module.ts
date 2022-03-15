import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { QueryWorker } from './query.worker';

@Module({
  imports: [PrismaModule],
  controllers: [QueryController],
  providers: [QueryService, QueryWorker],
})
export class QueryModule {}
