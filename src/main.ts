import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppDataSource } from '@config/data-source';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

const { PORT = 8080 } = process.env;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('/api');

  const allowedOrigins = [
    'https://udomi-me.com',
    'https://udomi-me.com/',
    'http://localhost:3000/',
    'http://localhost:3000',
    'https://accounts.google.com',
    'https://accounts.google.com/',
  ];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(PORT);
}

AppDataSource.initialize()
  .then(async () => {
    bootstrap();
  })
  .catch((error) => console.error(error));
