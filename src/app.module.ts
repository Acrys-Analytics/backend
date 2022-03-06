import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { TwistedModule } from './twisted/twisted.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot(),
    TwistedModule.forRoot(process.env.RIOT_API_KEY),
  ],
  controllers: [AppController],
})
export class AppModule {}
