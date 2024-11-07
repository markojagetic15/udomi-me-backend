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

  const allowedOrigins = ['https://udomi-me.com', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Include this if your requests include cookies or authorization headers
  });

  await app.listen(PORT);
}

AppDataSource.initialize()
  .then(async () => {
    bootstrap();
  })
  .catch((error) => console.error(error));
