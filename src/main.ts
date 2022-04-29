import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Fetch CORS Origins from ENV if available
  app.enableCors({
    origin: process.env.CORS_ALLOWED_ORIGINS,
  });

  // Use Validationpipe for whole application
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(3000);
}
bootstrap();
