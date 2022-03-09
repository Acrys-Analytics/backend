import { Module } from '@nestjs/common';
import { QueryModule } from './query/query.module';
import { PrismaModule } from './prisma/prisma.module';
import { TwistedModule } from './twisted/twisted.module';
import { LolModule } from './lol/lol.module';

@Module({
  imports: [
    QueryModule,
    PrismaModule,
    TwistedModule.forRoot(process.env.RIOT_API_KEY),
    LolModule,
  ],
})
export class AppModule {}
