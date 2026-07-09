import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const swagger = new DocumentBuilder()
    .setTitle('Vibe Accounting Malaysia API')
    .setDescription(
      [
        'Vibe Accounting Malaysia — REST API for the Vibe Accounting platform.',
        '',
        'Modules: `auth`, `account-books`, `gl`, `ar`, `ap`, `sales`, `purchase`, `stock`, `dashboard`, `reports`, `einvoice`.',
        '',
        'Use the **Authorize** button (top right) to enter a Bearer JWT obtained from `POST /api/auth/login`.',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, doc);

  const origin = config.get<string>('WEB_ORIGIN') ?? '*';
  app.enableCors({ origin: origin === '*' ? true : origin.split(','), credentials: true });

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API running on http://0.0.0.0:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs on http://0.0.0.0:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap API', err);
  process.exit(1);
});
