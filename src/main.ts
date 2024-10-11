import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppDataSource } from '@config/data-source';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

const { PORT = 9000 } = process.env;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('/api');
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(PORT);
}

AppDataSource.initialize()
  .then(async () => {
    bootstrap();
  })
  .catch((error) => console.error(error));
