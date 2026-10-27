import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MailerModule } from '@nestjs-modules/mailer';
import { mailerOptions } from '@shared/mail.config';
import { UserController } from '@application/controllers/user/user.controller';
import { AuthController } from '@application/controllers/auth/auth.controller';
import { ListingController } from '@application/controllers/listing/listing.controller';
import { ResourceController } from '@application/controllers/resource/resource.controller';
import { MessagingController } from '@application/controllers/messaging/messaging.controller';
import { NotificationController } from '@application/controllers/notification/notification.controller';
import { AdminController } from '@application/controllers/admin/admin.controller';
import { ShareController } from '@application/controllers/share/share.controller';
import { ClientErrorController } from '@application/controllers/client-error/client-error.controller';
import { UserService } from '@services/user/user.service';
import { AuthService } from '@services/auth/auth.service';
import { ListingService } from '@services/listing/listing.service';
import { ReportService } from '@services/report/report.service';
import { AdminService } from '@services/admin/admin.service';
import { MessagingService } from '@services/messaging/messaging.service';
import { NotificationService } from '@services/notification/notification.service';
import { ShareService } from '@services/share/share.service';
import { UploadCleanupService } from '@services/maintenance/upload-cleanup.service';
import { UserRepository } from '@infrastructure/user.repository';
import { ListingRepository } from '@infrastructure/listing.repository';
import { AuthRepository } from '@infrastructure/auth.repository';
import { ReportRepository } from '@infrastructure/report.repository';
import { MessagingRepository } from '@infrastructure/messaging.repository';
import { NotificationRepository } from '@infrastructure/notification.repository';
import { AdminActionRepository } from '@infrastructure/admin-action.repository';
import { MailService } from '@shared/mail.service';
import { User } from '@domain/user/User.entity';
import { GoogleStrategy } from './auth/strategies/google.strategy';
import { AppDataSource } from '@config/data-source';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '1d' },
      }),
    }),
    PassportModule,
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forRoot(AppDataSource.options),
    // Global default per client IP; tighter limits on auth/messaging routes
    // via @Throttle in their controllers.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    MailerModule.forRootAsync({ useFactory: mailerOptions }),
  ],
  controllers: [
    UserController,
    AuthController,
    ListingController,
    ResourceController,
    MessagingController,
    NotificationController,
    AdminController,
    ShareController,
    ClientErrorController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    UserService,
    AuthService,
    ListingService,
    ReportService,
    AdminService,
    MessagingService,
    NotificationService,
    ShareService,
    UploadCleanupService,
    MailService,
    UserRepository,
    ListingRepository,
    AuthRepository,
    ReportRepository,
    MessagingRepository,
    NotificationRepository,
    AdminActionRepository,
    GoogleStrategy,
  ],
  exports: [TypeOrmModule],
})
export class AppModule {}
