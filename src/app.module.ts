import { Module } from '@nestjs/common';
import { ResourceController } from '@application/controllers/resource/resource.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from '@application/controllers/user/user.controller';
import { AuthController } from '@application/controllers/auth/auth.controller';
import { ListingController } from '@application/controllers/listing/listing.controller';
import { UserService } from '@services/user/user.service';
import { AuthService } from '@services/auth/auth.service';
import { ListingService } from '@services/listing/listing.service';
import { ResourceService } from '@services/resource/resource.service';
import { UserRepository } from '@infrastructure/user.repository';
import { ListingRepository } from '@infrastructure/listing.repository';
import { AuthRepository } from '@infrastructure/auth.repository';
import { PassportModule } from '@nestjs/passport';
import { User } from '@domain/user/User.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { AppDataSource } from '@config/data-source';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || '',
      signOptions: { expiresIn: '1h' },
    }),
    PassportModule,
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forRoot(AppDataSource.options),
  ],
  controllers: [
    UserController,
    AuthController,
    ListingController,
    ResourceController,
  ],
  providers: [
    UserService,
    AuthService,
    ListingService,
    ResourceService,
    UserRepository,
    ListingRepository,
    AuthRepository,
    GoogleStrategy,
  ],
  exports: [TypeOrmModule],
})
export class AppModule {}
