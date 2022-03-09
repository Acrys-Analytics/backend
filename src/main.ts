import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config as env } from 'dotenv';
import { ValidationPipe } from '@nestjs/common';

env();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(process.env.Port || 3000);
}
bootstrap();
