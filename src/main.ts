import 'dotenv/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppDataSource } from '@config/data-source';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'fs';
import { UPLOAD_DIR } from '@shared/upload-dir';
import { initSentry, SentryExceptionFilter } from '@shared/sentry';

const { PORT = 8080 } = process.env;
const { FRONTEND_URL = 'http://localhost:3000' } = process.env;

const sentryEnabled = initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind nginx: trust X-Forwarded-Proto so req.secure reflects the real scheme
  // (and X-Forwarded-For so rate limiting sees the client IP, not nginx).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  mkdirSync(UPLOAD_DIR, { recursive: true });
  // Filenames are random UUIDs and never overwritten, so cache forever.
  app.useStaticAssets(UPLOAD_DIR, {
    prefix: '/api/uploads/',
    maxAge: '365d',
    immutable: true,
  });
  app.use(cookieParser());
  // whitelist: strip any body field without a validator, so clients can't set
  // things like `user`, `is_hidden` or `role` through an update payload.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (sentryEnabled) {
    app.useGlobalFilters(
      new SentryExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
    );
  }
  app.setGlobalPrefix('/api');

  app.enableCors({
    origin: [FRONTEND_URL],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(PORT);
}

AppDataSource.initialize()
  .then(() => bootstrap())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
