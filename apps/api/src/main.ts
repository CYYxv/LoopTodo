import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ApiResponseInterceptor } from './common/api-response.interceptor';
import { RequestLoggingInterceptor } from './observability/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(app.get(RequestLoggingInterceptor), new ApiResponseInterceptor());
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(Number(config.getOrThrow('PORT')), '0.0.0.0');
}

void bootstrap();
