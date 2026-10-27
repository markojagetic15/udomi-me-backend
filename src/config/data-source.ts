import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '@domain/user/User.entity';
import { Listing } from '@domain/listing/Listing.entity';
import { PasswordResetToken } from '@domain/auth/PasswordResetToken.entity';
import { Report } from '@domain/report/Report.entity';
import { Conversation } from '@domain/messaging/Conversation.entity';
import { Message } from '@domain/messaging/Message.entity';
import { Notification } from '@domain/notification/Notification.entity';
import { SavedSearch } from '@domain/notification/SavedSearch.entity';
import { AdminAction } from '@domain/admin/AdminAction.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  synchronize: true,
  // Full query logging in dev only; production logs just errors.
  logging: process.env.NODE_ENV === 'production' ? ['error'] : true,
  entities: [
    User,
    Listing,
    PasswordResetToken,
    Report,
    Conversation,
    Message,
    Notification,
    SavedSearch,
    AdminAction,
  ],
});
