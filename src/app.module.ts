import { Module } from '@nestjs/common';
import { ResourceController } from '@/application/controllers/resource/resource.controller';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from '@/application/controllers/user/user.controller';
import { AuthController } from '@/application/controllers/auth/auth.controller';
import { ListingController } from '@/application/controllers/listing/listing.controller';
import { UserService } from '@/services/user/user.service';
import { AuthService } from '@/services/auth/auth.service';
import { ListingService } from '@/services/listing/listing.service';
import { ResourceService } from '@/services/resource/resource.service';
import { UserRepository } from '@/infrastructure/user.repository';
import { ListingRepository } from '@/infrastructure/listing.repository';
import { AuthRepository } from '@/infrastructure/auth.repository';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || '',
      signOptions: { expiresIn: '1h' },
    }),
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
  ],
})
export class AppModule {}
