import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Fetch CORS Origins from ENV if available
  const allowedOriginsEnv: string = process.env.CORS_ALLOWED_ORIGINS;
  if (allowedOriginsEnv) {
    const allowedOrigins = allowedOriginsEnv.split(',');
    app.enableCors({
      origin: allowedOrigins,
    });

    console.log('CORS enabled!');
  }

  // Use Validationpipe for whole application
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(3000);
}
bootstrap();
