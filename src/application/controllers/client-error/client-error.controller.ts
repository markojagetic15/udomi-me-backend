import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';

class ClientErrorDto {
  @IsString()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;
}

// Frontend crash reports (what the user saw as "Ups, nešto je puklo"), written
// to the container log: `docker compose logs udomi-backend | grep client-error`.
// No cookies/identity are recorded.
@Controller('/client-errors')
export class ClientErrorController {
  @Post('/')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  report(@Body() body: ClientErrorDto) {
    console.warn('[client-error]', JSON.stringify(body));
  }
}
