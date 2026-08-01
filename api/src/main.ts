import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SnakeCaseInterceptor } from './common/snake.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
    }),
  );
  app.useGlobalInterceptors(new SnakeCaseInterceptor());
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`Centric NestJS API listening on http://localhost:${port}/api`);
}
bootstrap();
